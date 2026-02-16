-- Migration: Factures Functions and Views
-- Description: Creates functions and views for factures management

-- ============================================================================
-- FUNCTION: Get factures impayees
-- ============================================================================

CREATE OR REPLACE FUNCTION get_factures_impayees()
RETURNS TABLE (
  id UUID,
  numero_facture TEXT,
  commande_id UUID,
  montant_total INTEGER,
  montant_paye INTEGER,
  montant_restant INTEGER,
  statut TEXT,
  date_generation TIMESTAMPTZ,
  date_paiement_complet TIMESTAMPTZ
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
    f.date_paiement_complet
  FROM factures f
  WHERE f.statut != 'payee'
  ORDER BY f.date_generation DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION: Get factures by status
-- ============================================================================

CREATE OR REPLACE FUNCTION get_factures_by_status(p_statut TEXT)
RETURNS TABLE (
  id UUID,
  numero_facture TEXT,
  commande_id UUID,
  montant_total INTEGER,
  montant_paye INTEGER,
  montant_restant INTEGER,
  statut TEXT,
  date_generation TIMESTAMPTZ,
  date_paiement_complet TIMESTAMPTZ
) AS $$
BEGIN
  -- Validate status parameter
  IF p_statut NOT IN ('en_attente_paiement', 'partiellement_payee', 'payee') THEN
    RAISE EXCEPTION 'Invalid status: %. Must be one of: en_attente_paiement, partiellement_payee, payee', p_statut;
  END IF;

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
    f.date_paiement_complet
  FROM factures f
  WHERE f.statut = p_statut
  ORDER BY f.date_generation DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- VIEW: Factures with age (ancienneté)
-- ============================================================================

CREATE OR REPLACE VIEW factures_with_age AS
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
  -- Flag for overdue (> 24 hours)
  CASE 
    WHEN f.statut != 'payee' AND EXTRACT(EPOCH FROM (NOW() - f.date_generation)) / 3600 > 24 
    THEN true 
    ELSE false 
  END AS est_en_retard
FROM factures f;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant execute on functions to authenticated users
GRANT EXECUTE ON FUNCTION get_factures_impayees() TO authenticated;
GRANT EXECUTE ON FUNCTION get_factures_by_status(TEXT) TO authenticated;

-- Grant select on view to authenticated users
GRANT SELECT ON factures_with_age TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION get_factures_impayees() IS 'Returns all factures with status != payee';
COMMENT ON FUNCTION get_factures_by_status(TEXT) IS 'Returns factures filtered by status (en_attente_paiement, partiellement_payee, payee)';
COMMENT ON VIEW factures_with_age IS 'View of factures with calculated age in hours and days, and overdue flag';

