-- Migration: Export de rapprochement de stock — détail jour par jour et par produit
-- Description:
--   1. get_export_stock_jour_produit() : une ligne par (journée, désignation)
--   2. get_export_dataset() : ajout du routage du type rapport_stock_jour_produit
-- Created: 2026-04-38
--
-- Récapitulatif des variantes de rapprochement de stock :
--   rapport_stock_journalier    -> une ligne par produit (agrégé sur la période)
--   rapport_stock_synthese      -> une ligne par jour (tous produits confondus)
--   rapport_stock_jour_produit  -> une ligne par jour ET par produit  (ce fichier)
--   journal_mouvements_stock    -> une ligne par mouvement de stock

CREATE OR REPLACE FUNCTION public.get_export_stock_jour_produit(
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
  v_etab_id UUID;
  v_tz TEXT;
  v_dept TEXT := NULLIF(LOWER(p_filtres->>'departement'), '');
  v_debut_date DATE;
  v_fin_date DATE;
  v_rows JSONB := '[]'::jsonb;
  v_totaux JSONB := '{}'::jsonb;
  v_valeur_fin NUMERIC := 0;
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

  v_etab_id := v_profile.etablissement_id;
  SELECT * INTO v_etab FROM etablissements WHERE id = v_etab_id;
  v_tz := COALESCE(v_etab.fuseau_horaire, 'Africa/Douala');
  v_debut_date := (p_date_debut AT TIME ZONE v_tz)::date;
  v_fin_date := LEAST((p_date_fin AT TIME ZONE v_tz)::date, CURRENT_DATE);

  -- Détail : une ligne par journée et par désignation
  SELECT COALESCE(jsonb_agg(r ORDER BY s.sort_ts DESC, s.categorie, s.produit_nom), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT jsonb_build_object(
      'date', to_char(d.jour, 'DD/MM/YYYY'),
      'produit', d.produit_nom,
      'categorie', d.categorie,
      'departement', CASE WHEN d.categorie = 'nourriture' THEN 'Cuisine' ELSE 'Bar' END,
      'cout_unitaire', d.cout_unitaire,
      'qte_ouverture', d.qte_ouverture,
      'qte_entrees', d.qte_entrees,
      'qte_sorties_ventes', d.qte_sorties_ventes,
      'qte_sorties_autres', d.qte_sorties_autres,
      'qte_theorique', d.qte_theorique,
      'qte_reelle', d.qte_reelle,
      'ecart_qte', d.ecart_qte,
      'valeur_ouverture', d.valeur_ouverture,
      'valeur_entrees', d.valeur_entrees,
      'valeur_sorties_ventes', d.valeur_sorties_ventes,
      'valeur_sorties_autres', d.valeur_sorties_autres,
      'valeur_theorique', d.valeur_theorique,
      'valeur_reelle', d.valeur_reelle,
      'ecart_valeur', d.ecart_valeur,
      'statut', CASE WHEN d.est_compte THEN 'Compté' ELSE 'Non compté' END
    ) AS r,
    d.jour AS sort_ts,
    d.categorie AS categorie,
    d.produit_nom AS produit_nom
    FROM public.stock_jour_detail(v_etab_id, v_debut_date, v_fin_date) d
    WHERE (
      v_dept IS NULL
      OR (v_dept = 'cuisine' AND d.categorie = 'nourriture')
      OR (v_dept = 'bar' AND d.categorie <> 'nourriture')
    )
  ) s;

  -- Valeur du stock à la clôture de la dernière journée (les niveaux ne se
  -- cumulent pas, contrairement aux flux).
  SELECT COALESCE(SUM(d.valeur_theorique), 0)
  INTO v_valeur_fin
  FROM public.stock_jour_detail(v_etab_id, v_fin_date, v_fin_date) d
  WHERE (
    v_dept IS NULL
    OR (v_dept = 'cuisine' AND d.categorie = 'nourriture')
    OR (v_dept = 'bar' AND d.categorie <> 'nourriture')
  );

  SELECT jsonb_build_object(
    'lignes', jsonb_array_length(v_rows),
    'qte_entrees', COALESCE(SUM((r->>'qte_entrees')::numeric), 0),
    'qte_sorties_ventes', COALESCE(SUM((r->>'qte_sorties_ventes')::numeric), 0),
    'qte_sorties_autres', COALESCE(SUM((r->>'qte_sorties_autres')::numeric), 0),
    'valeur_entrees', COALESCE(SUM((r->>'valeur_entrees')::numeric), 0),
    'valeur_sorties_ventes', COALESCE(SUM((r->>'valeur_sorties_ventes')::numeric), 0),
    'valeur_sorties_autres', COALESCE(SUM((r->>'valeur_sorties_autres')::numeric), 0),
    'ecart_qte', COALESCE(SUM((r->>'ecart_qte')::numeric), 0),
    'ecart_valeur', COALESCE(SUM((r->>'ecart_valeur')::numeric), 0),
    'valeur_stock_fin', v_valeur_fin
  )
  INTO v_totaux
  FROM jsonb_array_elements(v_rows) AS r;

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
    'rows', v_rows,
    'totaux', v_totaux
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_export_stock_jour_produit(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, JSONB) TO authenticated;

COMMENT ON FUNCTION public.get_export_stock_jour_produit(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, JSONB) IS
  'Rapprochement de stock détaillé : une ligne par journée et par désignation.';

-- ============================================================================
-- ROUTAGE
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
  -- Une ligne par produit (agrégé sur la période)
  IF p_type = 'rapport_stock_journalier' THEN
    RETURN public.get_export_stock_produits(p_type, p_date_debut, p_date_fin, p_filtres);
  END IF;

  -- Une ligne par jour (tous produits confondus)
  IF p_type = 'rapport_stock_synthese' THEN
    RETURN public.get_export_stock_dataset('rapport_stock_journalier', p_date_debut, p_date_fin, p_filtres);
  END IF;

  -- Une ligne par jour et par produit
  IF p_type = 'rapport_stock_jour_produit' THEN
    RETURN public.get_export_stock_jour_produit(p_type, p_date_debut, p_date_fin, p_filtres);
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
  'Point d''entrée unique des exports comptables : ventes/caisse, rapprochement stock (par produit, par jour, jour x produit) et mouvements de stock.';

NOTIFY pgrst, 'reload schema';
