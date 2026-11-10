-- Migration: Export de rapprochement de stock détaillé par désignation
-- Description:
--   1. get_rapport_stock_produits() : agrégats par produit sur la période
--      (ouverture, entrées, sorties ventes, sorties autres, théorique, réel,
--       écarts) — une ligne par désignation.
--   2. get_export_stock_produits() : jeu de données d'export associé.
--   3. get_export_dataset() : routage
--        - rapport_stock_journalier  -> détail par produit (nouveau comportement)
--        - rapport_stock_synthese    -> synthèse globale par jour (ancien rapport)
--        - journal_mouvements_stock  -> journal ligne à ligne
-- Created: 2026-04-37

-- ============================================================================
-- 1. RAPPROCHEMENT PAR DÉSIGNATION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_rapport_stock_produits(
  p_date_debut DATE,
  p_date_fin DATE,
  p_departement TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_profile RECORD;
  v_etab UUID;
  v_debut DATE;
  v_fin DATE;
  v_dept TEXT := NULLIF(LOWER(p_departement), '');
  v_rows JSONB := '[]'::jsonb;
  v_totaux JSONB := '{}'::jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Non authentifié.';
  END IF;

  SELECT * INTO v_profile FROM profiles WHERE id = v_uid;
  IF NOT FOUND OR v_profile.role NOT IN ('patron', 'gerant') OR COALESCE(v_profile.actif, true) <> true THEN
    RAISE EXCEPTION 'Accès refusé.';
  END IF;
  IF v_profile.etablissement_id IS NULL THEN
    RAISE EXCEPTION 'Aucun établissement associé.';
  END IF;

  v_etab := v_profile.etablissement_id;
  v_debut := COALESCE(p_date_debut, CURRENT_DATE);
  v_fin := LEAST(COALESCE(p_date_fin, CURRENT_DATE), CURRENT_DATE);
  IF v_debut > v_fin THEN
    RAISE EXCEPTION 'Période invalide.';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'produit', a.produit_nom,
    'categorie', a.categorie,
    'departement', a.departement,
    'cout_unitaire', a.cout_unitaire,
    'qte_ouverture', a.qte_ouverture,
    'qte_entrees', a.qte_entrees,
    'qte_sorties_ventes', a.qte_sorties_ventes,
    'qte_sorties_autres', a.qte_sorties_autres,
    'qte_theorique', a.qte_theorique,
    'qte_reelle', a.qte_reelle,
    'ecart_qte', a.ecart_qte,
    'valeur_ouverture', a.valeur_ouverture,
    'valeur_entrees', a.valeur_entrees,
    'valeur_sorties_ventes', a.valeur_sorties_ventes,
    'valeur_sorties_autres', a.valeur_sorties_autres,
    'valeur_theorique', a.valeur_theorique,
    'valeur_reelle', a.valeur_reelle,
    'ecart_valeur', a.ecart_valeur,
    'jours_comptes', a.jours_comptes,
    'statut', a.statut
  ) ORDER BY a.categorie, a.produit_nom), '[]'::jsonb)
  INTO v_rows
  FROM (
    WITH d AS (
      SELECT s.*
      FROM public.stock_jour_detail(v_etab, v_debut, v_fin) s
      WHERE (
        v_dept IS NULL
        OR (v_dept = 'cuisine' AND s.categorie = 'nourriture')
        OR (v_dept = 'bar' AND s.categorie <> 'nourriture')
      )
    ),
    premier AS (
      SELECT DISTINCT ON (produit_id)
             produit_id, qte_ouverture, valeur_ouverture
      FROM d
      ORDER BY produit_id, jour ASC
    ),
    dernier AS (
      SELECT DISTINCT ON (produit_id)
             produit_id, qte_theorique, valeur_theorique
      FROM d
      ORDER BY produit_id, jour DESC
    ),
    dernier_compte AS (
      SELECT DISTINCT ON (produit_id)
             produit_id, qte_reelle, valeur_reelle
      FROM d
      WHERE est_compte
      ORDER BY produit_id, jour DESC
    ),
    flux AS (
      SELECT produit_id,
             MIN(produit_nom) AS produit_nom,
             MIN(categorie) AS categorie,
             MIN(cout_unitaire) AS cout_unitaire,
             SUM(qte_entrees)::INTEGER AS qte_entrees,
             SUM(qte_sorties_ventes)::INTEGER AS qte_sorties_ventes,
             SUM(qte_sorties_autres)::INTEGER AS qte_sorties_autres,
             SUM(valeur_entrees)::INTEGER AS valeur_entrees,
             SUM(valeur_sorties_ventes)::INTEGER AS valeur_sorties_ventes,
             SUM(valeur_sorties_autres)::INTEGER AS valeur_sorties_autres,
             COALESCE(SUM(ecart_qte), 0)::INTEGER AS ecart_qte,
             COALESCE(SUM(ecart_valeur), 0)::INTEGER AS ecart_valeur,
             COUNT(*) FILTER (WHERE est_compte)::INTEGER AS jours_comptes
      FROM d
      GROUP BY produit_id
    )
    SELECT
      f.produit_id,
      f.produit_nom,
      f.categorie,
      CASE WHEN f.categorie = 'nourriture' THEN 'Cuisine' ELSE 'Bar' END AS departement,
      f.cout_unitaire,
      pr.qte_ouverture,
      pr.valeur_ouverture,
      f.qte_entrees,
      f.qte_sorties_ventes,
      f.qte_sorties_autres,
      de.qte_theorique,
      de.valeur_theorique,
      dc.qte_reelle,
      dc.valeur_reelle,
      f.ecart_qte,
      f.ecart_valeur,
      f.jours_comptes,
      CASE WHEN f.jours_comptes > 0 THEN 'Compté' ELSE 'Non compté' END AS statut
    FROM flux f
    JOIN premier pr ON pr.produit_id = f.produit_id
    JOIN dernier de ON de.produit_id = f.produit_id
    LEFT JOIN dernier_compte dc ON dc.produit_id = f.produit_id
  ) a;

  SELECT jsonb_build_object(
    'produits', jsonb_array_length(v_rows),
    'produits_comptes', COUNT(*) FILTER (WHERE (r->>'jours_comptes')::numeric > 0),
    'valeur_ouverture', COALESCE(SUM((r->>'valeur_ouverture')::numeric), 0),
    'valeur_entrees', COALESCE(SUM((r->>'valeur_entrees')::numeric), 0),
    'valeur_sorties_ventes', COALESCE(SUM((r->>'valeur_sorties_ventes')::numeric), 0),
    'valeur_sorties_autres', COALESCE(SUM((r->>'valeur_sorties_autres')::numeric), 0),
    'valeur_theorique', COALESCE(SUM((r->>'valeur_theorique')::numeric), 0),
    'valeur_reelle', COALESCE(SUM((r->>'valeur_reelle')::numeric), 0),
    'ecart_qte', COALESCE(SUM((r->>'ecart_qte')::numeric), 0),
    'ecart_valeur', COALESCE(SUM((r->>'ecart_valeur')::numeric), 0)
  )
  INTO v_totaux
  FROM jsonb_array_elements(v_rows) AS r;

  RETURN jsonb_build_object(
    'date_debut', v_debut,
    'date_fin', v_fin,
    'departement', COALESCE(v_dept, 'tous'),
    'rows', v_rows,
    'totaux', v_totaux
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_rapport_stock_produits(DATE, DATE, TEXT) TO authenticated;

COMMENT ON FUNCTION public.get_rapport_stock_produits(DATE, DATE, TEXT) IS
  'Rapprochement de stock par désignation sur une période : ouverture, mouvements, théorique, réel et écarts.';

-- ============================================================================
-- 2. JEU DE DONNÉES D'EXPORT (détail par produit)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_export_stock_produits(
  p_type TEXT,
  p_date_debut TIMESTAMPTZ,
  p_date_fin TIMESTAMPTZ,
  p_filtres JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_profile RECORD;
  v_etab RECORD;
  v_tz TEXT;
  v_dept TEXT := NULLIF(LOWER(p_filtres->>'departement'), '');
  v_debut_date DATE;
  v_fin_date DATE;
  v_payload JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Non authentifié.';
  END IF;

  SELECT * INTO v_profile FROM profiles WHERE id = v_uid;
  IF NOT FOUND OR v_profile.role NOT IN ('patron', 'gerant') OR COALESCE(v_profile.actif, true) <> true THEN
    RAISE EXCEPTION 'Accès refusé.';
  END IF;
  IF v_profile.etablissement_id IS NULL THEN
    RAISE EXCEPTION 'Aucun établissement associé à votre compte.';
  END IF;
  IF p_date_debut IS NULL OR p_date_fin IS NULL THEN
    RAISE EXCEPTION 'Période obligatoire.';
  END IF;
  IF p_date_debut > p_date_fin THEN
    RAISE EXCEPTION 'Période invalide.';
  END IF;

  SELECT * INTO v_etab FROM etablissements WHERE id = v_profile.etablissement_id;
  v_tz := COALESCE(v_etab.fuseau_horaire, 'Africa/Douala');
  v_debut_date := (p_date_debut AT TIME ZONE v_tz)::date;
  v_fin_date := LEAST((p_date_fin AT TIME ZONE v_tz)::date, CURRENT_DATE);

  v_payload := public.get_rapport_stock_produits(v_debut_date, v_fin_date, v_dept);

  RETURN jsonb_build_object(
    'meta', jsonb_build_object(
      'type', p_type,
      'etablissement_id', v_etab.id,
      'etablissement_nom', v_etab.nom,
      'date_debut', p_date_debut,
      'date_fin', p_date_fin,
      'devise', COALESCE(v_etab.devise, 'XAF'),
      'taux_tva', COALESCE(v_etab.taux_tva, 19.25),
      'prix_ttc', COALESCE(v_etab.prix_ttc, true),
      'fuseau_horaire', v_tz,
      'genere_le', NOW(),
      'genere_par', COALESCE(NULLIF(TRIM(CONCAT_WS(' ', v_profile.prenom, v_profile.nom)), ''), v_profile.role),
      'filtres', COALESCE(p_filtres, '{}'::jsonb)
    ),
    'rows', COALESCE(v_payload->'rows', '[]'::jsonb),
    'totaux', COALESCE(v_payload->'totaux', '{}'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_export_stock_produits(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, JSONB) TO authenticated;

COMMENT ON FUNCTION public.get_export_stock_produits(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, JSONB) IS
  'Jeu de données d''export du rapprochement de stock détaillé par désignation.';

-- ============================================================================
-- 3. ROUTAGE
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_export_dataset(
  p_type TEXT,
  p_date_debut TIMESTAMPTZ,
  p_date_fin TIMESTAMPTZ,
  p_filtres JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Détail par désignation (nouveau comportement du rapprochement)
  IF p_type = 'rapport_stock_journalier' THEN
    RETURN public.get_export_stock_produits(p_type, p_date_debut, p_date_fin, p_filtres);
  END IF;

  -- Synthèse globale par journée (ancien rapport journalier)
  IF p_type = 'rapport_stock_synthese' THEN
    RETURN public.get_export_stock_dataset('rapport_stock_journalier', p_date_debut, p_date_fin, p_filtres);
  END IF;

  -- Journal ligne à ligne des mouvements
  IF p_type = 'journal_mouvements_stock' THEN
    RETURN public.get_export_stock_dataset(p_type, p_date_debut, p_date_fin, p_filtres);
  END IF;

  RETURN public.get_export_dataset_core(p_type, p_date_debut, p_date_fin, p_filtres);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_export_dataset(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, JSONB) TO authenticated;

COMMENT ON FUNCTION public.get_export_dataset(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, JSONB) IS
  'Point d''entrée unique des exports comptables : ventes/caisse (core), stock détaillé par désignation, synthèse stock journalière, mouvements de stock.';

NOTIFY pgrst, 'reload schema';
