-- Migration: RPC Functions for pending return validation
-- Description: Creates functions for comptoir to request returns and patron to validate them
-- Created: 2026-04-08

-- ============================================================================
-- FUNCTION: create_pending_retour
-- ============================================================================

-- Function for comptoir to create pending return items
CREATE OR REPLACE FUNCTION create_pending_retour(
  p_facture_id UUID,
  p_commande_id UUID,
  p_retour_items JSONB,  -- Array of {commande_item_id, produit_id, quantite_retournee, prix_unitaire, nom_produit}
  p_motif TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_profile RECORD;
  v_item JSONB;
  v_commande_item RECORD;
  v_total_montant INTEGER := 0;
  v_facture RECORD;
BEGIN
  -- Get caller ID
  v_caller_id := auth.uid();
  
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Vous devez être connecté pour demander un retour.';
  END IF;
  
  -- Get caller profile
  SELECT * INTO v_caller_profile
  FROM profiles
  WHERE id = v_caller_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profil non trouvé.';
  END IF;
  
  -- Check role (comptoir only)
  IF v_caller_profile.role <> 'comptoir' THEN
    RAISE EXCEPTION 'Accès refusé. Seul le comptoir peut demander des retours.';
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
  
  -- Check if facture already has a pending or validated return
  IF EXISTS (
    SELECT 1 FROM retour_items_en_attente WHERE facture_id = p_facture_id
  ) THEN
    RAISE EXCEPTION 'Cette facture a déjà une demande de retour en attente.';
  END IF;
  
  -- Check etablissement
  IF v_facture.etablissement_id <> v_caller_profile.etablissement_id THEN
    RAISE EXCEPTION 'Établissement non correspondant.';
  END IF;
  
  -- Validate items and calculate total
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
    
    -- Calculate line amount
    v_total_montant := v_total_montant + (v_item->>'quantite_retournee')::INTEGER * (v_item->>'prix_unitaire')::INTEGER;
  END LOOP;
  
  IF v_total_montant = 0 THEN
    RAISE EXCEPTION 'Le montant total du retour doit être supérieur à 0.';
  END IF;
  
  -- Create pending return items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_retour_items)
  LOOP
    INSERT INTO retour_items_en_attente (
      facture_id,
      commande_id,
      commande_item_id,
      produit_id,
      nom_produit,
      quantite_retournee,
      prix_unitaire,
      montant_ligne,
      motif,
      utilisateur_id,
      etablissement_id
    )
    VALUES (
      p_facture_id,
      p_commande_id,
      (v_item->>'commande_item_id')::UUID,
      (v_item->>'produit_id')::UUID,
      (v_item->>'nom_produit')::TEXT,
      (v_item->>'quantite_retournee')::INTEGER,
      (v_item->>'prix_unitaire')::INTEGER,
      (v_item->>'quantite_retournee')::INTEGER * (v_item->>'prix_unitaire')::INTEGER,
      p_motif,
      v_caller_id,
      v_caller_profile.etablissement_id
    );
  END LOOP;
  
  RETURN json_build_object(
    'success', true,
    'message', 'Demande de retour créée avec succès. En attente de validation du patron.'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erreur lors de la création de la demande de retour: %', SQLERRM;
END;
$$;

-- ============================================================================
-- FUNCTION: valider_retour_en_attente
-- ============================================================================

-- Function for patron to validate pending returns and process them
CREATE OR REPLACE FUNCTION valider_retour_en_attente(
  p_facture_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_profile RECORD;
  v_pending_items RECORD;
  v_retour_id UUID;
  v_total_retour INTEGER := 0;
  v_facture RECORD;
  v_new_montant_paye INTEGER;
  v_new_montant_restant INTEGER;
  v_new_statut TEXT;
  v_decaissement_id UUID;
  v_pending_count INTEGER;
BEGIN
  -- Get caller ID
  v_caller_id := auth.uid();
  
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Vous devez être connecté pour valider un retour.';
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
    RAISE EXCEPTION 'Accès refusé. Seul le patron ou le gérant peut valider des retours.';
  END IF;
  
  -- Check actif
  IF v_caller_profile.actif <> true THEN
    RAISE EXCEPTION 'Votre compte est désactivé.';
  END IF;
  
  -- Check if there are pending items for this facture
  SELECT COUNT(*) INTO v_pending_count
  FROM retour_items_en_attente
  WHERE facture_id = p_facture_id;
  
  IF v_pending_count = 0 THEN
    RAISE EXCEPTION 'Aucun retour en attente pour cette facture.';
  END IF;
  
  -- Get facture details
  SELECT * INTO v_facture
  FROM factures
  WHERE id = p_facture_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Facture non trouvée.';
  END IF;
  
  -- Check etablissement
  IF v_facture.etablissement_id <> v_caller_profile.etablissement_id THEN
    RAISE EXCEPTION 'Établissement non correspondant.';
  END IF;
  
  -- Calculate total return amount
  SELECT SUM(montant_ligne) INTO v_total_retour
  FROM retour_items_en_attente
  WHERE facture_id = p_facture_id;
  
  IF v_total_retour IS NULL OR v_total_retour = 0 THEN
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
  SELECT 
    p_facture_id,
    commande_id,
    v_total_retour,
    motif, -- Use the first item's motif
    v_caller_id,
    etablissement_id
  FROM retour_items_en_attente
  WHERE facture_id = p_facture_id
  LIMIT 1
  RETURNING id INTO v_retour_id;
  
  -- Create retour_items and increment stock
  FOR v_pending_items IN 
    SELECT * FROM retour_items_en_attente WHERE facture_id = p_facture_id
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
      v_pending_items.commande_item_id,
      v_pending_items.produit_id,
      v_pending_items.nom_produit,
      v_pending_items.quantite_retournee,
      v_pending_items.prix_unitaire,
      v_pending_items.montant_ligne
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
      v_pending_items.produit_id,
      'entree',
      v_pending_items.quantite_retournee,
      'RET-' || v_retour_id::TEXT,
      'retour',
      v_caller_id,
      v_pending_items.etablissement_id
    );
    
    -- Update stock quantite_actuelle
    UPDATE stocks
    SET quantite_actuelle = quantite_actuelle + v_pending_items.quantite_retournee,
        derniere_mise_a_jour = NOW()
    WHERE produit_id = v_pending_items.produit_id;
  END LOOP;
  
  -- Delete pending items
  DELETE FROM retour_items_en_attente WHERE facture_id = p_facture_id;
  
  -- Adjust facture
  v_new_montant_paye := GREATEST(0, v_facture.montant_paye - v_total_retour);
  v_new_montant_restant := v_facture.montant_total - v_new_montant_paye;
  
  -- Determine new status
  IF v_new_montant_restant <= 0 THEN
    v_new_statut := v_facture.statut;
    v_new_montant_restant := 0;
  ELSIF v_new_montant_paye = 0 THEN
    v_new_statut := 'en_attente_paiement';
  ELSE
    v_new_statut := 'partiellement_payee';
  END IF;
  
  -- Determine statut_retour
  IF v_total_retour >= v_facture.montant_total THEN
    -- Total return
    UPDATE factures SET 
      montant_paye = v_new_montant_paye, 
      montant_restant = v_new_montant_restant, 
      statut = v_new_statut,
      statut_retour = 'retour_total'
    WHERE id = p_facture_id;
  ELSE
    -- Partial return
    UPDATE factures SET 
      montant_paye = v_new_montant_paye, 
      montant_restant = v_new_montant_restant, 
      statut = v_new_statut,
      statut_retour = 'retour_partiel'
    WHERE id = p_facture_id;
  END IF;
  
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
      v_caller_profile.etablissement_id
    )
    RETURNING id INTO v_decaissement_id;
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'retour_id', v_retour_id,
    'montant_total_retour', v_total_retour,
    'decaissement_id', v_decaissement_id
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erreur lors de la validation du retour: %', SQLERRM;
END;
$$;

