-- Migration: Fix process_echange - handle full quantity return
-- Description: When all quantity is returned in an exchange, the UPDATE would
-- violate the CHECK (quantite > 0) constraint. We must DELETE instead.
-- Created: 2026-04-13

CREATE OR REPLACE FUNCTION process_echange(
  p_facture_id UUID,
  p_commande_id UUID,
  p_items_retournes JSONB,
  p_items_ajoutes JSONB,
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
  v_echange_id UUID;
  v_item JSONB;
  v_commande_item RECORD;
  v_total_retourne INTEGER := 0;
  v_total_ajoute INTEGER := 0;
  v_difference INTEGER := 0;
  v_facture RECORD;
  v_new_montant_total INTEGER;
  v_new_montant_paye INTEGER;
  v_new_montant_restant INTEGER;
  v_new_statut TEXT;
  v_decaissement_id UUID;
  v_nouveau_ci_id UUID;
  v_montant_a_rembourser INTEGER := 0;
  v_qte_retournee INTEGER;
  v_qte_restante INTEGER;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Vous devez être connecté pour effectuer un échange.';
  END IF;

  SELECT * INTO v_caller_profile FROM profiles WHERE id = v_caller_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profil non trouvé.'; END IF;

  IF v_caller_profile.role NOT IN ('comptoir', 'gerant', 'patron') THEN
    RAISE EXCEPTION 'Accès refusé.';
  END IF;

  IF v_caller_profile.actif <> true THEN
    RAISE EXCEPTION 'Votre compte est désactivé.';
  END IF;

  SELECT * INTO v_facture FROM factures WHERE id = p_facture_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Facture non trouvée.'; END IF;

  IF v_facture.etablissement_id <> p_etablissement_id THEN
    RAISE EXCEPTION 'Établissement non correspondant.';
  END IF;

  -- 1. TRAITEMENT DES ARTICLES RETOURNÉS
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items_retournes)
  LOOP
    SELECT * INTO v_commande_item
    FROM commande_items
    WHERE id = (v_item->>'commande_item_id')::UUID;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Article de commande non trouvé: %', v_item->>'commande_item_id';
    END IF;

    v_qte_retournee := (v_item->>'quantite_retournee')::INTEGER;

    IF v_qte_retournee > v_commande_item.quantite THEN
      RAISE EXCEPTION 'Quantité retournée (%) dépasse la quantité commandée (%) pour %',
        v_qte_retournee, v_commande_item.quantite, v_commande_item.nom_produit;
    END IF;

    v_total_retourne := v_total_retourne + v_qte_retournee * (v_item->>'prix_unitaire')::INTEGER;

    v_qte_restante := v_commande_item.quantite - v_qte_retournee;

    IF v_qte_restante = 0 THEN
      -- Supprimer complètement l'article (retour total)
      DELETE FROM commande_items WHERE id = (v_item->>'commande_item_id')::UUID;
    ELSE
      -- Réduire la quantité (reste > 0, donc CHECK validé)
      UPDATE commande_items
      SET quantite = v_qte_restante,
          montant_ligne = v_qte_restante * prix_unitaire
      WHERE id = (v_item->>'commande_item_id')::UUID;
    END IF;

    -- Incrémenter le stock du produit retourné
    INSERT INTO mouvements_stock (
      produit_id, type, quantite, reference, type_reference,
      utilisateur_id, etablissement_id
    )
    VALUES (
      (v_item->>'produit_id')::UUID,
      'entree',
      v_qte_retournee,
      'ECH-pending',
      'echange',
      v_caller_id,
      p_etablissement_id
    );

    UPDATE stocks
    SET quantite_actuelle = quantite_actuelle + v_qte_retournee,
        derniere_mise_a_jour = NOW()
    WHERE produit_id = (v_item->>'produit_id')::UUID;
  END LOOP;

  -- 2. TRAITEMENT DES ARTICLES AJOUTÉS
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items_ajoutes)
  LOOP
    v_total_ajoute := v_total_ajoute +
      (v_item->>'quantite')::INTEGER * (v_item->>'prix_unitaire')::INTEGER;

    INSERT INTO commande_items (
      commande_id, produit_id, nom_produit, quantite,
      prix_unitaire, montant_ligne
    )
    VALUES (
      p_commande_id,
      (v_item->>'produit_id')::UUID,
      (v_item->>'nom_produit')::TEXT,
      (v_item->>'quantite')::INTEGER,
      (v_item->>'prix_unitaire')::INTEGER,
      (v_item->>'quantite')::INTEGER * (v_item->>'prix_unitaire')::INTEGER
    )
    RETURNING id INTO v_nouveau_ci_id;

    INSERT INTO mouvements_stock (
      produit_id, type, quantite, reference, type_reference,
      utilisateur_id, etablissement_id
    )
    VALUES (
      (v_item->>'produit_id')::UUID,
      'sortie',
      (v_item->>'quantite')::INTEGER,
      'ECH-pending',
      'echange',
      v_caller_id,
      p_etablissement_id
    );

    UPDATE stocks
    SET quantite_actuelle = GREATEST(0, quantite_actuelle - (v_item->>'quantite')::INTEGER),
        derniere_mise_a_jour = NOW()
    WHERE produit_id = (v_item->>'produit_id')::UUID;
  END LOOP;

  -- 3. ENREGISTRER L'ÉCHANGE
  v_difference := v_total_ajoute - v_total_retourne;

  INSERT INTO echanges (
    facture_id, commande_id,
    montant_retourne, montant_ajoute, difference_montant,
    motif, utilisateur_id, etablissement_id
  )
  VALUES (
    p_facture_id, p_commande_id,
    v_total_retourne, v_total_ajoute, v_difference,
    p_motif, v_caller_id, p_etablissement_id
  )
  RETURNING id INTO v_echange_id;

  -- Mettre à jour les références des mouvements
  UPDATE mouvements_stock
  SET reference = 'ECH-' || v_echange_id::TEXT
  WHERE reference = 'ECH-pending'
    AND etablissement_id = p_etablissement_id
    AND date_creation >= NOW() - INTERVAL '10 seconds';

  -- Insérer les items sortants
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items_retournes)
  LOOP
    INSERT INTO echange_items_sortants (
      echange_id, commande_item_id, produit_id, nom_produit,
      quantite_retournee, prix_unitaire, montant_ligne
    )
    VALUES (
      v_echange_id,
      (v_item->>'commande_item_id')::UUID,
      (v_item->>'produit_id')::UUID,
      (v_item->>'nom_produit')::TEXT,
      (v_item->>'quantite_retournee')::INTEGER,
      (v_item->>'prix_unitaire')::INTEGER,
      (v_item->>'quantite_retournee')::INTEGER * (v_item->>'prix_unitaire')::INTEGER
    );
  END LOOP;

  -- Insérer les items entrants
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items_ajoutes)
  LOOP
    INSERT INTO echange_items_entrants (
      echange_id, produit_id, nom_produit,
      quantite_ajoutee, prix_unitaire, montant_ligne
    )
    VALUES (
      v_echange_id,
      (v_item->>'produit_id')::UUID,
      (v_item->>'nom_produit')::TEXT,
      (v_item->>'quantite')::INTEGER,
      (v_item->>'prix_unitaire')::INTEGER,
      (v_item->>'quantite')::INTEGER * (v_item->>'prix_unitaire')::INTEGER
    );
  END LOOP;

  -- 4. AJUSTEMENT DE LA FACTURE
  UPDATE commandes
  SET montant_total = (
    SELECT COALESCE(SUM(montant_ligne), 0)
    FROM commande_items
    WHERE commande_id = p_commande_id
  )
  WHERE id = p_commande_id;

  v_new_montant_total := (
    SELECT COALESCE(SUM(montant_ligne), 0)
    FROM commande_items
    WHERE commande_id = p_commande_id
  );

  IF v_facture.montant_paye > v_new_montant_total THEN
    v_montant_a_rembourser := v_facture.montant_paye - v_new_montant_total;
    v_new_montant_paye := v_new_montant_total;
  ELSE
    v_new_montant_paye := v_facture.montant_paye;
  END IF;

  v_new_montant_restant := v_new_montant_total - v_new_montant_paye;

  IF v_new_montant_total = 0 THEN
    v_new_statut := 'payee';
  ELSIF v_new_montant_restant <= 0 THEN
    v_new_statut := 'payee';
    v_new_montant_restant := 0;
  ELSIF v_new_montant_paye = 0 THEN
    v_new_statut := 'en_attente_paiement';
  ELSE
    v_new_statut := 'partiellement_payee';
  END IF;

  UPDATE factures SET
    montant_total = v_new_montant_total,
    montant_paye = v_new_montant_paye,
    montant_restant = v_new_montant_restant,
    statut = v_new_statut
  WHERE id = p_facture_id;

  IF v_montant_a_rembourser > 0 THEN
    INSERT INTO encaissements (
      facture_id, montant, mode_paiement, reference,
      utilisateur_id, date_encaissement, etablissement_id
    )
    VALUES (
      p_facture_id,
      -v_montant_a_rembourser,
      'especes',
      'DECAIS-ECH-' || v_echange_id::TEXT,
      v_caller_id,
      NOW(),
      p_etablissement_id
    )
    RETURNING id INTO v_decaissement_id;
  END IF;

  RETURN json_build_object(
    'success', true,
    'echange_id', v_echange_id,
    'montant_retourne', v_total_retourne,
    'montant_ajoute', v_total_ajoute,
    'difference', v_difference,
    'montant_a_payer', GREATEST(0, -v_difference),
    'montant_a_rembourser', v_montant_a_rembourser,
    'decaissement_id', v_decaissement_id
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erreur lors du traitement de l''échange: %', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION process_echange(UUID, UUID, JSONB, JSONB, TEXT, UUID) TO authenticated;

COMMENT ON FUNCTION process_echange(UUID, UUID, JSONB, JSONB, TEXT, UUID) IS
  'Traite un échange : retourne des articles, en ajoute de nouveaux, ajuste stock et facture. Gère correctement le retour total d''un article (DELETE au lieu de UPDATE avec quantite=0).';
