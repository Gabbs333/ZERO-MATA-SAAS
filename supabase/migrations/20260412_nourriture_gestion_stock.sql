-- Migration: Gestion du stock optionnelle pour la catégorie nourriture
-- Description: Le stock n'est pas obligatoire pour les produits de type nourriture (repas, combos).
-- Le prix d'achat est défini uniquement via un pourcentage personnalisable du prix de vente.
-- Created: 2026-04-12

-- ============================================================================
-- PARTIE 1 : Colonne gestion_stock sur produits
-- ============================================================================

ALTER TABLE produits
ADD COLUMN IF NOT EXISTS gestion_stock BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN produits.gestion_stock IS 'Indique si le produit nécessite un suivi de stock. Faux pour les repas/nourriture.';

-- Mettre à jour les produits existants : nourriture → pas de gestion de stock
UPDATE produits SET gestion_stock = false WHERE categorie = 'nourriture';

-- ============================================================================
-- PARTIE 2 : Trigger pour forcer gestion_stock = false pour nourriture
-- ============================================================================

CREATE OR REPLACE FUNCTION set_gestion_stock_from_categorie()
RETURNS TRIGGER AS $$
BEGIN
  -- Si la catégorie est 'nourriture', désactiver la gestion de stock
  IF NEW.categorie = 'nourriture' THEN
    NEW.gestion_stock := false;
    -- Le prix d'achat doit être défini par pourcentage, pas en valeur fixe
    -- On garde prix_achat comme valeur calculée, mais on s'assure que cout_moyen_pourcentage est renseigné
    IF NEW.cout_moyen_pourcentage IS NULL THEN
      NEW.cout_moyen_pourcentage := COALESCE(
        (SELECT cout_moyen_pourcentage FROM etablissements WHERE id = NEW.etablissement_id),
        30  -- 30% par défaut pour la nourriture
      );
    END IF;
    -- Recalculer le prix d'achat basé sur le pourcentage
    NEW.prix_achat := ROUND(NEW.prix_vente * NEW.cout_moyen_pourcentage / 100.0);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_gestion_stock_from_categorie ON produits;

CREATE TRIGGER trigger_set_gestion_stock_from_categorie
  BEFORE INSERT OR UPDATE ON produits
  FOR EACH ROW
  EXECUTE FUNCTION set_gestion_stock_from_categorie();

-- ============================================================================
-- PARTIE 3 : Mise à jour du trigger de validation de commande
-- (Ignore le stock pour les produits sans gestion de stock)
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_commande_validation()
RETURNS TRIGGER AS $$
DECLARE
  v_item RECORD;
  v_stock RECORD;
  v_produit RECORD;
  v_user_id UUID;
