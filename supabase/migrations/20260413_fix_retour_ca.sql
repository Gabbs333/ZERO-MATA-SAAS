-- Migration: Reflect returns in commandes.montant_total (CA)
-- Description: Updates valider_retour_en_attente and process_retour to also
-- reduce commandes.montant_total so the dashboard CA reflects net revenue.
-- Created: 2026-04-13

-- ============================================================================
-- 1. valider_retour_en_attente : recalculer commandes.montant_total
-- ============================================================================

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
  v_commande_id UUID;
  v_new_montant_total INTEGER;
  v_new_montant_paye INTEGER;
  v_new_montant_restant INTEGER;
  v_new_statut TEXT;
  v_decaissement_id UUID;
  v_pending_count INTEGER;
  v_montant_a_rembourser INTEGER := 0;
  v_produit RECORD;
  v_new_commande_total INTEGER;
BEGIN
  v_caller_id := auth.uid();
  SELECT * INTO v_caller_profile FROM profiles WHERE id = v_caller_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Profil non trouvé.'; END IF;
  IF v_caller_profile.role NOT IN ('patron', 'gerant') THEN
    RAISE EXCEPTION 'Accès refusé.';
  END IF;
  IF v_caller_profile.actif <> true THEN RAISE EXCEPTION 'Compte désactivé.'; END IF;

  SELECT COUNT(*) INTO v_pending_count FROM retour_items_en_attente WHERE facture_id = p_facture_id;
  IF v_pending_count = 0 THEN RAISE EXCEPTION 'Aucun retour en attente pour cette facture.'; END IF;

  SELECT * INTO v_facture FROM factures WHERE id = p_facture_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Facture non trouvée.'; END IF;
  IF v_facture.etablissement_id <> v_caller_profile.etablissement_id THEN
    RAISE EXCEPTION 'Établissement non correspondant.';
  END IF;

  SELECT SUM(montant_ligne) INTO v_total_retour FROM retour_items_en_attente WHERE facture_id = p_facture_id;
  IF v_total_retour IS NULL OR v_total_retour = 0 THEN
    RAISE EXCEPTION 'Le montant total du retour doit être supérieur à 0.';
  END IF;

  -- Récupérer le commande_id
  SELECT commande_id INTO v_commande_id FROM retour_items_en_attente WHERE facture_id = p_facture_id LIMIT 1;

  -- Créer l'enregistrement de retour
  INSERT INTO retours (facture_id, commande_id, montant_total_retour, motif, utilisateur_id, etablissement_id)
  SELECT p_facture_id, commande_id, v_total_retour, motif, v_caller_id, etablissement_id
  FROM retour_items_en_attente WHERE facture_id = p_facture_id LIMIT 1
  RETURNING id INTO v_retour_id;

  -- Traiter les articles retournés
  FOR v_pending_items IN SELECT * FROM retour_items_en_attente WHERE facture_id = p_facture_id
  LOOP
    INSERT INTO retour_items (retour_id, commande_item_id, produit_id, nom_produit, quantite_retournee, prix_unitaire, montant_ligne)
    VALUES (v_retour_id, v_pending_items.commande_item_id, v_pending_items.produit_id, v_pending_items.nom_produit, v_pending_items.quantite_retournee, v_pending_items.prix_unitaire, v_pending_items.montant_ligne);

    SELECT * INTO v_produit FROM produits WHERE id = v_pending_items.produit_id;
    IF v_produit.gestion_stock = true THEN
      INSERT INTO mouvements_stock (produit_id, type, quantite, reference, type_reference, utilisateur_id, etablissement_id)
      VALUES (v_pending_items.produit_id, 'entree', v_pending_items.quantite_retournee, 'RET-' || v_retour_id::TEXT, 'retour', v_caller_id, v_pending_items.etablissement_id);

      UPDATE stocks SET quantite_actuelle = quantite_actuelle + v_pending_items.quantite_retournee, derniere_mise_a_jour = NOW()
      WHERE produit_id = v_pending_items.produit_id;
    END IF;

    -- Réduire la quantité dans commande_items (refléter le retour dans la commande)
    UPDATE commande_items
    SET quantite = GREATEST(0, quantite - v_pending_items.quantite_retournee),
        montant_ligne = GREATEST(0, quantite - v_pending_items.quantite_retournee) * prix_unitaire
    WHERE id = v_pending_items.commande_item_id;
  END LOOP;

  DELETE FROM retour_items_en_attente WHERE facture_id = p_facture_id;

  -- Recalculer le montant total de la commande
  SELECT COALESCE(SUM(montant_ligne), 0) INTO v_new_commande_total
  FROM commande_items WHERE commande_id = v_commande_id;

  UPDATE commandes SET montant_total = v_new_commande_total WHERE id = v_commande_id;

  -- Ajuster la facture
  v_new_montant_total := GREATEST(0, v_facture.montant_total - v_total_retour);

  IF v_facture.montant_paye > v_new_montant_total THEN
    v_montant_a_rembourser := v_facture.montant_paye - v_new_montant_total;
    v_new_montant_paye := v_new_montant_total;
  ELSE
    v_new_montant_paye := v_facture.montant_paye;
  END IF;

  v_new_montant_restant := v_new_montant_total - v_new_montant_paye;

  IF v_new_montant_total = 0 THEN v_new_statut := 'payee';
  ELSIF v_new_montant_restant = 0 THEN v_new_statut := 'payee';
  ELSIF v_new_montant_paye = 0 THEN v_new_statut := 'en_attente_paiement';
  ELSE v_new_statut := 'partiellement_payee';
  END IF;

  UPDATE factures SET montant_total = v_new_montant_total, montant_paye = v_new_montant_paye,
    montant_restant = v_new_montant_restant, statut = v_new_statut,
    statut_retour = CASE WHEN v_new_montant_total = 0 THEN 'retour_total' ELSE 'retour_partiel' END
  WHERE id = p_facture_id;

  IF v_montant_a_rembourser > 0 THEN
    INSERT INTO encaissements (facture_id, montant, mode_paiement, reference, utilisateur_id, etablissement_id)
    VALUES (p_facture_id, -v_montant_a_rembourser, 'especes', 'DECAIS-' || v_retour_id::TEXT, v_caller_id, v_caller_profile.etablissement_id)
    RETURNING id INTO v_decaissement_id;
  END IF;

  RETURN json_build_object('success', true, 'retour_id', v_retour_id, 'montant_total_retour', v_total_retour,
    'montant_rembourse', v_montant_a_rembourser, 'decaissement_id', v_decaissement_id);
