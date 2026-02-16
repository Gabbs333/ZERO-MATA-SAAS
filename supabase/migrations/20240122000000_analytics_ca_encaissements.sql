-- Migration: Analytics CA and Encaissements Views
-- Description: Creates views and functions for CA vs Encaissements analytics

-- ============================================================================
-- VIEW: Analytics CA vs Encaissements by period
-- ============================================================================

CREATE OR REPLACE VIEW analytics_ca_encaissements AS
WITH daily_ca AS (
  SELECT 
    DATE(c.date_validation) as date,
    COALESCE(SUM(c.montant_total), 0) as chiffre_affaires,
    COUNT(c.id) as nombre_commandes,
    COUNT(DISTINCT f.id) as nombre_factures
  FROM commandes c
  LEFT JOIN factures f ON c.id = f.commande_id
  WHERE c.statut = 'validee'
    AND c.date_validation IS NOT NULL
  GROUP BY DATE(c.date_validation)
),
daily_encaissements AS (
  SELECT 
    DATE(e.date_encaissement) as date,
    COALESCE(SUM(e.montant), 0) as encaissements
  FROM encaissements e
  GROUP BY DATE(e.date_encaissement)
)
SELECT 
  COALESCE(ca.date, enc.date) as date,
  COALESCE(ca.chiffre_affaires, 0) as chiffre_affaires,
  COALESCE(enc.encaissements, 0) as encaissements,
  COALESCE(ca.nombre_commandes, 0) as nombre_commandes,
  COALESCE(ca.nombre_factures, 0) as nombre_factures
FROM daily_ca ca
FULL OUTER JOIN daily_encaissements enc ON ca.date = enc.date
ORDER BY COALESCE(ca.date, enc.date) DESC;

-- ============================================================================
-- VIEW: Analytics Créances (CA - Encaissements)
-- ============================================================================

CREATE OR REPLACE VIEW analytics_creances AS
SELECT 
  -- Total CA (all validated commandes)
  COALESCE(SUM(c.montant_total), 0) as chiffre_affaires_total,
  -- Total Encaissements (all payments received)
  COALESCE(
    (SELECT SUM(e.montant) FROM encaissements e), 0
  ) as encaissements_total,
  -- Créances = CA - Encaissements
  COALESCE(SUM(c.montant_total), 0) - COALESCE(
    (SELECT SUM(e.montant) FROM encaissements e), 0
  ) as creances_total,
  -- Number of unpaid factures
  (SELECT COUNT(*) FROM factures WHERE statut != 'payee') as nombre_factures_impayees,
  -- Total amount of unpaid factures
  (SELECT COALESCE(SUM(montant_restant), 0) FROM factures WHERE statut != 'payee') as montant_factures_impayees
FROM commandes c
WHERE c.statut = 'validee';

-- ============================================================================
-- VIEW: Analytics by Payment Mode
-- ============================================================================

CREATE OR REPLACE VIEW analytics_by_payment_mode AS
SELECT 
  e.mode_paiement,
  COUNT(*) as nombre_encaissements,
  SUM(e.montant) as montant_total,
  AVG(e.montant) as montant_moyen,
  MIN(e.montant) as montant_min,
  MAX(e.montant) as montant_max,
  -- Percentage of total encaissements
  ROUND(
    (SUM(e.montant)::NUMERIC / NULLIF((SELECT SUM(montant) FROM encaissements), 0)) * 100, 
    2
  ) as pourcentage_total
FROM encaissements e
GROUP BY e.mode_paiement
ORDER BY montant_total DESC;

-- ============================================================================
-- FUNCTION: Get KPIs for a period
-- ============================================================================

CREATE OR REPLACE FUNCTION get_kpis(
  p_date_debut TIMESTAMPTZ,
  p_date_fin TIMESTAMPTZ
)
RETURNS TABLE (
  chiffre_affaires BIGINT,
  encaissements BIGINT,
  creances BIGINT,
  benefice BIGINT,
  nombre_commandes BIGINT,
  panier_moyen NUMERIC,
  nombre_factures_impayees BIGINT,
  taux_encaissement NUMERIC
) AS $
DECLARE
  v_ca BIGINT;
  v_encaissements BIGINT;
  v_creances BIGINT;
  v_benefice BIGINT;
  v_nombre_commandes BIGINT;
  v_panier_moyen NUMERIC;
  v_nombre_factures_impayees BIGINT;
  v_taux_encaissement NUMERIC;
  v_cout_total BIGINT;