BEGIN
  IF NEW.statut = 'validee' AND (OLD.statut IS NULL OR OLD.statut != 'validee') THEN

    v_user_id := COALESCE(NEW.validateur_id, NEW.serveuse_id);

    FOR v_item IN SELECT * FROM commande_items WHERE commande_id = NEW.id
    LOOP
      -- Vérifier si le produit nécessite une gestion de stock
      SELECT * INTO v_produit FROM produits WHERE id = v_item.produit_id;

      IF v_produit.gestion_stock = true THEN
        -- Vérification et déduction du stock (comportement normal)
        SELECT * INTO v_stock FROM stocks WHERE produit_id = v_item.produit_id;

        IF v_stock IS NULL THEN
          RAISE EXCEPTION 'Stock record not found for product %', v_item.nom_produit;
        END IF;

        IF v_stock.quantite_actuelle < v_item.quantite THEN
          RAISE EXCEPTION 'Stock insuffisant pour le produit %: disponible %, demandé %',
            v_item.nom_produit, v_stock.quantite_actuelle, v_item.quantite;
        END IF;

        UPDATE stocks
        SET quantite_actuelle = quantite_actuelle - v_item.quantite,
            derniere_mise_a_jour = NOW()
        WHERE produit_id = v_item.produit_id;

        INSERT INTO mouvements_stock (
          produit_id, etablissement_id, type, quantite,
          type_reference, reference, utilisateur_id, date_creation
        )
        VALUES (
          v_item.produit_id, NEW.etablissement_id, 'sortie', v_item.quantite,
          'commande', NEW.id::TEXT, v_user_id, NOW()
        );
      -- ELSE : produit sans gestion de stock (nourriture) → on ne fait rien
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PARTIE 4 : Mise à jour de validate_commande() (version RPC directe)
-- Au cas où le trigger ne serait pas actif, on met aussi à jour la RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_commande(
  p_commande_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_commande RECORD;
  v_item RECORD;
  v_stock RECORD;
  v_produit RECORD;
  v_result JSONB;
BEGIN
  -- Vérifier que la commande existe et est en attente
  SELECT * INTO v_commande FROM commandes WHERE id = p_commande_id;

  IF v_commande.id IS NULL THEN
    RAISE EXCEPTION 'Commande non trouvée.';
  END IF;

  IF v_commande.statut != 'en_attente' THEN
    RAISE EXCEPTION 'La commande n''est pas en attente de validation.';
  END IF;

  -- Vérifier le stock pour chaque article (sauf nourriture)
  FOR v_item IN SELECT * FROM commande_items WHERE commande_id = p_commande_id
  LOOP
    SELECT * INTO v_produit FROM produits WHERE id = v_item.produit_id;

    IF v_produit.gestion_stock = true THEN
      SELECT * INTO v_stock FROM stocks WHERE produit_id = v_item.produit_id;

      IF v_stock IS NULL OR v_stock.quantite_actuelle < v_item.quantite THEN
        RAISE EXCEPTION 'Stock insuffisant pour le produit %: disponible %, demandé %',
          v_item.nom_produit, COALESCE(v_stock.quantite_actuelle, 0), v_item.quantite;
      END IF;
    END IF;
  END LOOP;

  -- Déduire le stock (sauf nourriture) et créer les mouvements
  FOR v_item IN SELECT * FROM commande_items WHERE commande_id = p_commande_id
  LOOP
    SELECT * INTO v_produit FROM produits WHERE id = v_item.produit_id;

    IF v_produit.gestion_stock = true THEN
      UPDATE stocks
      SET quantite_actuelle = quantite_actuelle - v_item.quantite,
          derniere_mise_a_jour = NOW()
      WHERE produit_id = v_item.produit_id;

      INSERT INTO mouvements_stock (
        produit_id, type, quantite, reference, type_reference,
        utilisateur_id, etablissement_id
      )
      VALUES (
        v_item.produit_id, 'sortie', v_item.quantite,
        p_commande_id::TEXT, 'commande',
        auth.uid(), v_commande.etablissement_id
      );
    END IF;
  END LOOP;

  -- Mettre à jour la commande
  UPDATE commandes
  SET statut = 'validee',
      date_validation = NOW(),
      validateur_id = auth.uid()
  WHERE id = p_commande_id;

  -- Mettre à jour la table (reste occupée)
  UPDATE tables
  SET statut = 'occupee', derniere_mise_a_jour = NOW()
  WHERE id = v_commande.table_id;

  -- Créer la facture
  INSERT INTO factures (
    commande_id, montant_total, montant_paye, montant_restant,
    statut, etablissement_id, date_generation
  )
  VALUES (
    p_commande_id, v_commande.montant_total, 0, v_commande.montant_total,
    'en_attente_paiement', v_commande.etablissement_id, NOW()
  );

  v_result := jsonb_build_object(
    'success', true,
    'commande_id', p_commande_id,
    'message', 'Commande validée avec succès.'
  );

  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    v_result := jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
    RETURN v_result;
END;
$$;

-- ============================================================================
-- PARTIE 5 : Mise à jour de adjust_stock_from_product pour ignorer nourriture
-- ============================================================================

CREATE OR REPLACE FUNCTION adjust_stock_from_product(
  p_produit_id UUID,
  p_nouvelle_quantite INTEGER,
  p_motif TEXT DEFAULT 'Ajustement manuel'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_profile RECORD;
  v_produit RECORD;
  v_stock RECORD;
  v_ancienne_quantite INTEGER;
  v_difference INTEGER;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Vous devez être connecté.';
  END IF;

  SELECT * INTO v_caller_profile FROM profiles WHERE id = v_caller_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profil non trouvé.';
  END IF;

  IF v_caller_profile.role NOT IN ('gerant', 'patron') THEN
    RAISE EXCEPTION 'Accès refusé.';
  END IF;

  -- Vérifier si le produit gère le stock
  SELECT * INTO v_produit FROM produits WHERE id = p_produit_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produit non trouvé.';
  END IF;

  IF v_produit.gestion_stock = false THEN
    RAISE EXCEPTION 'Ce produit (catégorie %) ne gère pas de stock. L''ajustement n''est pas nécessaire.', v_produit.categorie;
  END IF;

  IF p_nouvelle_quantite < 0 THEN
    RAISE EXCEPTION 'La quantité ne peut pas être négative.';
  END IF;

  SELECT * INTO v_stock
  FROM stocks
  WHERE produit_id = p_produit_id
    AND etablissement_id = v_caller_profile.etablissement_id;

  IF NOT FOUND THEN
    INSERT INTO stocks (produit_id, quantite_actuelle, etablissement_id)
    VALUES (p_produit_id, p_nouvelle_quantite, v_caller_profile.etablissement_id)
    RETURNING * INTO v_stock;

    v_ancienne_quantite := 0;
    v_difference := p_nouvelle_quantite;
  ELSE
    v_ancienne_quantite := v_stock.quantite_actuelle;
    v_difference := p_nouvelle_quantite - v_ancienne_quantite;

    UPDATE stocks
    SET quantite_actuelle = p_nouvelle_quantite,
        derniere_mise_a_jour = NOW()
    WHERE produit_id = p_produit_id
      AND etablissement_id = v_caller_profile.etablissement_id;
  END IF;

  IF v_difference != 0 THEN
    INSERT INTO mouvements_stock (
      produit_id, type, quantite, reference, type_reference,
      utilisateur_id, etablissement_id
    )
    VALUES (
      p_produit_id,
      CASE WHEN v_difference > 0 THEN 'entree' ELSE 'sortie' END,
      ABS(v_difference),
      'ADJ-' || TO_CHAR(NOW(), 'YYYYMMDDHH24MISS'),
      'ajustement',
      v_caller_id,
      v_caller_profile.etablissement_id
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'ancienne_quantite', v_ancienne_quantite,
    'nouvelle_quantite', p_nouvelle_quantite,
    'difference', v_difference
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erreur lors de l''ajustement du stock: %', SQLERRM;
END;
$$;

-- ============================================================================
-- PARTIE 6 : Mise à jour des fonctions de retour pour ignorer nourriture
-- ============================================================================

-- Mise à jour de valider_retour_en_attente : ne pas incrémenter le stock pour nourriture
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
  v_new_montant_total INTEGER;
  v_new_montant_paye INTEGER;
  v_new_montant_restant INTEGER;
  v_new_statut TEXT;
  v_decaissement_id UUID;
  v_pending_count INTEGER;
  v_montant_a_rembourser INTEGER := 0;
  v_produit RECORD;
BEGIN
  v_caller_id := auth.uid();
  SELECT * INTO v_caller_profile FROM profiles WHERE id = v_caller_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profil non trouvé.';
  END IF;

  IF v_caller_profile.role NOT IN ('patron', 'gerant') THEN
    RAISE EXCEPTION 'Accès refusé. Seul le patron ou le gérant peut valider des retours.';
  END IF;

  IF v_caller_profile.actif <> true THEN
    RAISE EXCEPTION 'Votre compte est désactivé.';
  END IF;

  SELECT COUNT(*) INTO v_pending_count
  FROM retour_items_en_attente
  WHERE facture_id = p_facture_id;

  IF v_pending_count = 0 THEN
    RAISE EXCEPTION 'Aucun retour en attente pour cette facture.';
  END IF;

  SELECT * INTO v_facture FROM factures WHERE id = p_facture_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Facture non trouvée.';
  END IF;

  IF v_facture.etablissement_id <> v_caller_profile.etablissement_id THEN
    RAISE EXCEPTION 'Établissement non correspondant.';
  END IF;

  SELECT SUM(montant_ligne) INTO v_total_retour
  FROM retour_items_en_attente WHERE facture_id = p_facture_id;

  IF v_total_retour IS NULL OR v_total_retour = 0 THEN
    RAISE EXCEPTION 'Le montant total du retour doit être supérieur à 0.';
  END IF;

  INSERT INTO retours (
    facture_id, commande_id, montant_total_retour,
    motif, utilisateur_id, etablissement_id
  )
  SELECT p_facture_id, commande_id, v_total_retour, motif, v_caller_id, etablissement_id
  FROM retour_items_en_attente WHERE facture_id = p_facture_id LIMIT 1
  RETURNING id INTO v_retour_id;

  FOR v_pending_items IN
    SELECT * FROM retour_items_en_attente WHERE facture_id = p_facture_id
  LOOP
    INSERT INTO retour_items (
      retour_id, commande_item_id, produit_id, nom_produit,
      quantite_retournee, prix_unitaire, montant_ligne
    )
    VALUES (
      v_retour_id, v_pending_items.commande_item_id, v_pending_items.produit_id,
      v_pending_items.nom_produit, v_pending_items.quantite_retournee,
      v_pending_items.prix_unitaire, v_pending_items.montant_ligne
    );

    -- Vérifier si le produit gère le stock avant d'incrémenter
    SELECT * INTO v_produit FROM produits WHERE id = v_pending_items.produit_id;

    IF v_produit.gestion_stock = true THEN
      INSERT INTO mouvements_stock (
        produit_id, type, quantite, reference, type_reference,
        utilisateur_id, etablissement_id
      )
      VALUES (
        v_pending_items.produit_id, 'entree', v_pending_items.quantite_retournee,
        'RET-' || v_retour_id::TEXT, 'retour',
        v_caller_id, v_pending_items.etablissement_id
      );

      UPDATE stocks
      SET quantite_actuelle = quantite_actuelle + v_pending_items.quantite_retournee,
          derniere_mise_a_jour = NOW()
      WHERE produit_id = v_pending_items.produit_id;
    END IF;
  END LOOP;

  DELETE FROM retour_items_en_attente WHERE facture_id = p_facture_id;

  v_new_montant_total := GREATEST(0, v_facture.montant_total - v_total_retour);

  IF v_facture.montant_paye > v_new_montant_total THEN
    v_montant_a_rembourser := v_facture.montant_paye - v_new_montant_total;
    v_new_montant_paye := v_new_montant_total;
  ELSE
    v_new_montant_paye := v_facture.montant_paye;
  END IF;

  v_new_montant_restant := v_new_montant_total - v_new_montant_paye;

  IF v_new_montant_total = 0 THEN
    v_new_statut := 'payee';
  ELSIF v_new_montant_restant = 0 THEN
    v_new_statut := 'payee';
  ELSIF v_new_montant_paye = 0 THEN
    v_new_statut := 'en_attente_paiement';
  ELSE
    v_new_statut := 'partiellement_payee';
  END IF;

  UPDATE factures SET
    montant_total = v_new_montant_total,
    montant_paye = v_new_montant_paye,
    montant_restant = v_new_montant_restant,
    statut = v_new_statut,
    statut_retour = CASE WHEN v_new_montant_total = 0 THEN 'retour_total' ELSE 'retour_partiel' END
  WHERE id = p_facture_id;

  IF v_montant_a_rembourser > 0 THEN
    INSERT INTO encaissements (
      facture_id, montant, mode_paiement, reference,
      utilisateur_id, date_encaissement, etablissement_id
    )
    VALUES (
      p_facture_id, -v_montant_a_rembourser, 'especes',
      'DECAIS-' || v_retour_id::TEXT,
      v_caller_id, NOW(), v_caller_profile.etablissement_id
    )
    RETURNING id INTO v_decaissement_id;
  END IF;

  RETURN json_build_object(
    'success', true,
    'retour_id', v_retour_id,
    'montant_total_retour', v_total_retour,
    'montant_rembourse', v_montant_a_rembourser,
    'decaissement_id', v_decaissement_id
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erreur lors de la validation du retour: %', SQLERRM;
END;
$$;

-- ============================================================================
-- PARTIE 7 : Mise à jour de process_retour (idem)
-- ============================================================================

CREATE OR REPLACE FUNCTION process_retour(
  p_facture_id UUID,
  p_commande_id UUID,
  p_retour_items JSONB,
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
  v_produit RECORD;
  v_total_retour INTEGER := 0;
  v_facture RECORD;
  v_new_montant_total INTEGER;
  v_new_montant_paye INTEGER;
  v_new_montant_restant INTEGER;
  v_new_statut TEXT;
  v_decaissement_id UUID;
  v_montant_a_rembourser INTEGER := 0;
BEGIN
  v_caller_id := auth.uid();
  SELECT * INTO v_caller_profile FROM profiles WHERE id = v_caller_id;

  IF v_caller_profile.role NOT IN ('patron', 'gerant') THEN
    RAISE EXCEPTION 'Accès refusé.';
  END IF;

  IF v_caller_profile.actif <> true THEN
    RAISE EXCEPTION 'Votre compte est désactivé.';
  END IF;

  SELECT * INTO v_facture FROM factures WHERE id = p_facture_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Facture non trouvée.';
  END IF;

  IF v_facture.etablissement_id <> p_etablissement_id THEN
    RAISE EXCEPTION 'Établissement non correspondant.';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_retour_items)
  LOOP
    SELECT * INTO v_commande_item
    FROM commande_items
    WHERE id = (v_item->>'commande_item_id')::UUID;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Article de commande non trouvé: %', v_item->>'commande_item_id';
    END IF;

    IF (v_item->>'quantite_retournee')::INTEGER > v_commande_item.quantite THEN
      RAISE EXCEPTION 'Quantité retournée dépasse la quantité originale pour %', v_commande_item.nom_produit;
    END IF;

    v_total_retour := v_total_retour + (v_item->>'quantite_retournee')::INTEGER * (v_item->>'prix_unitaire')::INTEGER;
  END LOOP;

  IF v_total_retour = 0 THEN
    RAISE EXCEPTION 'Le montant total du retour doit être supérieur à 0.';
  END IF;

  INSERT INTO retours (
    facture_id, commande_id, montant_total_retour,
    motif, utilisateur_id, etablissement_id
  )
  VALUES (p_facture_id, p_commande_id, v_total_retour, p_motif, v_caller_id, p_etablissement_id)
  RETURNING id INTO v_retour_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_retour_items)
  LOOP
    INSERT INTO retour_items (
      retour_id, commande_item_id, produit_id, nom_produit,
      quantite_retournee, prix_unitaire, montant_ligne
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

    -- Vérifier si le produit gère le stock
    SELECT * INTO v_produit FROM produits WHERE id = (v_item->>'produit_id')::UUID;

    IF v_produit.gestion_stock = true THEN
      INSERT INTO mouvements_stock (
        produit_id, type, quantite, reference, type_reference,
        utilisateur_id, etablissement_id
      )
      VALUES (
        (v_item->>'produit_id')::UUID, 'entree',
        (v_item->>'quantite_retournee')::INTEGER,
        'RET-' || v_retour_id::TEXT, 'retour',
        v_caller_id, p_etablissement_id
      );

      UPDATE stocks
      SET quantite_actuelle = quantite_actuelle + (v_item->>'quantite_retournee')::INTEGER,
          derniere_mise_a_jour = NOW()
      WHERE produit_id = (v_item->>'produit_id')::UUID;
    END IF;
  END LOOP;

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

  UPDATE factures SET
    montant_total = v_new_montant_total,
    montant_paye = v_new_montant_paye,
    montant_restant = v_new_montant_restant,
    statut = v_new_statut,
    statut_retour = CASE WHEN v_new_montant_total = 0 THEN 'retour_total' ELSE 'retour_partiel' END
  WHERE id = p_facture_id;

  IF v_montant_a_rembourser > 0 THEN
    INSERT INTO encaissements (
      facture_id, montant, mode_paiement, reference,
      utilisateur_id, date_encaissement, etablissement_id
    )
    VALUES (
      p_facture_id, -v_montant_a_rembourser, 'especes',
      'DECAIS-' || v_retour_id::TEXT,
      v_caller_id, NOW(), p_etablissement_id
    )
    RETURNING id INTO v_decaissement_id;
  END IF;

  RETURN json_build_object(
    'success', true,
    'retour_id', v_retour_id,
    'montant_total_retour', v_total_retour,
    'montant_rembourse', v_montant_a_rembourser,
    'decaissement_id', v_decaissement_id
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erreur lors du traitement du retour: %', SQLERRM;
END;
$$;

-- ============================================================================
-- PARTIE 8 : PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION validate_commande(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION valider_retour_en_attente(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION process_retour(UUID, UUID, JSONB, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION adjust_stock_from_product(UUID, INTEGER, TEXT) TO authenticated;

-- ============================================================================
-- PARTIE 9 : COMMENTAIRES
-- ============================================================================

COMMENT ON COLUMN produits.gestion_stock IS 'Indique si le produit nécessite un suivi de stock. Faux pour les repas (nourriture).';
COMMENT ON FUNCTION set_gestion_stock_from_categorie IS 'Désactive automatiquement la gestion de stock pour la catégorie nourriture et force le prix d''achat par pourcentage.';
COMMENT ON FUNCTION handle_commande_validation IS 'Valide une commande : vérifie et déduit le stock uniquement pour les produits avec gestion_stock = true.';
