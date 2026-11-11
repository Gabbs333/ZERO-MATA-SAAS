-- Migration: Correctif de la réinitialisation comptable et financière
-- Description:
--   La réinitialisation supprimait `factures` avant les tables qui les
--   référencent (retours, échanges, retours en attente), ce qui violait
--   `retours_facture_id_fkey`.
--
--   Ordre de suppression corrigé (des feuilles vers les racines) :
--     retours en attente -> items retours -> retours
--     -> items échanges -> échanges
--     -> items opérations stock -> opérations stock
--     -> mouvements caisse -> encaissements -> factures
--     -> items commandes -> commandes
--     -> items ravitaillements -> ravitaillements
--     -> mouvements stock -> clôtures (caisse / stock)
--     -> libération des tables
--
--   Préservés : produits, stocks courants, tarifs dynamiques, tables (fiches),
--   clients, profils, établissement et paramètres.
-- Created: 2026-04-41

CREATE OR REPLACE FUNCTION public.reset_comptabilite_financiere()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_user_role TEXT;
  v_etab UUID;
  v_nb_commandes INTEGER := 0;
  v_nb_factures INTEGER := 0;
  v_nb_retours INTEGER := 0;
  v_nb_echanges INTEGER := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Non authentifié.';
  END IF;

  SELECT role, etablissement_id INTO v_user_role, v_etab
  FROM profiles
  WHERE id = v_user_id;

  IF NOT FOUND OR v_user_role IS DISTINCT FROM 'patron' THEN
    RAISE EXCEPTION 'Accès refusé. Seul le patron peut effectuer cette réinitialisation.';
  END IF;

  IF v_etab IS NULL THEN
    RAISE EXCEPTION 'Établissement non trouvé pour cet utilisateur.';
  END IF;

  -- 1. Retours en attente de validation -------------------------------------
  IF to_regclass('public.retour_items_en_attente') IS NOT NULL THEN
    DELETE FROM retour_items_en_attente WHERE etablissement_id = v_etab;
  END IF;

  -- 2. Retours validés (items d'abord : FK vers commande_items) --------------
  DELETE FROM retour_items
  WHERE retour_id IN (SELECT id FROM retours WHERE etablissement_id = v_etab);

  SELECT COUNT(*) INTO v_nb_retours FROM retours WHERE etablissement_id = v_etab;
  DELETE FROM retours WHERE etablissement_id = v_etab;

  -- 3. Échanges (items d'abord : FK vers commande_items) ---------------------
  DELETE FROM echange_items_sortants
  WHERE echange_id IN (SELECT id FROM echanges WHERE etablissement_id = v_etab);
  DELETE FROM echange_items_entrants
  WHERE echange_id IN (SELECT id FROM echanges WHERE etablissement_id = v_etab);

  SELECT COUNT(*) INTO v_nb_echanges FROM echanges WHERE etablissement_id = v_etab;
  DELETE FROM echanges WHERE etablissement_id = v_etab;

  -- 4. Opérations de stock (entrées / sorties / trocs) ----------------------
  IF to_regclass('public.operations_stock') IS NOT NULL THEN
    DELETE FROM operations_stock_lignes
    WHERE operation_id IN (SELECT id FROM operations_stock WHERE etablissement_id = v_etab);
    DELETE FROM operations_stock WHERE etablissement_id = v_etab;
  END IF;

  -- 5. Mouvements de caisse -------------------------------------------------
  DELETE FROM mouvements_caisse WHERE etablissement_id = v_etab;

  -- 6. Encaissements --------------------------------------------------------
  DELETE FROM encaissements
  WHERE etablissement_id = v_etab
     OR facture_id IN (SELECT id FROM factures WHERE etablissement_id = v_etab);

  -- 7. Factures -------------------------------------------------------------
  SELECT COUNT(*) INTO v_nb_factures FROM factures WHERE etablissement_id = v_etab;
  DELETE FROM factures WHERE etablissement_id = v_etab;

  -- 8. Commandes ------------------------------------------------------------
  SELECT COUNT(*) INTO v_nb_commandes FROM commandes WHERE etablissement_id = v_etab;

  DELETE FROM commande_items
  WHERE commande_id IN (SELECT id FROM commandes WHERE etablissement_id = v_etab);

  DELETE FROM commandes WHERE etablissement_id = v_etab;

  -- 9. Ravitaillements ------------------------------------------------------
  DELETE FROM ravitaillement_items
  WHERE ravitaillement_id IN (SELECT id FROM ravitaillements WHERE etablissement_id = v_etab);

  DELETE FROM ravitaillements WHERE etablissement_id = v_etab;

  -- 10. Mouvements de stock historiques ------------------------------------
  DELETE FROM mouvements_stock WHERE etablissement_id = v_etab;

  -- 11. Clôtures comptables ------------------------------------------------
  IF to_regclass('public.clotures_caisse') IS NOT NULL THEN
    DELETE FROM clotures_caisse WHERE etablissement_id = v_etab;
  END IF;

  IF to_regclass('public.clotures_stock_journalieres') IS NOT NULL THEN
    DELETE FROM clotures_stock_journalieres WHERE etablissement_id = v_etab;
  END IF;

  -- 12. Libérer les tables (les commandes qui les occupaient sont supprimées)
  UPDATE tables
  SET statut = 'libre',
      derniere_mise_a_jour = NOW()
  WHERE etablissement_id = v_etab
    AND statut <> 'libre';

  -- NOTE : produits, stocks courants, tarifs spécifiques, tables (fiches),
  -- clients, profils et paramètres sont STRICTEMENT PRÉSERVÉS.

  RETURN json_build_object(
    'success', true,
    'message', 'Réinitialisation financière et comptable effectuée avec succès. Le stock et les catalogues sont intacts.',
    'supprimes', json_build_object(
      'commandes', v_nb_commandes,
      'factures', v_nb_factures,
      'retours', v_nb_retours,
      'echanges', v_nb_echanges
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_comptabilite_financiere() TO authenticated;

COMMENT ON FUNCTION public.reset_comptabilite_financiere() IS
  'Purge les données comptables et financières de l''établissement (commandes, factures, encaissements, caisse, retours, échanges, opérations et clôtures) sans toucher aux produits, au stock courant, aux tarifs ni aux paramètres.';

NOTIFY pgrst, 'reload schema';