BEGIN
  -- Calculate Chiffre d'Affaires (CA)
  SELECT COALESCE(SUM(c.montant_total), 0)
  INTO v_ca
  FROM commandes c
  WHERE c.statut = 'validee'
    AND c.date_validation >= p_date_debut
    AND c.date_validation <= p_date_fin;
  
  -- Calculate Encaissements
  SELECT COALESCE(SUM(e.montant), 0)
  INTO v_encaissements
  FROM encaissements e
  WHERE e.date_encaissement >= p_date_debut
    AND e.date_encaissement <= p_date_fin;
  
  -- Calculate Créances (CA - Encaissements)
  v_creances := v_ca - v_encaissements;
  
  -- Calculate Bénéfice (CA - Coût d'achat des produits vendus)
  -- Get total cost of products sold in the period
  SELECT COALESCE(SUM(ci.quantite * COALESCE(
    (SELECT ms.cout_unitaire 
     FROM mouvements_stock ms 
     WHERE ms.produit_id = ci.produit_id 
       AND ms.type = 'entree' 
       AND ms.cout_unitaire IS NOT NULL
     ORDER BY ms.date_creation DESC 
     LIMIT 1
    ), 0
  )), 0)
  INTO v_cout_total
  FROM commande_items ci
  JOIN commandes c ON ci.commande_id = c.id
  WHERE c.statut = 'validee'
    AND c.date_validation >= p_date_debut
    AND c.date_validation <= p_date_fin;
  
  v_benefice := v_ca - v_cout_total;
  
  -- Calculate Nombre de Commandes
  SELECT COUNT(*)
  INTO v_nombre_commandes
  FROM commandes c
  WHERE c.statut = 'validee'
    AND c.date_validation >= p_date_debut
    AND c.date_validation <= p_date_fin;
  
  -- Calculate Panier Moyen
  IF v_nombre_commandes > 0 THEN
    v_panier_moyen := v_ca::NUMERIC / v_nombre_commandes;
  ELSE
    v_panier_moyen := 0;
  END IF;
  
  -- Calculate Nombre de Factures Impayées in the period
  SELECT COUNT(*)
  INTO v_nombre_factures_impayees
  FROM factures f
  WHERE f.statut != 'payee'
    AND f.date_generation >= p_date_debut
    AND f.date_generation <= p_date_fin;
  
  -- Calculate Taux d'Encaissement (Encaissements / CA * 100)
  IF v_ca > 0 THEN
    v_taux_encaissement := (v_encaissements::NUMERIC / v_ca) * 100;
  ELSE
    v_taux_encaissement := 0;
  END IF;
  
  -- Return results
  RETURN QUERY
  SELECT 
    v_ca,
    v_encaissements,
    v_creances,
    v_benefice,
    v_nombre_commandes,
    ROUND(v_panier_moyen, 2),
    v_nombre_factures_impayees,
    ROUND(v_taux_encaissement, 2);
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant select on views to authenticated users
GRANT SELECT ON analytics_ca_encaissements TO authenticated;
GRANT SELECT ON analytics_creances TO authenticated;
GRANT SELECT ON analytics_by_payment_mode TO authenticated;

-- Grant execute on function to authenticated users
GRANT EXECUTE ON FUNCTION get_kpis(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON VIEW analytics_ca_encaissements IS 
  'Daily analytics showing CA (validated commandes) vs Encaissements (payments received)';

COMMENT ON VIEW analytics_creances IS 
  'Global view of créances (receivables): CA - Encaissements';

COMMENT ON VIEW analytics_by_payment_mode IS 
  'Statistics of encaissements grouped by payment mode (especes, mobile_money, carte_bancaire)';

COMMENT ON FUNCTION get_kpis(TIMESTAMPTZ, TIMESTAMPTZ) IS 
  'Returns all KPIs for a given period: CA, encaissements, créances, bénéfice, nombre commandes, panier moyen, factures impayées, taux encaissement';
