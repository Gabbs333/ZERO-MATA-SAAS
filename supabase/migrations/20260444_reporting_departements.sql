-- Migration: Reporting par département (Bar / Cuisine) — modèle comptable unique
-- Description:
--   Jusqu'ici, la ventilation Bar / Cuisine du tableau de bord était calculée
--   côté client, avec deux bases différentes :
--     * CA   -> somme des commande_items des commandes de la période ;
--     * Encaissé -> somme des encaissements par date de paiement, ventilée au
--       prorata de la composition de la facture.
--   D'où l'incohérence constatée : l'encaissé d'un département pouvait dépasser
--   son CA (paiements d'anciennes commandes, factures globales, arrondis).
--
--   Cette migration applique aux départements EXACTEMENT le modèle de référence
--   du reporting global (cf. 20260443) :
--     CA facturé  = factures de la période (date_generation)
--     Encaissé    = SUM(factures.montant_paye)  des mêmes factures
--     Impayés     = SUM(factures.montant_restant) des mêmes factures
--   Donc, par construction : CA = Encaissé + Impayés, et
--     bar + cuisine (+ non_ventile) = total.
--
--   Rattachement d'une facture à un département :
--     1. suffixe du numéro de facture (`-BAR` / `-CUI`) -> autorité absolue,
--        c'est ainsi que les factures scindées sont générées (20260421) ;
--     2. sinon (anciennes factures globales) -> composition réelle des
--        commande_items : nourriture = cuisine, le reste = bar, réparti au
--        prorata du montant de la facture, avec arrondi entier exact
--        (le reste d'arrondi est imputé au bar, jamais de centime perdu).
--
--   Idempotente : CREATE OR REPLACE + DROP ... IF EXISTS.
-- Created: 2026-04-44

-- ============================================================================
-- 1. VUE: FACTURE -> DÉPARTEMENT (cloisonnée par établissement)
-- ============================================================================

CREATE OR REPLACE VIEW public.factures_departements AS
WITH scope AS (
  SELECT p.etablissement_id
  FROM profiles p
  WHERE p.id = auth.uid()
),
composition AS (
  SELECT
    ci.commande_id,
    COALESCE(SUM(ci.montant_ligne), 0)::NUMERIC AS total_items,
    COALESCE(SUM(
      CASE WHEN LOWER(BTRIM(COALESCE(pr.categorie, ''))) = 'nourriture'
           THEN ci.montant_ligne ELSE 0 END
    ), 0)::NUMERIC AS cuisine_items
  FROM commande_items ci
  JOIN commandes c ON c.id = ci.commande_id
  LEFT JOIN produits pr ON pr.id = ci.produit_id
  WHERE c.etablissement_id IN (SELECT s.etablissement_id FROM scope s)
  GROUP BY ci.commande_id
),
base AS (
  SELECT
    f.id,
    f.etablissement_id,
    f.commande_id,
    f.numero_facture,
    f.date_generation,
    f.statut,
    f.credit_sur,
    f.montant_total::BIGINT   AS montant_total,
    f.montant_paye::BIGINT    AS montant_paye,
    f.montant_restant::BIGINT AS montant_restant,
    COALESCE(c.total_items, 0)   AS total_items,
    COALESCE(c.cuisine_items, 0) AS cuisine_items,
    CASE
      WHEN f.numero_facture LIKE '%-BAR' THEN 'bar'
      WHEN f.numero_facture LIKE '%-CUI' THEN 'cuisine'
      WHEN COALESCE(c.total_items, 0) = 0 THEN 'non_ventile'
      WHEN COALESCE(c.cuisine_items, 0) = 0 THEN 'bar'
      WHEN c.cuisine_items = c.total_items THEN 'cuisine'
      ELSE 'mixte'
    END AS departement
  FROM factures f
  LEFT JOIN composition c ON c.commande_id = f.commande_id
  WHERE f.etablissement_id IN (SELECT s.etablissement_id FROM scope s)
),
parts AS (
  SELECT
    b.*,
    CASE b.departement
      WHEN 'bar' THEN b.montant_total
      WHEN 'cuisine' THEN 0
      WHEN 'non_ventile' THEN 0
      ELSE b.montant_total - ROUND(b.montant_total * b.cuisine_items / b.total_items)::BIGINT
    END AS bar_montant_total,
    CASE b.departement
      WHEN 'cuisine' THEN b.montant_total
      WHEN 'bar' THEN 0
      WHEN 'non_ventile' THEN 0
      ELSE ROUND(b.montant_total * b.cuisine_items / b.total_items)::BIGINT
    END AS cuisine_montant_total,
    CASE b.departement
      WHEN 'bar' THEN b.montant_paye
      WHEN 'cuisine' THEN 0
      WHEN 'non_ventile' THEN 0
      ELSE b.montant_paye - ROUND(b.montant_paye * b.cuisine_items / b.total_items)::BIGINT
    END AS bar_montant_paye,
    CASE b.departement
      WHEN 'cuisine' THEN b.montant_paye
      WHEN 'bar' THEN 0
      WHEN 'non_ventile' THEN 0
      ELSE ROUND(b.montant_paye * b.cuisine_items / b.total_items)::BIGINT
    END AS cuisine_montant_paye
  FROM base b
)
SELECT
  p.id,
  p.etablissement_id,
  p.commande_id,
  p.numero_facture,
  p.date_generation,
  p.statut,
  p.credit_sur,
  p.departement,
  p.montant_total,
  p.montant_paye,
  p.montant_restant,
  p.bar_montant_total,
  p.cuisine_montant_total,
  p.bar_montant_paye,
  p.cuisine_montant_paye,
  -- L'impayé est DÉRIVÉ (total - payé) pour que l'identité
  --   CA = encaissé + impayés
  -- soit vraie séparément pour chaque département, sans écart d'arrondi.
  (p.bar_montant_total - p.bar_montant_paye) AS bar_montant_restant,
  (p.cuisine_montant_total - p.cuisine_montant_paye) AS cuisine_montant_restant
FROM parts p
WHERE p.etablissement_id IN (SELECT s.etablissement_id FROM scope s);

GRANT SELECT ON public.factures_departements TO authenticated;

COMMENT ON VIEW public.factures_departements IS
  'Chaque facture ventilée Bar / Cuisine, cloisonnée par établissement. Base unique du reporting par département.';

-- ============================================================================
-- 2. KPIs PAR DÉPARTEMENT
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_kpis_departements(
  p_debut TIMESTAMPTZ,
  p_fin TIMESTAMPTZ
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_establishment UUID;
  v_tz TEXT;

  v_bar_ca BIGINT := 0;
  v_bar_paye BIGINT := 0;
  v_bar_restant BIGINT := 0;
  v_bar_nb BIGINT := 0;

  v_cui_ca BIGINT := 0;
  v_cui_paye BIGINT := 0;
  v_cui_restant BIGINT := 0;
  v_cui_nb BIGINT := 0;

  v_tot_ca BIGINT := 0;
  v_tot_paye BIGINT := 0;
  v_tot_restant BIGINT := 0;
  v_tot_nb BIGINT := 0;
BEGIN
  SELECT etablissement_id, tz INTO v_establishment, v_tz FROM public.reporting_scope();

  IF v_establishment IS NULL THEN
    RAISE EXCEPTION 'Aucun établissement associé à votre compte.';
  END IF;

  -- Bar
  SELECT
    COALESCE(SUM(d.bar_montant_total), 0),
    COALESCE(SUM(d.bar_montant_paye), 0),
    COALESCE(SUM(d.bar_montant_restant), 0),
    COUNT(*) FILTER (WHERE d.bar_montant_total <> 0)
  INTO v_bar_ca, v_bar_paye, v_bar_restant, v_bar_nb
  FROM public.factures_departements d
  WHERE d.etablissement_id = v_establishment
    AND d.date_generation >= p_debut
    AND d.date_generation <= p_fin;

  -- Cuisine
  SELECT
    COALESCE(SUM(d.cuisine_montant_total), 0),
    COALESCE(SUM(d.cuisine_montant_paye), 0),
    COALESCE(SUM(d.cuisine_montant_restant), 0),
    COUNT(*) FILTER (WHERE d.cuisine_montant_total <> 0)
  INTO v_cui_ca, v_cui_paye, v_cui_restant, v_cui_nb
  FROM public.factures_departements d
  WHERE d.etablissement_id = v_establishment
    AND d.date_generation >= p_debut
    AND d.date_generation <= p_fin;

  -- Total facturé (source de vérité : table factures, comme get_kpis)
  SELECT
    COALESCE(SUM(f.montant_total), 0),
    COALESCE(SUM(f.montant_paye), 0),
    COALESCE(SUM(f.montant_restant), 0),
    COUNT(*)
  INTO v_tot_ca, v_tot_paye, v_tot_restant, v_tot_nb
  FROM factures f
  WHERE f.etablissement_id = v_establishment
    AND f.date_generation >= p_debut
    AND f.date_generation <= p_fin;

  RETURN json_build_object(
    'fuseau_horaire', v_tz,
    'debut', p_debut,
    'fin', p_fin,
    'bar', json_build_object(
      'chiffre_affaires', v_bar_ca,
      'encaissements', v_bar_paye,
      'impayes', v_bar_restant,
      'factures', v_bar_nb
    ),
    'cuisine', json_build_object(
      'chiffre_affaires', v_cui_ca,
      'encaissements', v_cui_paye,
      'impayes', v_cui_restant,
      'factures', v_cui_nb
    ),
    'non_ventile', json_build_object(
      'chiffre_affaires', v_tot_ca - v_bar_ca - v_cui_ca,
      'encaissements', v_tot_paye - v_bar_paye - v_cui_paye,
      'impayes', v_tot_restant - v_bar_restant - v_cui_restant
    ),
    'total', json_build_object(
      'chiffre_affaires', v_tot_ca,
      'encaissements', v_tot_paye,
      'impayes', v_tot_restant,
      'factures', v_tot_nb
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_kpis_departements(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

COMMENT ON FUNCTION public.get_kpis_departements(TIMESTAMPTZ, TIMESTAMPTZ) IS
  'CA facturé / encaissé / impayés par département (Bar, Cuisine) et total. Garantit bar + cuisine + non_ventile = total.';

-- ============================================================================
-- 3. SÉRIE JOURNALIÈRE PAR DÉPARTEMENT (mêmes filtres temporels)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_analytics_departements(
  p_debut TIMESTAMPTZ,
  p_fin TIMESTAMPTZ
)
RETURNS TABLE (
  date DATE,
  departement TEXT,
  chiffre_affaires BIGINT,
  encaissements BIGINT,
  impayes BIGINT,
  nombre_factures BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_establishment UUID;
  v_tz TEXT;
BEGIN
  SELECT etablissement_id, tz INTO v_establishment, v_tz FROM public.reporting_scope();

  IF v_establishment IS NULL THEN
    RAISE EXCEPTION 'Aucun établissement associé à votre compte.';
  END IF;

  RETURN QUERY
  WITH jours AS (
    SELECT generate_series(
      (p_debut AT TIME ZONE v_tz)::date,
      (p_fin AT TIME ZONE v_tz)::date,
      INTERVAL '1 day'
    )::date AS d
  ),
  ventes AS (
    SELECT
      (d.date_generation AT TIME ZONE v_tz)::date AS jour,
      dept.code,
      SUM(CASE WHEN dept.code = 'bar' THEN d.bar_montant_total ELSE d.cuisine_montant_total END)::BIGINT AS ca,
      SUM(CASE WHEN dept.code = 'bar' THEN d.bar_montant_paye ELSE d.cuisine_montant_paye END)::BIGINT AS paye,
      SUM(CASE WHEN dept.code = 'bar' THEN d.bar_montant_restant ELSE d.cuisine_montant_restant END)::BIGINT AS restant,
      COUNT(*) FILTER (
        WHERE (CASE WHEN dept.code = 'bar' THEN d.bar_montant_total ELSE d.cuisine_montant_total END) <> 0
      )::BIGINT AS nb
    FROM public.factures_departements d
    CROSS JOIN (VALUES ('bar'), ('cuisine')) AS dept(code)
    WHERE d.etablissement_id = v_establishment
      AND d.date_generation >= p_debut
      AND d.date_generation <= p_fin
    GROUP BY (d.date_generation AT TIME ZONE v_tz)::date, dept.code
  )
  SELECT
    j.d,
    dept.code,
    COALESCE(v.ca, 0),
    COALESCE(v.paye, 0),
    COALESCE(v.restant, 0),
    COALESCE(v.nb, 0)
  FROM jours j
  CROSS JOIN (VALUES ('bar'), ('cuisine')) AS dept(code)
  LEFT JOIN ventes v ON v.jour = j.d AND v.code = dept.code
  ORDER BY j.d ASC, dept.code;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_analytics_departements(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

COMMENT ON FUNCTION public.get_analytics_departements(TIMESTAMPTZ, TIMESTAMPTZ) IS
  'Série journalière CA / encaissé / impayés par département (fuseau établissement).';

NOTIFY pgrst, 'reload schema';
