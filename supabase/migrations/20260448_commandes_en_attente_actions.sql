-- Migration: Déblocage des commandes en attente (annulation, édition, ravitaillement express)
-- Description:
--   Une commande dont le stock est insuffisant ne peut pas être validée : le
--   trigger `handle_commande_validation` lève une exception et annule tout.
--   La commande restait alors indéfiniment dans le pipe, sans action possible.
--
--   Cette migration fournit les primitives manquantes :
--     1. `diagnostic_stock_commande(id)`  -> détail disponible / demandé / manque
--     2. `annuler_commande(id, motif)`    -> sort du pipe (statut 'annulee')
--     3. `modifier_commande_en_attente(id, items)` -> ajuste les lignes
--     4. `ravitailler_produit_express(produit, qte, commentaire)` -> entrée rapide
--
--   Toutes les actions sont réservées aux rôles comptoir / gérant / patron,
--   actifs, et à la même établissement que la commande. Elles sont refusées
--   dès que la commande n'est plus `en_attente` (après validation le stock est
--   déjà décrémenté et les factures générées).
--
--   Idempotente.
-- Created: 2026-04-48

-- ============================================================================
-- 0. TRACES D'ANNULATION / MODIFICATION
-- ============================================================================

ALTER TABLE public.commandes
  ADD COLUMN IF NOT EXISTS motif_annulation TEXT,
  ADD COLUMN IF NOT EXISTS date_annulation TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS annulee_par UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS derniere_modification TIMESTAMPTZ;

COMMENT ON COLUMN public.commandes.motif_annulation IS
  'Motif saisi lors de l''annulation d''une commande en attente.';

-- ============================================================================
-- 1. DIAGNOSTIC STOCK D'UNE COMMANDE
-- ============================================================================

