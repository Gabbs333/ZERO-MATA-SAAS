-- Migration: Factures Impayées Alerts
-- Description: Creates function and view for unpaid invoice alerts (> 24 hours)

-- ============================================================================
-- FUNCTION: Get factures impayees alerts (> 24 hours)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_factures_impayees_alerts()
RETURNS TABLE (
  id UUID,
  numero_facture TEXT,
  commande_id UUID,
  montant_total NUMERIC,
  montant_paye NUMERIC,
  montant_restant NUMERIC,
  statut TEXT,
  date_generation TIMESTAMPTZ,
  age_heures NUMERIC,
  age_jours NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    f.id,
    f.numero_facture,
    f.commande_id,
    f.montant_total,
    f.montant_paye,
    f.montant_restant,
    f.statut,
    f.date_generation,
    -- Calculate age in hours
    EXTRACT(EPOCH FROM (NOW() - f.date_generation)) / 3600 AS age_heures,
    -- Calculate age in days
    EXTRACT(EPOCH FROM (NOW() - f.date_generation)) / 86400 AS age_jours
  FROM factures f
  WHERE f.statut != 'payee'
    AND EXTRACT(EPOCH FROM (NOW() - f.date_generation)) / 3600 > 24
  ORDER BY f.date_generation ASC; -- Oldest first
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- VIEW: Factures overdue (en retard)
-- ============================================================================

CREATE OR REPLACE VIEW factures_overdue AS
SELECT 
  f.id,
  f.numero_facture,
  f.commande_id,
  f.montant_total,
  f.montant_paye,
  f.montant_restant,
  f.statut,
  f.date_generation,
  f.date_paiement_complet,
  -- Calculate age in hours
  EXTRACT(EPOCH FROM (NOW() - f.date_generation)) / 3600 AS age_heures,
  -- Calculate age in days
  EXTRACT(EPOCH FROM (NOW() - f.date_generation)) / 86400 AS age_jours,
  -- Calculate age in weeks
  EXTRACT(EPOCH FROM (NOW() - f.date_generation)) / 604800 AS age_semaines,
  -- Severity level based on age
  CASE 
    WHEN EXTRACT(EPOCH FROM (NOW() - f.date_generation)) / 3600 > 168 THEN 'critique' -- > 7 days
    WHEN EXTRACT(EPOCH FROM (NOW() - f.date_generation)) / 3600 > 72 THEN 'eleve'     -- > 3 days
    WHEN EXTRACT(EPOCH FROM (NOW() - f.date_generation)) / 3600 > 24 THEN 'moyen'     -- > 1 day
    ELSE 'faible'
  END AS niveau_alerte
FROM factures f
WHERE f.statut != 'payee'
  AND EXTRACT(EPOCH FROM (NOW() - f.date_generation)) / 3600 > 24;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant execute on function to authenticated users
GRANT EXECUTE ON FUNCTION get_factures_impayees_alerts() TO authenticated;

-- Grant select on view to authenticated users
GRANT SELECT ON factures_overdue TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION get_factures_impayees_alerts() IS 'Returns unpaid factures older than 24 hours with age calculation';
COMMENT ON VIEW factures_overdue IS 'View of overdue factures (> 24h) with age in hours/days/weeks and severity level';
