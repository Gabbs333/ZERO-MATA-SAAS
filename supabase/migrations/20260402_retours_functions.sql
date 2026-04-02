-- Migration: RPC Function for processing returns
-- Description: Creates the process_retour function that handles stock, invoice, and payment adjustments
-- Created: 2026-04-02

-- ============================================================================
-- FUNCTION: process_retour
-- ============================================================================

CREATE OR REPLACE FUNCTION process_retour(
  p_facture_id UUID,
  p_commande_id UUID,
  p_retour_items JSONB,  -- Array of {commande_item_id, produit_id, quantite_retournee, prix_unitaire}
  p_motif TEXT,
  p_etablissement_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_profile RECORD;
  v_retour_id UUID;
  v_item JSONB;
  v_commande_item RECORD;
  v_total_retour INTEGER := 0;
  v_facture RECORD;
  v_new_montant_paye INTEGER;
  v_new_montant_restant INTEGER;
  v_new_statut TEXT;
  v_decaissement_id UUID;
BEGIN
  -- Get caller ID
  v_caller_id := auth.uid();
  
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Vous devez être connecté pour traiter un retour.';
  END IF;
  
  -- Get caller profile
  SELECT * INTO v_caller_profile
  FROM profiles
  WHERE id = v_caller_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profil non trouvé.';
  END IF;
  
  -- Check role (patron or gerant only)
  IF v_caller_profile.role NOT IN ('patron', 'gerant') THEN
    RAISE EXCEPTION 'Accès refusé. Seul le patron ou le gérant peut traiter des retours.';
  END IF;
  
  -- Check actif
  IF v_caller_profile.actif <> true THEN
    RAISE EXCEPTION 'Votre compte est désactivé.';
  END IF;
  
  -- Get facture details
  SELECT * INTO v_facture
  FROM factures
  WHERE id = p_facture_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Facture non trouvée.';
  END IF;
  
  -- Check etablissement
  IF v_facture.etablissement_id <> p_etablissement_id THEN
    RAISE EXCEPTION 'Établissement non correspondant.';
  END IF;
  
  -- Calculate total return amount and validate items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_retour_items)
  LOOP
    -- Get commande_item details
    SELECT * INTO v_commande_item
    FROM commande_items
    WHERE id = (v_item->>'commande_item_id')::UUID;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Article de commande non trouvé: %', v_item->>'commande_item_id';
    END IF;
    
    -- Check quantity doesn't exceed original
    IF (v_item->>'quantite_retournee')::INTEGER > v_commande_item.quantite THEN
      RAISE EXCEPTION 'Quantité retournée dépasse la quantité originale pour %', v_commande_item.nom_produit;
    END IF;
    
    -- Check if already returned
    -- (This would need a separate tracking table for partial returns - simplified here)
    
    -- Calculate line amount
    v_total_retour := v_total_retour + (v_item->>'quantite_retournee')::INTEGER * (v_item->>'prix_unitaire')::INTEGER;
  END LOOP;
  
  IF v_total_retour = 0 THEN
    RAISE EXCEPTION 'Le montant total du retour doit être supérieur à 0.';
  END IF;
  
  -- Create retour record
  INSERT INTO retours (
    facture_id,
    commande_id,
    montant_total_retour,
    motif,
    utilisateur_id,
    etablissement_id
  )
  VALUES (
    p_facture_id,
    p_commande_id,
    v_total_retour,
    p_motif,
    v_caller_id,
    p_etablissement_id
  )
  RETURNING id INTO v_retour_id;
  
  -- Create retour_items and increment stock
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_retour_items)
  LOOP
    -- Insert retour_item
    INSERT INTO retour_items (
      retour_id,
      commande_item_id,
      produit_id,
      nom_produit,
      quantite_retournee,
      prix_unitaire,
      montant_ligne
    )
    VALUES (
      v_retour_id,
      (v_item->>'commande_item_id')::UUID,
      (v_item->>'produit_id')::UUID,
      (v_item->>'nom_produit')::TEXT,
      (v_item->>'quantite_retournee')::INTEGER,
      (v_item->>'prix_unitaire')::INTEGER,
      (v_item->>'quantite_retournee')::INTEGER * (v_item->>'prix_unitaire')::INTEGER
    );
    
    -- Increment stock (mouvement_stock entree)
    INSERT INTO mouvements_stock (
      produit_id,
      type,
      quantite,
      reference,
      type_reference,
      utilisateur_id,
      etablissement_id
    )
    VALUES (
      (v_item->>'produit_id')::UUID,
      'entree',
      (v_item->>'quantite_retournee')::INTEGER,
      'RET-' || v_retour_id::TEXT,
      'retour',
      v_caller_id,
      p_etablissement_id
    );
    
    -- Update stock quantite_disponible
    UPDATE stock
    SET quantite_disponible = quantite_disponible + (v_item->>'quantite_retournee')::INTEGER,
        derniere_mise_a_jour = NOW()
    WHERE produit_id = (v_item->>'produit_id')::UUID;
  END LOOP;
  
  -- Adjust facture
  v_new_montant_paye := GREATEST(0, v_facture.montant_paye - v_total_retour);
  v_new_montant_restant := GREATEST(0, v_facture.montant_total - v_facture.montant_paye - v_total_retour + v_new_montant_paye);
  
  -- Recalculate properly
  v_new_montant_restant := v_facture.montant_total - v_new_montant_paye;
  
  IF v_new_montant_restant <= 0 THEN
    v_new_statut := v_facture.statut; -- Keep current status if already paid
    v_new_montant_restant := 0;
  ELSIF v_new_montant_paye = 0 THEN
    v_new_statut := 'en_attente_paiement';
  ELSE
    v_new_statut := 'partiellement_payee';
  END IF;
  
  UPDATE factures
  SET 
    montant_paye = v_new_montant_paye,
    montant_restant = v_new_montant_restant,
    statut = v_new_statut
  WHERE id = p_facture_id;
  
  -- If facture was fully paid, create a negative encaissement (decaissement)
  IF v_facture.statut = 'payee' AND v_total_retour > 0 THEN
    INSERT INTO encaissements (
      facture_id,
      montant,
      mode_paiement,
      reference,
      utilisateur_id,
      date_encaissement,
      etablissement_id
    )
    VALUES (
      p_facture_id,
      -v_total_retour,  -- Negative amount for decaissement
      'especes',  -- Default to especes for returns
      'DECAIS-' || v_retour_id::TEXT,
      v_caller_id,
      NOW(),
      p_etablissement_id
    )
    RETURNING id INTO v_decaissement_id;
  END IF;
  
  -- Return success response
  RETURN json_build_object(
    'success', true,
    'retour_id', v_retour_id,
    'montant_total_retour', v_total_retour,
    'decaissement_id', v_decaissement_id
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erreur lors du traitement du retour: %', SQLERRM;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION process_retour TO authenticated;

-- Comment
COMMENT ON FUNCTION process_retour IS 'Processes a product return: creates return record, increments stock, adjusts invoice, and creates decaissement if needed';