CREATE OR REPLACE FUNCTION public.diagnostic_stock_commande(p_commande_id UUID)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_profile RECORD;
  v_commande RECORD;
  v_manques JSONB := '[]'::jsonb;
  v_ok BOOLEAN := TRUE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Non authentifié.';
  END IF;

  SELECT role, etablissement_id, actif INTO v_profile FROM profiles WHERE id = v_uid;
  IF NOT FOUND OR COALESCE(v_profile.actif, true) <> true THEN
    RAISE EXCEPTION 'Accès refusé.';
  END IF;

  SELECT * INTO v_commande FROM commandes WHERE id = p_commande_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Commande introuvable.';
  END IF;

  IF v_commande.etablissement_id IS DISTINCT FROM v_profile.etablissement_id
     AND v_profile.role <> 'patron' THEN
    RAISE EXCEPTION 'Commande d''un autre établissement.';
  END IF;

  SELECT
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'produit_id', ci.produit_id,
        'nom', ci.nom_produit,
        'categorie', p.categorie,
        'quantite', ci.quantite,
        'disponible', COALESCE(st.quantite_actuelle, 0),
        'manque', GREATEST(ci.quantite - COALESCE(st.quantite_actuelle, 0), 0)
      )
      ORDER BY ci.nom_produit
    ) FILTER (WHERE COALESCE(st.quantite_actuelle, 0) < ci.quantite), '[]'::jsonb),
    COALESCE(BOOL_AND(COALESCE(st.quantite_actuelle, 0) >= ci.quantite), TRUE)
  INTO v_manques, v_ok
  FROM commande_items ci
  JOIN produits p ON p.id = ci.produit_id
  LEFT JOIN LATERAL (
    SELECT s.quantite_actuelle
    FROM stocks s
    WHERE s.produit_id = ci.produit_id
    ORDER BY (s.etablissement_id = v_commande.etablissement_id) DESC, s.quantite_actuelle DESC
    LIMIT 1
  ) st ON TRUE
  WHERE ci.commande_id = p_commande_id
    AND COALESCE(p.gestion_stock, true) = TRUE;

  RETURN json_build_object(
    'commande_id', p_commande_id,
    'statut', v_commande.statut,
    'ok', v_ok,
    'manques', v_manques
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.diagnostic_stock_commande(UUID) TO authenticated;

-- ============================================================================
-- 2. ANNULATION D'UNE COMMANDE EN ATTENTE
-- ============================================================================

CREATE OR REPLACE FUNCTION public.annuler_commande(
  p_commande_id UUID,
  p_motif TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_profile RECORD;
  v_commande RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Non authentifié.';
  END IF;

  SELECT role, etablissement_id, actif INTO v_profile FROM profiles WHERE id = v_uid;
  IF NOT FOUND
     OR v_profile.role NOT IN ('comptoir', 'gerant', 'patron')
     OR COALESCE(v_profile.actif, true) <> true THEN
    RAISE EXCEPTION 'Accès refusé.';
  END IF;

  SELECT * INTO v_commande FROM commandes WHERE id = p_commande_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Commande introuvable.';
  END IF;

  IF v_commande.etablissement_id IS DISTINCT FROM v_profile.etablissement_id THEN
    RAISE EXCEPTION 'Commande d''un autre établissement.';
  END IF;

  IF v_commande.statut <> 'en_attente' THEN
    RAISE EXCEPTION 'Seule une commande en attente peut être annulée (statut actuel : %).', v_commande.statut;
  END IF;

  UPDATE commandes
  SET statut = 'annulee',
      motif_annulation = NULLIF(BTRIM(COALESCE(p_motif, '')), ''),
      date_annulation = NOW(),
      annulee_par = v_uid
  WHERE id = p_commande_id;

  RETURN json_build_object(
    'success', TRUE,
    'commande_id', p_commande_id,
    'statut', 'annulee'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.annuler_commande(UUID, TEXT) TO authenticated;

-- ============================================================================
-- 3. MODIFICATION DES LIGNES D'UNE COMMANDE EN ATTENTE
-- ============================================================================

CREATE OR REPLACE FUNCTION public.modifier_commande_en_attente(
  p_commande_id UUID,
  p_items JSONB
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_profile RECORD;
  v_commande RECORD;
  v_total INTEGER := 0;
  v_lignes INTEGER := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Non authentifié.';
  END IF;

  SELECT role, etablissement_id, actif INTO v_profile FROM profiles WHERE id = v_uid;
  IF NOT FOUND
     OR v_profile.role NOT IN ('comptoir', 'gerant', 'patron')
     OR COALESCE(v_profile.actif, true) <> true THEN
    RAISE EXCEPTION 'Accès refusé.';
  END IF;

  SELECT * INTO v_commande FROM commandes WHERE id = p_commande_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Commande introuvable.';
  END IF;

  IF v_commande.etablissement_id IS DISTINCT FROM v_profile.etablissement_id THEN
    RAISE EXCEPTION 'Commande d''un autre établissement.';
  END IF;

  IF v_commande.statut <> 'en_attente' THEN
    RAISE EXCEPTION 'Seule une commande en attente peut être modifiée (statut actuel : %).', v_commande.statut;
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'La commande doit contenir au moins un article (utilisez l''annulation pour la supprimer).';
  END IF;

  CREATE TEMP TABLE tmp_qte ON COMMIT DROP AS
  SELECT
    (x.value ->> 'produit_id')::UUID AS produit_id,
    SUM(GREATEST(COALESCE(NULLIF(x.value ->> 'quantite', '')::INTEGER, 0), 0))::INTEGER AS quantite,
    MAX(NULLIF(x.value ->> 'prix_unitaire', '')::INTEGER) AS prix_force
  FROM jsonb_array_elements(p_items) AS x(value)
  GROUP BY 1;

  DELETE FROM tmp_qte WHERE quantite <= 0 OR produit_id IS NULL;

  CREATE TEMP TABLE tmp_new ON COMMIT DROP AS
  SELECT
    q.produit_id,
    q.quantite,
    pr.nom,
    pr.etablissement_id,
    COALESCE(q.prix_force, public.get_prix_produit(q.produit_id, NOW()), pr.prix_vente)::INTEGER AS prix
  FROM tmp_qte q
  JOIN produits pr ON pr.id = q.produit_id;

  IF NOT EXISTS (SELECT 1 FROM tmp_new) THEN
    RAISE EXCEPTION 'Aucun article valide dans la commande.';
  END IF;

  IF (SELECT COUNT(*) FROM tmp_qte) <> (SELECT COUNT(*) FROM tmp_new) THEN
    RAISE EXCEPTION 'Un ou plusieurs produits sont introuvables.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM tmp_new t
    WHERE t.etablissement_id IS DISTINCT FROM v_commande.etablissement_id
  ) THEN
    RAISE EXCEPTION 'Un ou plusieurs produits n''appartiennent pas à cet établissement.';
  END IF;

  IF EXISTS (SELECT 1 FROM tmp_new WHERE prix IS NULL OR prix <= 0) THEN
    RAISE EXCEPTION 'Un ou plusieurs produits ont un prix de vente invalide (0).';
  END IF;

  -- Lignes retirées
  DELETE FROM commande_items ci
  WHERE ci.commande_id = p_commande_id
    AND NOT EXISTS (SELECT 1 FROM tmp_new t WHERE t.produit_id = ci.produit_id);

  -- Lignes conservées : quantités et prix mis à jour
  UPDATE commande_items ci
  SET quantite = t.quantite,
      quantite_initiale = t.quantite,
      prix_unitaire = t.prix,
      montant_ligne = t.prix * t.quantite,
      montant_initial = t.prix * t.quantite
  FROM tmp_new t
  WHERE ci.commande_id = p_commande_id
    AND ci.produit_id = t.produit_id;

  -- Nouvelles lignes
  INSERT INTO commande_items (
    commande_id, produit_id, nom_produit, prix_unitaire, quantite,
    montant_ligne, etablissement_id, quantite_initiale, montant_initial
  )
  SELECT
    p_commande_id, t.produit_id, t.nom, t.prix, t.quantite,
    t.prix * t.quantite, v_commande.etablissement_id, t.quantite, t.prix * t.quantite
  FROM tmp_new t
  WHERE NOT EXISTS (
    SELECT 1 FROM commande_items ci
    WHERE ci.commande_id = p_commande_id AND ci.produit_id = t.produit_id
  );

  UPDATE commandes SET derniere_modification = NOW() WHERE id = p_commande_id;

  SELECT montant_total INTO v_total FROM commandes WHERE id = p_commande_id;
  SELECT COUNT(*) INTO v_lignes FROM commande_items WHERE commande_id = p_commande_id;

  RETURN json_build_object(
    'success', TRUE,
    'commande_id', p_commande_id,
    'montant_total', COALESCE(v_total, 0),
    'lignes', v_lignes
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.modifier_commande_en_attente(UUID, JSONB) TO authenticated;

-- ============================================================================
-- 4. RAVITAILLEMENT EXPRESS (débloquer une validation sans changer d'écran)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.ravitailler_produit_express(
  p_produit_id UUID,
  p_quantite INTEGER,
  p_commentaire TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_profile RECORD;
  v_produit RECORD;
  v_stock INTEGER := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Non authentifié.';
  END IF;

  SELECT role, etablissement_id, actif INTO v_profile FROM profiles WHERE id = v_uid;
  IF NOT FOUND
     OR v_profile.role NOT IN ('comptoir', 'gerant', 'patron')
     OR COALESCE(v_profile.actif, true) <> true THEN
    RAISE EXCEPTION 'Accès refusé.';
  END IF;

  IF p_quantite IS NULL OR p_quantite <= 0 THEN
    RAISE EXCEPTION 'La quantité doit être supérieure à 0.';
  END IF;

  SELECT * INTO v_produit FROM produits WHERE id = p_produit_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produit introuvable.';
  END IF;

  IF v_produit.etablissement_id IS DISTINCT FROM v_profile.etablissement_id THEN
    RAISE EXCEPTION 'Produit d''un autre établissement.';
  END IF;

  UPDATE stocks
  SET quantite_actuelle = quantite_actuelle + p_quantite,
      derniere_mise_a_jour = NOW()
  WHERE produit_id = p_produit_id
    AND etablissement_id = v_profile.etablissement_id;

  IF NOT FOUND THEN
    INSERT INTO stocks (produit_id, etablissement_id, quantite_actuelle, seuil_alerte, derniere_mise_a_jour)
    VALUES (p_produit_id, v_profile.etablissement_id, p_quantite, 10, NOW());
  END IF;

  INSERT INTO mouvements_stock (
    produit_id, etablissement_id, type, quantite,
    type_reference, reference, utilisateur_id, date_creation
  ) VALUES (
    p_produit_id, v_profile.etablissement_id, 'entree', p_quantite,
    'ravitaillement',
    COALESCE(NULLIF(BTRIM(COALESCE(p_commentaire, '')), ''), 'Ravitaillement express'),
    v_uid, NOW()
  );

  SELECT quantite_actuelle INTO v_stock
  FROM stocks
  WHERE produit_id = p_produit_id
    AND etablissement_id = v_profile.etablissement_id;

  RETURN json_build_object(
    'success', TRUE,
    'produit_id', p_produit_id,
    'stock', COALESCE(v_stock, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ravitailler_produit_express(UUID, INTEGER, TEXT) TO authenticated;

COMMENT ON FUNCTION public.ravitailler_produit_express(UUID, INTEGER, TEXT) IS
  'Entrée de stock rapide depuis l''écran de validation (mouvement type_reference = ravitaillement).';

NOTIFY pgrst, 'reload schema';
