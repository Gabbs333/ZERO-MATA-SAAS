-- Migration: RPC pour appliquer le pourcentage de coût global à tous les produits
-- Description: Met à jour le pourcentage par défaut de l'établissement et recalcule
-- le prix d'achat de tous les produits en une seule transaction atomique.
-- Created: 2026-04-13

CREATE OR REPLACE FUNCTION apply_cout_global(
  p_pourcentage INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_profile RECORD;
  v_etablissement_id UUID;
  v_count INTEGER;
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
    RAISE EXCEPTION 'Accès refusé. Seul le gérant ou le patron peut modifier ce paramètre.';
  END IF;

  v_etablissement_id := v_caller_profile.etablissement_id;
  IF v_etablissement_id IS NULL THEN
    RAISE EXCEPTION 'Aucun établissement associé à votre compte.';
  END IF;

  IF p_pourcentage < 0 OR p_pourcentage > 100 THEN
    RAISE EXCEPTION 'Le pourcentage doit être compris entre 0 et 100.';
  END IF;

  -- 1. Mettre à jour la valeur par défaut de l'établissement
  UPDATE etablissements
  SET cout_moyen_pourcentage = p_pourcentage,
      date_modification = NOW()
  WHERE id = v_etablissement_id;

  -- 2. Effacer les overrides individuels (tous les produits héritent du global)
  --    et recalculer le prix d'achat pour tous les produits
  UPDATE produits
  SET cout_moyen_pourcentage = NULL,
      prix_achat = ROUND(prix_vente * p_pourcentage / 100.0),
      date_modification = NOW()
  WHERE etablissement_id = v_etablissement_id
    AND actif = true;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN json_build_object(
    'success', true,
    'message', 'Pourcentage de ' || p_pourcentage || '% appliqué à ' || v_count || ' produits.',
    'produits_affectes', v_count,
    'pourcentage', p_pourcentage
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erreur lors de l''application du coût global: %', SQLERRM;
END;
$$;

-- Permissions
GRANT EXECUTE ON FUNCTION apply_cout_global(INTEGER) TO authenticated;

COMMENT ON FUNCTION apply_cout_global(INTEGER) IS
  'Applique un pourcentage de coût global à tous les produits de l''établissement. Efface les overrides individuels et recalcule tous les prix d''achat.';