END;
$$;

-- ============================================================================
-- 2. process_retour : idem (recalcul commande + ajustement commande_items)
-- ============================================================================

CREATE OR REPLACE FUNCTION process_retour(
  p_facture_id UUID, p_commande_id UUID, p_retour_items JSONB, p_motif TEXT, p_etablissement_id UUID
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_caller_id UUID; v_caller_profile RECORD; v_retour_id UUID; v_item JSONB;
  v_commande_item RECORD; v_produit RECORD; v_total_retour INTEGER := 0; v_facture RECORD;
  v_new_montant_total INTEGER; v_new_montant_paye INTEGER; v_new_montant_restant INTEGER;
  v_new_statut TEXT; v_decaissement_id UUID; v_montant_a_rembourser INTEGER := 0;
  v_new_commande_total INTEGER;
BEGIN
  v_caller_id := auth.uid();
  SELECT * INTO v_caller_profile FROM profiles WHERE id = v_caller_id;
  IF v_caller_profile.role NOT IN ('patron', 'gerant') THEN RAISE EXCEPTION 'Accès refusé.'; END IF;
  IF v_caller_profile.actif <> true THEN RAISE EXCEPTION 'Compte désactivé.'; END IF;

  SELECT * INTO v_facture FROM factures WHERE id = p_facture_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Facture non trouvée.'; END IF;
  IF v_facture.etablissement_id <> p_etablissement_id THEN RAISE EXCEPTION 'Établissement non correspondant.'; END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_retour_items) LOOP
    SELECT * INTO v_commande_item FROM commande_items WHERE id = (v_item->>'commande_item_id')::UUID;
    IF NOT FOUND THEN RAISE EXCEPTION 'Article non trouvé: %', v_item->>'commande_item_id'; END IF;
    IF (v_item->>'quantite_retournee')::INTEGER > v_commande_item.quantite THEN
      RAISE EXCEPTION 'Quantité retournée dépasse la quantité originale pour %', v_commande_item.nom_produit;
    END IF;
    v_total_retour := v_total_retour + (v_item->>'quantite_retournee')::INTEGER * (v_item->>'prix_unitaire')::INTEGER;
  END LOOP;

  IF v_total_retour = 0 THEN RAISE EXCEPTION 'Montant total du retour doit être > 0.'; END IF;

  INSERT INTO retours (facture_id, commande_id, montant_total_retour, motif, utilisateur_id, etablissement_id)
  VALUES (p_facture_id, p_commande_id, v_total_retour, p_motif, v_caller_id, p_etablissement_id)
  RETURNING id INTO v_retour_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_retour_items) LOOP
    INSERT INTO retour_items (retour_id, commande_item_id, produit_id, nom_produit, quantite_retournee, prix_unitaire, montant_ligne)
    VALUES (v_retour_id, (v_item->>'commande_item_id')::UUID, (v_item->>'produit_id')::UUID,
      (v_item->>'nom_produit')::TEXT, (v_item->>'quantite_retournee')::INTEGER,
      (v_item->>'prix_unitaire')::INTEGER, (v_item->>'quantite_retournee')::INTEGER * (v_item->>'prix_unitaire')::INTEGER);

    SELECT * INTO v_produit FROM produits WHERE id = (v_item->>'produit_id')::UUID;
    IF v_produit.gestion_stock = true THEN
      INSERT INTO mouvements_stock (produit_id, type, quantite, reference, type_reference, utilisateur_id, etablissement_id)
      VALUES ((v_item->>'produit_id')::UUID, 'entree', (v_item->>'quantite_retournee')::INTEGER,
        'RET-' || v_retour_id::TEXT, 'retour', v_caller_id, p_etablissement_id);
      UPDATE stocks SET quantite_actuelle = quantite_actuelle + (v_item->>'quantite_retournee')::INTEGER,
        derniere_mise_a_jour = NOW() WHERE produit_id = (v_item->>'produit_id')::UUID;
    END IF;

    -- Réduire la quantité dans commande_items
    UPDATE commande_items
    SET quantite = GREATEST(0, quantite - (v_item->>'quantite_retournee')::INTEGER),
        montant_ligne = GREATEST(0, quantite - (v_item->>'quantite_retournee')::INTEGER) * prix_unitaire
    WHERE id = (v_item->>'commande_item_id')::UUID;
  END LOOP;

  -- Recalculer le montant total de la commande
  SELECT COALESCE(SUM(montant_ligne), 0) INTO v_new_commande_total
  FROM commande_items WHERE commande_id = p_commande_id;
  UPDATE commandes SET montant_total = v_new_commande_total WHERE id = p_commande_id;

  -- Ajuster la facture
  v_new_montant_total := GREATEST(0, v_facture.montant_total - v_total_retour);
  IF v_facture.montant_paye > v_new_montant_total THEN
    v_montant_a_rembourser := v_facture.montant_paye - v_new_montant_total;
    v_new_montant_paye := v_new_montant_total;
  ELSE v_new_montant_paye := v_facture.montant_paye; END IF;
  v_new_montant_restant := v_new_montant_total - v_new_montant_paye;

  IF v_new_montant_total = 0 THEN v_new_statut := 'payee';
  ELSIF v_new_montant_restant = 0 THEN v_new_statut := 'payee';
  ELSIF v_new_montant_paye = 0 THEN v_new_statut := 'en_attente_paiement';
  ELSE v_new_statut := 'partiellement_payee'; END IF;

  UPDATE factures SET montant_total = v_new_montant_total, montant_paye = v_new_montant_paye,
    montant_restant = v_new_montant_restant, statut = v_new_statut,
    statut_retour = CASE WHEN v_new_montant_total = 0 THEN 'retour_total' ELSE 'retour_partiel' END
  WHERE id = p_facture_id;

  IF v_montant_a_rembourser > 0 THEN
    INSERT INTO encaissements (facture_id, montant, mode_paiement, reference, utilisateur_id, etablissement_id)
    VALUES (p_facture_id, -v_montant_a_rembourser, 'especes', 'DECAIS-' || v_retour_id::TEXT, v_caller_id, p_etablissement_id)
    RETURNING id INTO v_decaissement_id;
  END IF;

  RETURN json_build_object('success', true, 'retour_id', v_retour_id, 'montant_total_retour', v_total_retour,
    'montant_rembourse', v_montant_a_rembourser, 'decaissement_id', v_decaissement_id);
END;
$$;

-- ============================================================================
-- Permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION valider_retour_en_attente(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION process_retour(UUID, UUID, JSONB, TEXT, UUID) TO authenticated;

COMMENT ON FUNCTION valider_retour_en_attente(UUID) IS
  'Valide un retour : réduit commande_items, recalcul commandes.montant_total, ajuste facture, gère décaissement.';

COMMENT ON FUNCTION process_retour(UUID, UUID, JSONB, TEXT, UUID) IS
  'Traite un retour direct : réduit commande_items, recalcul commandes.montant_total, ajuste facture, gère décaissement.';
