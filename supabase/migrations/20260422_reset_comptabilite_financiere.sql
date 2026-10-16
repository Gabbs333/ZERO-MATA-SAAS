-- Migration: Fonction de réinitialisation financière et comptable (Reset comptable)
-- Description: Supprime toutes les transactions, commandes, factures, encaissements, 
-- mouvements de caisse et mouvements de stock, tout en préservant les produits, 
-- les stocks actuels, les tarifs dynamiques, les tables, les clients et les utilisateurs.

CREATE OR REPLACE FUNCTION reset_comptabilite_financiere()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
  v_etablissement_id UUID;
BEGIN
  v_user_id := auth.uid();

  -- Vérifier le rôle de l'utilisateur (seul le patron peut effectuer cette action)
  SELECT role, etablissement_id INTO v_user_role, v_etablissement_id
  FROM profiles
  WHERE id = v_user_id;

  IF v_user_role <> 'patron' THEN
    RAISE EXCEPTION 'Accès refusé. Seul le patron peut effectuer cette réinitialisation.';
  END IF;

  IF v_etablissement_id IS NULL THEN
    RAISE EXCEPTION 'Établissement non trouvé pour cet utilisateur.';
  END IF;

  -- 1. Supprimer les encaissements
  DELETE FROM encaissements 
  WHERE etablissement_id = v_etablissement_id 
     OR facture_id IN (SELECT id FROM factures WHERE etablissement_id = v_etablissement_id);

  -- 2. Supprimer les factures
  DELETE FROM factures WHERE etablissement_id = v_etablissement_id;

  -- 3. Supprimer les items de commandes et les commandes
  DELETE FROM commande_items 
  WHERE commande_id IN (SELECT id FROM commandes WHERE etablissement_id = v_etablissement_id);

  DELETE FROM commandes WHERE etablissement_id = v_etablissement_id;

  -- 4. Supprimer les mouvements de caisse
  DELETE FROM mouvements_caisse WHERE etablissement_id = v_etablissement_id;

  -- 5. Supprimer les ravitaillements et leurs items
  DELETE FROM ravitaillement_items 
  WHERE ravitaillement_id IN (SELECT id FROM ravitaillements WHERE etablissement_id = v_etablissement_id);

  DELETE FROM ravitaillements WHERE etablissement_id = v_etablissement_id;

  -- 6. Supprimer les mouvements de stock historiques
  DELETE FROM mouvements_stock WHERE etablissement_id = v_etablissement_id;

  -- NOTE IMPORTANTE : Les tables produits, stocks actuels, tarifs_specifiques, 
  -- tables, clients et profiles sont STRICTEMENT PRÉSERVÉES.

  RETURN json_build_object(
    'success', true,
    'message', 'Réinitialisation financière et comptable effectuée avec succès. Le stock et les catalogues sont intacts.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION reset_comptabilite_financiere() TO authenticated;
