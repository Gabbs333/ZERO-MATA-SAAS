-- Migration: Correctif des exports de rapprochement de stock
-- Description:
--   Redéfinit de façon autonome et idempotente l'ensemble des fonctions
--   d'export de stock, avec des requêtes simplifiées (agrégats ordonnés au lieu
--   de CTE imbriqués / DISTINCT ON) :
--     1. stock_jour_detail             (si absent — recréé à l'identique)
--     2. get_rapport_stock_produits    (1 ligne / produit)
--     3. get_export_stock_produits     (jeu de données associé)
--     4. get_export_stock_jour_produit (1 ligne / jour x produit)
--     5. get_export_dataset            (routage)
-- Created: 2026-04-39

-- ============================================================================
-- 1. ÉTAT DE STOCK PAR PRODUIT ET PAR JOUR (rappel, idempotent)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.stock_jour_detail(
  p_etablissement_id UUID,
  p_date_debut DATE,
  p_date_fin DATE
)
RETURNS TABLE (
  jour DATE,
  produit_id UUID,
  produit_nom TEXT,
  categorie TEXT,
  cout_unitaire INTEGER,
  qte_ouverture INTEGER,
  qte_entrees INTEGER,
  qte_sorties_ventes INTEGER,
  qte_sorties_autres INTEGER,
  qte_theorique INTEGER,
  valeur_ouverture INTEGER,
  valeur_entrees INTEGER,
  valeur_sorties_ventes INTEGER,
  valeur_sorties_autres INTEGER,
  valeur_theorique INTEGER,
  qte_reelle INTEGER,
  valeur_reelle INTEGER,
  ecart_qte INTEGER,
  ecart_valeur INTEGER,
  est_compte BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH tz AS (
    SELECT COALESCE(fuseau_horaire, 'Africa/Douala') AS v_tz
    FROM etablissements
    WHERE id = p_etablissement_id
  ),
  jours AS (
    SELECT (generate_series(p_date_debut, p_date_fin, INTERVAL '1 day'))::date AS d
  ),
  prod AS (
    SELECT p.id,
           p.nom,
           p.categorie,
           COALESCE(p.prix_achat, 0) AS cout,
           COALESCE(s.quantite_actuelle, 0) AS qte_actuelle
    FROM produits p
    LEFT JOIN stocks s
      ON s.produit_id = p.id
     AND s.etablissement_id = p_etablissement_id
    WHERE p.etablissement_id = p_etablissement_id
      AND COALESCE(p.gestion_stock, false) = true
  ),
  mvt AS (
    SELECT m.produit_id,
           (m.date_creation AT TIME ZONE (SELECT v_tz FROM tz))::date AS j,
           CASE WHEN m.type = 'entree' THEN m.quantite ELSE -m.quantite END AS delta,
           CASE WHEN m.type = 'entree' THEN m.quantite ELSE 0 END AS q_entree,
           CASE WHEN m.type = 'sortie' AND m.type_reference = 'commande' THEN m.quantite ELSE 0 END AS q_vente,
           CASE WHEN m.type = 'sortie' AND m.type_reference <> 'commande' THEN m.quantite ELSE 0 END AS q_autre,
           CASE WHEN m.type = 'entree'
                THEN m.quantite * COALESCE(m.cout_unitaire, p.cout, 0) ELSE 0 END AS v_entree,
           CASE WHEN m.type = 'sortie' AND m.type_reference = 'commande'
                THEN m.quantite * COALESCE(m.cout_unitaire, p.cout, 0) ELSE 0 END AS v_vente,
           CASE WHEN m.type = 'sortie' AND m.type_reference <> 'commande'
                THEN m.quantite * COALESCE(m.cout_unitaire, p.cout, 0) ELSE 0 END AS v_autre
    FROM mouvements_stock m
    JOIN prod p ON p.id = m.produit_id
    WHERE m.etablissement_id = p_etablissement_id
  ),
  daily AS (
    SELECT m.produit_id,
           m.j,
           SUM(m.delta)   AS delta,
           SUM(m.q_entree) AS q_entree,
           SUM(m.q_vente)  AS q_vente,
           SUM(m.q_autre)  AS q_autre,
           SUM(m.v_entree) AS v_entree,
           SUM(m.v_vente)  AS v_vente,
           SUM(m.v_autre)  AS v_autre
    FROM mvt m
    GROUP BY m.produit_id, m.j
  ),
  total AS (
    SELECT d.produit_id, SUM(d.delta) AS delta_total
    FROM daily d
    GROUP BY d.produit_id
  ),
  cum AS (
    SELECT d.produit_id,
           d.j,
           SUM(d.delta) OVER (PARTITION BY d.produit_id ORDER BY d.j) AS cum
    FROM daily d
  ),
  base AS (
    SELECT jj.d AS jour,
           pr.id AS produit_id,
           pr.nom AS produit_nom,
           pr.categorie,
           pr.cout AS cout_unitaire,
           COALESCE(d.q_entree, 0)::INTEGER AS qte_entrees,
           COALESCE(d.q_vente, 0)::INTEGER AS qte_sorties_ventes,
           COALESCE(d.q_autre, 0)::INTEGER AS qte_sorties_autres,
           COALESCE(d.v_entree, 0)::INTEGER AS valeur_entrees,
           COALESCE(d.v_vente, 0)::INTEGER AS valeur_sorties_ventes,
           COALESCE(d.v_autre, 0)::INTEGER AS valeur_sorties_autres,
           COALESCE(d.delta, 0)::INTEGER AS delta_jour,
           (pr.qte_actuelle - (COALESCE(t.delta_total, 0) - COALESCE(c.cum, 0)))::INTEGER AS qte_fin
    FROM jours jj
    CROSS JOIN prod pr
    LEFT JOIN daily d
      ON d.produit_id = pr.id
     AND d.j = jj.d
    LEFT JOIN total t ON t.produit_id = pr.id
    LEFT JOIN LATERAL (
      SELECT cc.cum
      FROM cum cc
      WHERE cc.produit_id = pr.id
        AND cc.j <= jj.d
      ORDER BY cc.j DESC
      LIMIT 1
    ) c ON true
  )
  SELECT
    b.jour,
    b.produit_id,
    b.produit_nom,
    b.categorie,
    b.cout_unitaire,
    (b.qte_fin - b.delta_jour) AS qte_ouverture,
    b.qte_entrees,
    b.qte_sorties_ventes,
    b.qte_sorties_autres,
    CASE WHEN cs.id IS NOT NULL THEN cs.quantite_theorique ELSE b.qte_fin END AS qte_theorique,
    ((b.qte_fin - b.delta_jour) * b.cout_unitaire) AS valeur_ouverture,
    b.valeur_entrees,
    b.valeur_sorties_ventes,
    b.valeur_sorties_autres,
    CASE
      WHEN cs.id IS NOT NULL THEN cs.valeur_theorique
      ELSE ((b.qte_fin - b.delta_jour) * b.cout_unitaire)
           + b.valeur_entrees - b.valeur_sorties_ventes - b.valeur_sorties_autres
    END AS valeur_theorique,
    cs.quantite_reelle,
    cs.valeur_reelle,
    cs.ecart_qte,
    cs.ecart_valeur,
    (cs.id IS NOT NULL) AS est_compte
  FROM base b
  LEFT JOIN clotures_stock_journalieres cs
    ON cs.etablissement_id = p_etablissement_id
   AND cs.date_cloture = b.jour
   AND cs.produit_id = b.produit_id;
$$;

REVOKE ALL ON FUNCTION public.stock_jour_detail(UUID, DATE, DATE) FROM PUBLIC;

-- ============================================================================
-- 2. RAPPROCHEMENT PAR DÉSIGNATION (1 ligne / produit)
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
    'produit', x.produit_nom,
    'categorie', x.categorie,
    'departement', CASE WHEN x.categorie = 'nourriture' THEN 'Cuisine' ELSE 'Bar' END,
    'cout_unitaire', x.cout_unitaire,
    'qte_ouverture', x.qte_ouverture,
    'qte_entrees', x.qte_entrees,
    'qte_sorties_ventes', x.qte_sorties_ventes,
    'qte_sorties_autres', x.qte_sorties_autres,
    'qte_theorique', x.qte_theorique,
    'qte_reelle', x.qte_reelle,
    'ecart_qte', x.ecart_qte,
    'valeur_ouverture', x.valeur_ouverture,
    'valeur_entrees', x.valeur_entrees,
    'valeur_sorties_ventes', x.valeur_sorties_ventes,
    'valeur_sorties_autres', x.valeur_sorties_autres,
    'valeur_theorique', x.valeur_theorique,
    'valeur_reelle', x.valeur_reelle,
    'ecart_valeur', x.ecart_valeur,
    'jours_comptes', x.jours_comptes,
    'statut', CASE WHEN x.jours_comptes > 0 THEN 'Compté' ELSE 'Non compté' END
  ) ORDER BY x.categorie, x.produit_nom), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT d.produit_id,
           MIN(d.produit_nom)::TEXT AS produit_nom,
           MIN(d.categorie)::TEXT AS categorie,
           MIN(d.cout_unitaire)::INTEGER AS cout_unitaire,
           (array_agg(d.qte_ouverture ORDER BY d.jour ASC))[1]::INTEGER AS qte_ouverture,
           (array_agg(d.valeur_ouverture ORDER BY d.jour ASC))[1]::INTEGER AS valeur_ouverture,
           COALESCE(SUM(d.qte_entrees), 0)::INTEGER AS qte_entrees,
           COALESCE(SUM(d.qte_sorties_ventes), 0)::INTEGER AS qte_sorties_ventes,
           COALESCE(SUM(d.qte_sorties_autres), 0)::INTEGER AS qte_sorties_autres,
           COALESCE(SUM(d.valeur_entrees), 0)::INTEGER AS valeur_entrees,
           COALESCE(SUM(d.valeur_sorties_ventes), 0)::INTEGER AS valeur_sorties_ventes,
           COALESCE(SUM(d.valeur_sorties_autres), 0)::INTEGER AS valeur_sorties_autres,
           (array_agg(d.qte_theorique ORDER BY d.jour DESC))[1]::INTEGER AS qte_theorique,
           (array_agg(d.valeur_theorique ORDER BY d.jour DESC))[1]::INTEGER AS valeur_theorique,
           (array_agg(d.qte_reelle ORDER BY d.jour DESC)
              FILTER (WHERE d.est_compte))[1]::INTEGER AS qte_reelle,
           (array_agg(d.valeur_reelle ORDER BY d.jour DESC)
              FILTER (WHERE d.est_compte))[1]::INTEGER AS valeur_reelle,
           COALESCE(SUM(d.ecart_qte), 0)::INTEGER AS ecart_qte,
           COALESCE(SUM(d.ecart_valeur), 0)::INTEGER AS ecart_valeur,
           COUNT(*) FILTER (WHERE d.est_compte)::INTEGER AS jours_comptes
    FROM public.stock_jour_detail(v_etab, v_debut, v_fin) d
    WHERE (
      v_dept IS NULL
      OR (v_dept = 'cuisine' AND d.categorie = 'nourriture')
      OR (v_dept = 'bar' AND d.categorie <> 'nourriture')
    )
    GROUP BY d.produit_id
  ) x;

  SELECT jsonb_build_object(
    'produits', COALESCE(jsonb_array_length(v_rows), 0),
    'produits_comptes', COALESCE(SUM(CASE WHEN (r->>'jours_comptes')::numeric > 0 THEN 1 ELSE 0 END), 0),
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

-- ============================================================================
-- 3. JEU DE DONNÉES D'EXPORT (détail par produit)
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

-- ============================================================================
-- 4. DÉTAIL JOUR x PRODUIT
-- ============================================================================

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

  SELECT COALESCE(SUM(d.valeur_theorique), 0)
  INTO v_valeur_fin
  FROM public.stock_jour_detail(v_etab_id, v_fin_date, v_fin_date) d
  WHERE (
    v_dept IS NULL
    OR (v_dept = 'cuisine' AND d.categorie = 'nourriture')
    OR (v_dept = 'bar' AND d.categorie <> 'nourriture')
  );

  SELECT jsonb_build_object(
    'lignes', COALESCE(jsonb_array_length(v_rows), 0),
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

-- ============================================================================
-- 5. ROUTAGE
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
  IF p_type = 'rapport_stock_journalier' THEN
    RETURN public.get_export_stock_produits(p_type, p_date_debut, p_date_fin, p_filtres);
  END IF;

  IF p_type = 'rapport_stock_synthese' THEN
    RETURN public.get_export_stock_dataset('rapport_stock_journalier', p_date_debut, p_date_fin, p_filtres);
  END IF;

  IF p_type = 'rapport_stock_jour_produit' THEN
    RETURN public.get_export_stock_jour_produit(p_type, p_date_debut, p_date_fin, p_filtres);
  END IF;

  IF p_type = 'journal_mouvements_stock' THEN
    RETURN public.get_export_stock_dataset(p_type, p_date_debut, p_date_fin, p_filtres);
  END IF;

  IF to_regprocedure('public.get_export_dataset_core(text,timestamptz,timestamptz,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'Fonction get_export_dataset_core absente : exécutez la migration 20260436.';
  END IF;

  RETURN public.get_export_dataset_core(p_type, p_date_debut, p_date_fin, p_filtres);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_export_dataset(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, JSONB) TO authenticated;

NOTIFY pgrst, 'reload schema';