-- ============================================================================
-- FUNCTION: annuler_retour_en_attente
-- ============================================================================

-- Function for patron to reject/cancel pending returns
CREATE OR REPLACE FUNCTION annuler_retour_en_attente(
  p_facture_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_profile RECORD;
  v_pending_count INTEGER;
BEGIN
  -- Get caller ID
  v_caller_id := auth.uid();
  
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Vous devez être connecté pour annuler un retour.';
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
    RAISE EXCEPTION 'Accès refusé. Seul le patron ou le gérant peut annuler des retours.';
  END IF;
  
  -- Check actif
  IF v_caller_profile.actif <> true THEN
    RAISE EXCEPTION 'Votre compte est désactivé.';
  END IF;
  
  -- Check if there are pending items for this facture
  SELECT COUNT(*) INTO v_pending_count
  FROM retour_items_en_attente
  WHERE facture_id = p_facture_id;
  
  IF v_pending_count = 0 THEN
    RAISE EXCEPTION 'Aucun retour en attente pour cette facture.';
  END IF;
  
  -- Delete pending items
  DELETE FROM retour_items_en_attente WHERE facture_id = p_facture_id;
  
  RETURN json_build_object(
    'success', true,
    'message', 'Demande de retour annulée avec succès.'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erreur lors de l\'annulation du retour: %', SQLERRM;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_pending_retour TO authenticated;
GRANT EXECUTE ON FUNCTION valider_retour_en_attente TO authenticated;
GRANT EXECUTE ON FUNCTION annuler_retour_en_attente TO authenticated;

-- Comments
COMMENT ON FUNCTION create_pending_retour IS 'Creates pending return items for comptoir to request returns';
COMMENT ON FUNCTION valider_retour_en_attente IS 'Validates pending returns, processes them, and adjusts stock/invoice';
COMMENT ON FUNCTION annuler_retour_en_attente IS 'Cancels/rejects pending return requests';