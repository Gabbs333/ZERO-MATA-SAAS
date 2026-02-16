-- Migration: Dashboard RPC Updates
-- Description: Adds missing RPC functions and ensures parameter consistency for Dashboard
-- Date: 2026-02-08

-- ============================================================================
-- FUNCTION: get_analytics_ca_encaissements
-- Description: Returns daily CA vs Encaissements for a given period
-- ============================================================================

CREATE OR REPLACE FUNCTION get_analytics_ca_encaissements(
  p_debut TIMESTAMPTZ,
  p_fin TIMESTAMPTZ
)
RETURNS TABLE (
  date DATE,
  chiffre_affaires BIGINT,
  encaissements BIGINT,
  nombre_commandes BIGINT,
  nombre_factures BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    v.date,
    v.chiffre_affaires,
    v.encaissements,
    v.nombre_commandes,
    v.nombre_factures
  FROM analytics_ca_encaissements v
  WHERE v.date >= p_debut::DATE
    AND v.date <= p_fin::DATE
  ORDER BY v.date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_analytics_ca_encaissements(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- ============================================================================
-- FUNCTION: get_dashboard_kpis (Unified version of get_kpis)
-- Description: Returns KPIs for the dashboard as a single JSON object
-- ============================================================================

CREATE OR REPLACE FUNCTION get_dashboard_kpis(
  p_debut TIMESTAMPTZ,
  p_fin TIMESTAMPTZ
)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'chiffre_affaires', chiffre_affaires,
    'encaissements', encaissements,
    'creances', creances,
    'benefice', benefice,
    'commandes_count', nombre_commandes,
    'panier_moyen', panier_moyen,
    'factures_impayees', nombre_factures_impayees,
    'taux_encaissement', taux_encaissement
  )
  INTO v_result
  FROM get_kpis(p_debut, p_fin);
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_dashboard_kpis(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- ============================================================================
-- FUNCTION: get_payment_modes_stats
-- Description: Returns encaissements grouped by payment mode for a given period
-- ============================================================================

CREATE OR REPLACE FUNCTION get_payment_modes_stats(
  p_debut TIMESTAMPTZ,
  p_fin TIMESTAMPTZ
)
RETURNS TABLE (
  mode_paiement TEXT,
  montant_total BIGINT,
  nombre_transactions BIGINT,
  pourcentage_total NUMERIC
) AS $$
DECLARE
  v_total_periode BIGINT;
BEGIN
  -- Get total encaissements for the period to calculate percentages
  SELECT COALESCE(SUM(montant), 0) INTO v_total_periode
  FROM encaissements
  WHERE date_encaissement >= p_debut AND date_encaissement <= p_fin;

  RETURN QUERY
  SELECT 
    e.mode_paiement,
    SUM(e.montant)::BIGINT as montant_total,
    COUNT(*)::BIGINT as nombre_transactions,
    CASE 
      WHEN v_total_periode > 0 THEN ROUND((SUM(e.montant)::NUMERIC / v_total_periode) * 100, 2)
      ELSE 0
    END as pourcentage_total
  FROM encaissements e
  WHERE e.date_encaissement >= p_debut AND e.date_encaissement <= p_fin
  GROUP BY e.mode_paiement
  ORDER BY montant_total DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_payment_modes_stats(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- Grant missing permissions for existing analytics functions
GRANT EXECUTE ON FUNCTION get_analytics(TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION search_transactions(TIMESTAMPTZ, TIMESTAMPTZ, UUID, UUID, UUID, INTEGER, INTEGER) TO authenticated;

COMMENT ON FUNCTION get_analytics_ca_encaissements IS 'Returns daily CA and Encaissements data for chart visualization within a date range.';
COMMENT ON FUNCTION get_dashboard_kpis IS 'Returns a single JSON object containing all dashboard KPIs for a given period.';
COMMENT ON FUNCTION get_payment_modes_stats IS 'Returns payment mode statistics for a given period.';
