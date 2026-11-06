-- Migration: Tarification dynamique appliquée aux échanges
-- Description:
--   1. (Re)définit public.get_prix_produit(produit, date) — source de vérité
--      pour les prix dynamiques (happy hours, week-ends, saisons, jours/heures).
--   2. process_echange v5 : les articles ajoutés en remplacement sont valorisés
--      au prix dynamique courant (et non plus au prix de base envoyé par le
--      client). Les articles retournés sont valorisés au prix réellement facturé
--      (commande_items.prix_unitaire).
-- Created: 2026-04-31

-- ============================================================================
-- 1. GET_PRIX_PRODUIT — suppression des surcharges existantes puis redéfinition
-- ============================================================================
-- La fonction n'était pas versionnée : on nettoie toutes les signatures
-- existantes pour éviter une ambiguïté d'appel (1 ou 2 arguments).

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'get_prix_produit'
  LOOP
    EXECUTE 'DROP FUNCTION ' || r.signature;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.get_prix_produit(
  p_produit_id UUID,
  p_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prix INTEGER;
  v_dow INTEGER;
  v_time TIME;
BEGIN
  v_dow := EXTRACT(DOW FROM p_at)::INTEGER; -- 0 = dimanche
  v_time := p_at::TIME;

  SELECT t.prix_vente
  INTO v_prix
  FROM tarifs_specifiques t
  WHERE t.produit_id = p_produit_id
    AND COALESCE(t.actif, true) = true
    AND (t.date_debut IS NULL OR t.date_debut::DATE <= p_at::DATE)
    AND (t.date_fin IS NULL OR t.date_fin::DATE >= p_at::DATE)
    AND (
      t.jours_semaine IS NULL
      OR array_length(t.jours_semaine, 1) IS NULL
      OR v_dow = ANY (t.jours_semaine)
    )
    AND (
      t.heure_debut IS NULL
      OR t.heure_fin IS NULL
      OR (t.heure_debut <= t.heure_fin AND v_time >= t.heure_debut AND v_time <= t.heure_fin)
      OR (t.heure_debut > t.heure_fin AND (v_time >= t.heure_debut OR v_time <= t.heure_fin))
    )
  ORDER BY COALESCE(t.priorite, 0) DESC, t.date_creation DESC
  LIMIT 1;

  RETURN v_prix; -- NULL si aucun tarif applicable → repli sur produits.prix_vente
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_prix_produit(UUID, TIMESTAMPTZ) TO authenticated;

COMMENT ON FUNCTION public.get_prix_produit(UUID, TIMESTAMPTZ) IS
  'Retourne le prix de vente applicable à un produit à un instant donné (tarifs spécifiques), NULL si aucun tarif ne s''applique.';

-- ============================================================================
-- 2. PROCESS_ECHANGE v5 — prix dynamiques côté serveur
-- ============================================================================

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
  v_produit RECORD;
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
  v_qte_ajoutee INTEGER;
  v_prix_ajoute INTEGER;
  v_ajouts_details JSONB := '[]'::jsonb;
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

  -- 1. ARTICLES RETOURNÉS (valorisés au prix réellement facturé)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items_retournes)
  LOOP
    SELECT * INTO v_commande_item
    FROM commande_items
    WHERE id = (v_item->>'commande_item_id')::UUID;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Article de commande non trouvé: %', v_item->>'commande_item_id';
    END IF;

    v_qte_retournee := (v_item->>'quantite_retournee')::INTEGER;

    IF v_qte_retournee IS NULL OR v_qte_retournee <= 0 THEN
      RAISE EXCEPTION 'Quantité retournée invalide pour %', v_commande_item.nom_produit;
    END IF;

    IF v_qte_retournee > v_commande_item.quantite THEN
      RAISE EXCEPTION 'Quantité retournée (%) dépasse la quantité commandée (%) pour %',
        v_qte_retournee, v_commande_item.quantite, v_commande_item.nom_produit;
    END IF;

    v_total_retourne := v_total_retourne + v_qte_retournee * v_commande_item.prix_unitaire;
    v_qte_restante := v_commande_item.quantite - v_qte_retournee;

    -- L'échange régularise l'article : la demande de retour en attente devient obsolète
    DELETE FROM retour_items_en_attente
    WHERE commande_item_id = (v_item->>'commande_item_id')::UUID
      AND etablissement_id = p_etablissement_id;

    -- Conserver la ligne à quantité 0 (intégrité FK retour_items / echange_items_sortants)
    UPDATE commande_items
    SET quantite = v_qte_restante,
        montant_ligne = v_qte_restante * prix_unitaire
    WHERE id = (v_item->>'commande_item_id')::UUID;

    INSERT INTO mouvements_stock (
      produit_id, type, quantite, reference, type_reference,
      utilisateur_id, etablissement_id
    )
    VALUES (
      v_commande_item.produit_id,
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
    WHERE produit_id = v_commande_item.produit_id;
  END LOOP;

  -- 2. ARTICLES AJOUTÉS (valorisés au prix dynamique courant)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items_ajoutes)
  LOOP
    v_qte_ajoutee := (v_item->>'quantite')::INTEGER;

    SELECT id, nom, prix_vente
    INTO v_produit
    FROM produits
    WHERE id = (v_item->>'produit_id')::UUID
      AND etablissement_id = p_etablissement_id;

    IF v_produit.id IS NULL THEN
      RAISE EXCEPTION 'Produit introuvable ou hors établissement.';
    END IF;

    IF v_qte_ajoutee IS NULL OR v_qte_ajoutee <= 0 THEN
      RAISE EXCEPTION 'Quantité invalide pour %', v_produit.nom;
    END IF;

    -- Prix dynamique (happy hours / week-end / saison / heures spécifiques)
    -- avec repli sécurisé si la fonction n'existe pas encore.
    v_prix_ajoute := v_produit.prix_vente;
    BEGIN
      v_prix_ajoute := COALESCE(public.get_prix_produit(v_produit.id, NOW()), v_produit.prix_vente);
    EXCEPTION WHEN undefined_function THEN
      v_prix_ajoute := v_produit.prix_vente;
    END;

    v_total_ajoute := v_total_ajoute + v_qte_ajoutee * v_prix_ajoute;

    INSERT INTO commande_items (
      commande_id, produit_id, nom_produit, quantite,
      prix_unitaire, montant_ligne
    )
    VALUES (
      p_commande_id, v_produit.id, v_produit.nom, v_qte_ajoutee,
      v_prix_ajoute, v_qte_ajoutee * v_prix_ajoute
    )
    RETURNING id INTO v_nouveau_ci_id;

    v_ajouts_details := v_ajouts_details || jsonb_build_object(
      'produit_id', v_produit.id,
      'nom_produit', v_produit.nom,
      'quantite', v_qte_ajoutee,
      'prix_unitaire', v_prix_ajoute,
      'montant_ligne', v_qte_ajoutee * v_prix_ajoute
    );

    INSERT INTO mouvements_stock (
      produit_id, type, quantite, reference, type_reference,
      utilisateur_id, etablissement_id
    )
    VALUES (
      v_produit.id, 'sortie', v_qte_ajoutee,
      'ECH-pending', 'echange', v_caller_id, p_etablissement_id
    );

    UPDATE stocks
    SET quantite_actuelle = GREATEST(0, quantite_actuelle - v_qte_ajoutee),
        derniere_mise_a_jour = NOW()
    WHERE produit_id = v_produit.id;
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

  -- Items sortants : prix réellement facturé sur la commande
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items_retournes)
  LOOP
    INSERT INTO echange_items_sortants (
      echange_id, commande_item_id, produit_id, nom_produit,
      quantite_retournee, prix_unitaire, montant_ligne
    )
    SELECT
      v_echange_id,
      ci.id,
      ci.produit_id,
      ci.nom_produit,
      (v_item->>'quantite_retournee')::INTEGER,
      ci.prix_unitaire,
      (v_item->>'quantite_retournee')::INTEGER * ci.prix_unitaire
    FROM commande_items ci
    WHERE ci.id = (v_item->>'commande_item_id')::UUID;
  END LOOP;

  -- Items entrants : prix dynamique résolu côté serveur
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_ajouts_details)
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
      (v_item->>'montant_ligne')::INTEGER
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
    v_new_montant_restant := 0;
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
  'Traite un échange : retourne des articles (prix facturé), ajoute des remplacements au prix dynamique courant, ajuste stock et facture, et supprime les demandes de retour en attente devenues obsolètes.';

NOTIFY pgrst, 'reload schema';
