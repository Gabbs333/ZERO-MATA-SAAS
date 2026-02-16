-- Migration: Encaissements Functions and Views
-- Description: Creates functions and views for encaissements management

-- ============================================================================
-- FUNCTION: Create encaissement
-- ============================================================================

CREATE OR REPLACE FUNCTION create_encaissement(
  p_facture_id UUID,
  p_montant INTEGER,
  p_mode_paiement TEXT,
  p_reference TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  facture_id UUID,
  montant INTEGER,
  mode_paiement TEXT,
  reference TEXT,
  utilisateur_id UUID,
  date_encaissement TIMESTAMPTZ
) AS $$
DECLARE
  v_facture_montant_restant INTEGER;
  v_encaissement_id UUID;
BEGIN
  -- Validate mode_paiement
  IF p_mode_paiement NOT IN ('especes', 'mobile_money', 'carte_bancaire') THEN
    RAISE EXCEPTION 'Invalid mode_paiement: %. Must be one of: especes, mobile_money, carte_bancaire', p_mode_paiement;
  END IF;
  
  -- Validate montant > 0
  IF p_montant <= 0 THEN
    RAISE EXCEPTION 'Montant must be greater than 0';
  END IF;
  
  -- Check if facture exists and get montant_restant
  SELECT montant_restant INTO v_facture_montant_restant
  FROM factures
  WHERE factures.id = p_facture_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Facture not found: %', p_facture_id;
  END IF;
  
  -- Check if montant doesn't exceed montant_restant
  IF p_montant > v_facture_montant_restant THEN
    RAISE EXCEPTION 'Montant (%) exceeds montant_restant (%) for facture %', 
      p_montant, v_facture_montant_restant, p_facture_id;
  END IF;
  
  -- Insert encaissement
  INSERT INTO encaissements (
    facture_id,
    montant,
    mode_paiement,
    reference,
    utilisateur_id
  ) VALUES (
    p_facture_id,
    p_montant,
    p_mode_paiement,
    p_reference,
    auth.uid()
  )
  RETURNING 
    encaissements.id,
    encaissements.facture_id,
    encaissements.montant,
    encaissements.mode_paiement,
    encaissements.reference,
    encaissements.utilisateur_id,
    encaissements.date_encaissement
  INTO 
    v_encaissement_id,
    p_facture_id,
    p_montant,
    p_mode_paiement,
    p_reference,
    id,
    date_encaissement;
  
  -- Return the created encaissement
  RETURN QUERY
  SELECT 
    v_encaissement_id,
    p_facture_id,
    p_montant,
    p_mode_paiement,
    p_reference,
    auth.uid(),
    NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION: Get encaissements stats by period and mode
-- ============================================================================

CREATE OR REPLACE FUNCTION get_encaissements_stats(
  p_date_debut TIMESTAMPTZ,
  p_date_fin TIMESTAMPTZ
)
RETURNS TABLE (
  mode_paiement TEXT,
  nombre_encaissements BIGINT,
  montant_total BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.mode_paiement,
    COUNT(*)::BIGINT as nombre_encaissements,
    SUM(e.montant)::BIGINT as montant_total
  FROM encaissements e
  WHERE e.date_encaissement >= p_date_debut
    AND e.date_encaissement <= p_date_fin
  GROUP BY e.mode_paiement
  ORDER BY montant_total DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- VIEW: Encaissements summary
-- ============================================================================

CREATE OR REPLACE VIEW encaissements_summary AS
SELECT 
  DATE(e.date_encaissement) as date,
  e.mode_paiement,
  COUNT(*) as nombre_encaissements,
  SUM(e.montant) as montant_total,
  AVG(e.montant) as montant_moyen,
  MIN(e.montant) as montant_min,
  MAX(e.montant) as montant_max
FROM encaissements e
GROUP BY DATE(e.date_encaissement), e.mode_paiement
ORDER BY date DESC, montant_total DESC;

-- ============================================================================
-- VIEW: Encaissements with facture details
-- ============================================================================

CREATE OR REPLACE VIEW encaissements_with_facture AS
SELECT 
  e.id as encaissement_id,
  e.facture_id,
  e.montant as montant_encaisse,
  e.mode_paiement,
  e.reference,
  e.utilisateur_id,
  e.date_encaissement,
  f.numero_facture,
  f.commande_id,
  f.montant_total as facture_montant_total,
  f.montant_paye as facture_montant_paye,
  f.montant_restant as facture_montant_restant,
  f.statut as facture_statut,
  f.date_generation as facture_date_generation,
  p.nom as utilisateur_nom,
  p.prenom as utilisateur_prenom,
  p.role as utilisateur_role
FROM encaissements e
JOIN factures f ON e.facture_id = f.id
JOIN profiles p ON e.utilisateur_id = p.id
ORDER BY e.date_encaissement DESC;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant execute on functions to authenticated users
GRANT EXECUTE ON FUNCTION create_encaissement(UUID, INTEGER, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_encaissements_stats(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- Grant select on views to authenticated users
GRANT SELECT ON encaissements_summary TO authenticated;
GRANT SELECT ON encaissements_with_facture TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION create_encaissement(UUID, INTEGER, TEXT, TEXT) IS 
  'Creates an encaissement and automatically updates the facture status. Validates montant and mode_paiement.';

COMMENT ON FUNCTION get_encaissements_stats(TIMESTAMPTZ, TIMESTAMPTZ) IS 
  'Returns encaissement statistics by mode_paiement for a given period';

COMMENT ON VIEW encaissements_summary IS 
  'Daily summary of encaissements by mode_paiement';

COMMENT ON VIEW encaissements_with_facture IS 
  'Encaissements with complete facture and user details';

