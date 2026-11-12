-- Migration: Référentiel de reporting — modèle comptable unique
-- Description:
--   Corrige et unifie tous les calculs de reporting. Bugs traités :
--     * plusieurs fichiers SQL historiques utilisent `AS $` au lieu de `AS $$` :
--       get_kpis, get_analytics, search_transactions et les vues analytics
--       n'ont donc jamais été créés correctement ;
--     * vues analytics non cloisonnées par établissement (fuite multi-tenant) ;
--     * double comptage du CA (jointure commandes -> factures scindées) ;
--     * périodes calculées en UTC au lieu du fuseau de l'établissement ;
--     * incohérence CA / encaissements / impayés.
--
--   MODÈLE COMPTABLE (référence pour tout le reporting) :
--     CA facturé        = SUM(factures.montant_total) des factures générées
--                         dans la période (net des retours)
--     Encaissé          = SUM(factures.montant_paye) des factures de la période
--                         (rattachement à la facture)  => CA - impayés
--     Impayés           = SUM(factures.montant_restant) des factures de la période
--     Encaissements reçus = SUM(encaissements.montant) datés dans la période
--                         (remboursements négatifs inclus) => trésorerie
--     Coût des marchandises = SUM(mouvements_stock sorties 'commande' * coût)
--     Bénéfice          = CA facturé - coût des marchandises
--
--   Identité garantie : CA facturé = encaissé + impayés.
-- Created: 2026-04-43

-- ============================================================================
-- 0. NETTOYAGE DES OBJETS CASSÉS / HÉRITÉS
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_analytics_ca_encaissements(TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.get_payment_modes_stats(TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.search_transactions(TIMESTAMPTZ, TIMESTAMPTZ, UUID, UUID, UUID, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.get_kpis(TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.get_dashboard_kpis(TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.get_analytics(TIMESTAMPTZ, TIMESTAMPTZ, TEXT);
DROP FUNCTION IF EXISTS public.get_ventes_par_produit(TIMESTAMPTZ, TIMESTAMPTZ);

DROP VIEW IF EXISTS public.analytics_ca_encaissements;
DROP VIEW IF EXISTS public.analytics_by_payment_mode;
DROP VIEW IF EXISTS public.analytics_creances;

-- ============================================================================
-- 1. CONTEXTE D'APPEL (établissement + fuseau)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reporting_scope()
RETURNS TABLE (etablissement_id UUID, tz TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.etablissement_id,
         COALESCE(e.fuseau_horaire, 'Africa/Douala')
  FROM profiles p
  LEFT JOIN etablissements e ON e.id = p.etablissement_id
  WHERE p.id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.reporting_scope() TO authenticated;
COMMENT ON FUNCTION public.reporting_scope() IS
  'Retourne l''établissement et le fuseau horaire de l''utilisateur connecté (socle de tout le reporting).';

-- ============================================================================
-- 2. VUES ANALYTIQUES (cloisonnées par établissement)
-- ============================================================================

CREATE OR REPLACE VIEW public.analytics_ca_encaissements AS
WITH scope AS (
  SELECT p.etablissement_id,
         COALESCE(e.fuseau_horaire, 'Africa/Douala') AS tz
  FROM profiles p
  LEFT JOIN etablissements e ON e.id = p.etablissement_id
  WHERE p.id = auth.uid()
),
daily_ca AS (
  SELECT
    (c.date_creation AT TIME ZONE s.tz)::date AS date,
    COALESCE(SUM(c.montant_total), 0) AS chiffre_affaires,
    COUNT(*) AS nombre_commandes
  FROM commandes c
  CROSS JOIN scope s
  WHERE c.etablissement_id = s.etablissement_id
    AND c.statut IN ('validee', 'terminee')
  GROUP BY (c.date_creation AT TIME ZONE s.tz)::date
),
daily_enc AS (
  SELECT
    (e.date_encaissement AT TIME ZONE s.tz)::date AS date,
    COALESCE(SUM(e.montant), 0) AS encaissements
  FROM encaissements e
  CROSS JOIN scope s
  WHERE e.etablissement_id = s.etablissement_id
  GROUP BY (e.date_encaissement AT TIME ZONE s.tz)::date
),
daily_fact AS (
  SELECT
    (f.date_generation AT TIME ZONE s.tz)::date AS date,
    COUNT(*) AS nombre_factures,
    COALESCE(SUM(f.montant_restant), 0) AS impayes
  FROM factures f
  CROSS JOIN scope s
  WHERE f.etablissement_id = s.etablissement_id
  GROUP BY (f.date_generation AT TIME ZONE s.tz)::date
)
SELECT
  COALESCE(ca.date, enc.date, fac.date) AS date,
  COALESCE(ca.chiffre_affaires, 0) AS chiffre_affaires,
  COALESCE(enc.encaissements, 0) AS encaissements,
  COALESCE(ca.nombre_commandes, 0) AS nombre_commandes,
  COALESCE(fac.nombre_factures, 0) AS nombre_factures,
  COALESCE(fac.impayes, 0) AS impayes
FROM daily_ca ca
FULL OUTER JOIN daily_enc enc ON ca.date = enc.date
FULL OUTER JOIN daily_fact fac ON fac.date = COALESCE(ca.date, enc.date);

CREATE OR REPLACE VIEW public.analytics_by_payment_mode AS
WITH scope AS (
  SELECT p.etablissement_id
  FROM profiles p
  WHERE p.id = auth.uid()
)
SELECT
  e.mode_paiement,
  COUNT(*) AS nombre_encaissements,
  SUM(e.montant) AS montant_total,
  AVG(e.montant) AS montant_moyen,
  MIN(e.montant) AS montant_min,
  MAX(e.montant) AS montant_max,
  ROUND(
    (SUM(e.montant)::NUMERIC / NULLIF(
      (SELECT SUM(e2.montant)
       FROM encaissements e2
       CROSS JOIN scope s2
       WHERE e2.etablissement_id = s2.etablissement_id), 0)) * 100,
    2
  ) AS pourcentage_total
FROM encaissements e
CROSS JOIN scope s
WHERE e.etablissement_id = s.etablissement_id
GROUP BY e.mode_paiement
ORDER BY montant_total DESC;

CREATE OR REPLACE VIEW public.analytics_creances AS
WITH scope AS (
  SELECT p.etablissement_id
  FROM profiles p
  WHERE p.id = auth.uid()
),
f AS (
  SELECT fa.*
  FROM factures fa
  CROSS JOIN scope s
  WHERE fa.etablissement_id = s.etablissement_id
)
SELECT
  COALESCE(SUM(f.montant_total), 0) AS chiffre_affaires_total,
  COALESCE(SUM(f.montant_paye), 0) AS encaissements_total,
  COALESCE(SUM(f.montant_restant), 0) AS creances_total,
  COUNT(*) FILTER (WHERE f.statut <> 'payee') AS nombre_factures_impayees,
  COALESCE(SUM(f.montant_restant), 0) AS montant_factures_impayees
FROM f;

GRANT SELECT ON public.analytics_ca_encaissements TO authenticated;
GRANT SELECT ON public.analytics_by_payment_mode TO authenticated;
GRANT SELECT ON public.analytics_creances TO authenticated;

-- ============================================================================
-- 3. KPIs DE PÉRIODE
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_kpis(
  p_debut TIMESTAMPTZ,
  p_fin TIMESTAMPTZ
)
RETURNS TABLE (
  chiffre_affaires BIGINT,
  encaissements BIGINT,
  creances BIGINT,
  benefice BIGINT,
  nombre_commandes BIGINT,
  panier_moyen NUMERIC,
  nombre_factures_impayees BIGINT,
  taux_encaissement NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_etab UUID;
  v_tz TEXT;
  v_ca BIGINT := 0;
  v_encaisse BIGINT := 0;
  v_impayes BIGINT := 0;
  v_nb_factures_impayees BIGINT := 0;
  v_nb_commandes BIGINT := 0;
  v_cogs BIGINT := 0;
BEGIN
  SELECT etablissement_id, tz INTO v_etab, v_tz FROM public.reporting_scope();

  IF v_etab IS NULL THEN
    RAISE EXCEPTION 'Aucun établissement associé à votre compte.';
  END IF;

  -- CA facturé, encaissé et impayés : même population (factures de la période)
  SELECT
    COALESCE(SUM(f.montant_total), 0),
    COALESCE(SUM(f.montant_paye), 0),
    COALESCE(SUM(f.montant_restant), 0),
    COUNT(*) FILTER (WHERE f.statut <> 'payee')
  INTO v_ca, v_encaisse, v_impayes, v_nb_factures_impayees
  FROM factures f
  WHERE f.etablissement_id = v_etab
    AND f.date_generation >= p_debut
    AND f.date_generation <= p_fin;

  -- Nombre de commandes validées facturées sur la période
  SELECT COUNT(*)
  INTO v_nb_commandes
  FROM commandes c
  WHERE c.etablissement_id = v_etab
    AND c.statut IN ('validee', 'terminee')
    AND COALESCE(c.date_validation, c.date_creation) >= p_debut
    AND COALESCE(c.date_validation, c.date_creation) <= p_fin;

  -- Coût des marchandises vendues (COGS valorisé)
  SELECT COALESCE(SUM(ms.quantite * COALESCE(ms.cout_unitaire, p.prix_achat, 0)), 0)
  INTO v_cogs
  FROM mouvements_stock ms
  JOIN produits p ON p.id = ms.produit_id
  WHERE ms.etablissement_id = v_etab
    AND ms.type = 'sortie'
    AND ms.type_reference = 'commande'
    AND ms.date_creation >= p_debut
    AND ms.date_creation <= p_fin;

  chiffre_affaires := v_ca;
  encaissements := v_encaisse;
  creances := v_impayes;
  benefice := v_ca - v_cogs;
  nombre_commandes := v_nb_commandes;
  panier_moyen := CASE WHEN v_nb_commandes > 0 THEN ROUND(v_ca::NUMERIC / v_nb_commandes, 2) ELSE 0 END;
  nombre_factures_impayees := v_nb_factures_impayees;
  taux_encaissement := CASE WHEN v_ca > 0 THEN ROUND((v_encaisse::NUMERIC / v_ca) * 100, 2) ELSE 0 END;

  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_kpis(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_dashboard_kpis(
  p_debut TIMESTAMPTZ,
  p_fin TIMESTAMPTZ
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_etab UUID;
  v_tz TEXT;
  v_row RECORD;
  v_result JSON;
BEGIN
  SELECT etablissement_id, tz INTO v_etab, v_tz FROM public.reporting_scope();
  IF v_etab IS NULL THEN
    RAISE EXCEPTION 'Aucun établissement associé à votre compte.';
  END IF;

  SELECT * INTO v_row FROM public.get_kpis(p_debut, p_fin);

  SELECT json_build_object(
    'chiffre_affaires', v_row.chiffre_affaires,
    'encaissements', v_row.encaissements,
    'creances', v_row.creances,
    'benefice', v_row.benefice,
    'commandes_count', v_row.nombre_commandes,
    'panier_moyen', v_row.panier_moyen,
    'factures_impayees', v_row.nombre_factures_impayees,
    'taux_encaissement', v_row.taux_encaissement,
    'ventes_a_credit', (
      SELECT COALESCE(SUM(f.montant_restant), 0)
      FROM factures f
      WHERE f.etablissement_id = v_etab
        AND f.credit_sur = true
        AND f.date_generation >= p_debut
        AND f.date_generation <= p_fin
    ),
    'encaissements_recus', (
      SELECT COALESCE(SUM(e.montant), 0)
      FROM encaissements e
      WHERE e.etablissement_id = v_etab
        AND e.date_encaissement >= p_debut
        AND e.date_encaissement <= p_fin
    ),
    'fuseau_horaire', v_tz
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_kpis(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- ============================================================================
-- 4. SÉRIE CA / ENCAISSEMENTS (par jour, fuseau établissement)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_analytics_ca_encaissements(
  p_debut TIMESTAMPTZ,
  p_fin TIMESTAMPTZ
)
RETURNS TABLE (
  date DATE,
  chiffre_affaires BIGINT,
  encaissements BIGINT,
  nombre_commandes BIGINT,
  nombre_factures BIGINT,
  impayes BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_etab UUID;
  v_tz TEXT;
BEGIN
  SELECT etablissement_id, tz INTO v_etab, v_tz FROM public.reporting_scope();

  IF v_etab IS NULL THEN
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
  ca AS (
    SELECT (f.date_generation AT TIME ZONE v_tz)::date AS jour,
           COALESCE(SUM(f.montant_total), 0)::BIGINT AS ca,
           COALESCE(SUM(f.montant_restant), 0)::BIGINT AS impayes,
           COUNT(*)::BIGINT AS nb_factures
    FROM factures f
    WHERE f.etablissement_id = v_etab
      AND f.date_generation >= p_debut
      AND f.date_generation <= p_fin
    GROUP BY (f.date_generation AT TIME ZONE v_tz)::date
  ),
  enc AS (
    SELECT (e.date_encaissement AT TIME ZONE v_tz)::date AS jour,
           COALESCE(SUM(e.montant), 0)::BIGINT AS total
    FROM encaissements e
    WHERE e.etablissement_id = v_etab
      AND e.date_encaissement >= p_debut
      AND e.date_encaissement <= p_fin
    GROUP BY (e.date_encaissement AT TIME ZONE v_tz)::date
  ),
  cmd AS (
    SELECT (COALESCE(c.date_validation, c.date_creation) AT TIME ZONE v_tz)::date AS jour,
           COUNT(*)::BIGINT AS nb
    FROM commandes c
    WHERE c.etablissement_id = v_etab
      AND c.statut IN ('validee', 'terminee')
      AND COALESCE(c.date_validation, c.date_creation) >= p_debut
      AND COALESCE(c.date_validation, c.date_creation) <= p_fin
    GROUP BY (COALESCE(c.date_validation, c.date_creation) AT TIME ZONE v_tz)::date
  )
  SELECT j.d,
         COALESCE(ca.ca, 0),
         COALESCE(enc.total, 0),
         COALESCE(cmd.nb, 0),
         COALESCE(ca.nb_factures, 0),
         COALESCE(ca.impayes, 0)
  FROM jours j
  LEFT JOIN ca ON ca.jour = j.d
  LEFT JOIN enc ON enc.jour = j.d
  LEFT JOIN cmd ON cmd.jour = j.d
  ORDER BY j.d ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_analytics_ca_encaissements(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- ============================================================================
-- 5. VENTES PAR PRODUIT
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_ventes_par_produit(
  p_debut TIMESTAMPTZ,
  p_fin TIMESTAMPTZ
)
RETURNS TABLE (
  produit_id UUID,
  produit_nom TEXT,
  categorie TEXT,
  quantite_vendue BIGINT,
  chiffre_affaires BIGINT,
  nombre_commandes BIGINT,
  prix_moyen NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_etab UUID;
BEGIN
  SELECT etablissement_id INTO v_etab FROM public.reporting_scope();
  IF v_etab IS NULL THEN
    RAISE EXCEPTION 'Aucun établissement associé à votre compte.';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.nom,
    p.categorie,
    COALESCE(SUM(ci.quantite), 0)::BIGINT,
    COALESCE(SUM(ci.montant_ligne), 0)::BIGINT,
    COUNT(DISTINCT c.id)::BIGINT,
    CASE WHEN SUM(ci.quantite) > 0
         THEN ROUND(SUM(ci.montant_ligne)::NUMERIC / SUM(ci.quantite), 2)
         ELSE 0 END
  FROM commande_items ci
  JOIN commandes c ON c.id = ci.commande_id
  JOIN produits p ON p.id = ci.produit_id
  WHERE c.etablissement_id = v_etab
    AND c.statut IN ('validee', 'terminee')
    AND COALESCE(c.date_validation, c.date_creation) >= p_debut
    AND COALESCE(c.date_validation, c.date_creation) <= p_fin
  GROUP BY p.id, p.nom, p.categorie
  HAVING SUM(ci.quantite) > 0
  ORDER BY 5 DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_ventes_par_produit(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- ============================================================================
-- 6. ANALYTICS CONSOLIDÉES
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_analytics(
  p_debut TIMESTAMPTZ,
  p_fin TIMESTAMPTZ,
  p_granularite TEXT DEFAULT 'jour'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_etab UUID;
  v_tz TEXT;
  v_gran TEXT := COALESCE(NULLIF(LOWER(p_granularite), ''), 'jour');
  v_kpis JSON;
  v_produits JSON;
  v_evolution JSON;
BEGIN
  IF v_gran NOT IN ('heure', 'jour', 'semaine', 'mois') THEN
    RAISE EXCEPTION 'Granularité invalide. Valeurs acceptées : heure, jour, semaine, mois';
  END IF;

  SELECT etablissement_id, tz INTO v_etab, v_tz FROM public.reporting_scope();
  IF v_etab IS NULL THEN
    RAISE EXCEPTION 'Aucun établissement associé à votre compte.';
  END IF;

  SELECT public.get_dashboard_kpis(p_debut, p_fin) INTO v_kpis;

  SELECT COALESCE(json_agg(row_to_json(v)), '[]'::json) INTO v_produits
  FROM public.get_ventes_par_produit(p_debut, p_fin) v;

  SELECT COALESCE(json_agg(row_to_json(e) ORDER BY e.periode), '[]'::json) INTO v_evolution
  FROM (
    SELECT
      CASE v_gran
        WHEN 'heure' THEN date_trunc('hour', c.date_creation AT TIME ZONE v_tz)
        WHEN 'semaine' THEN date_trunc('week', c.date_creation AT TIME ZONE v_tz)
        WHEN 'mois' THEN date_trunc('month', c.date_creation AT TIME ZONE v_tz)
        ELSE date_trunc('day', c.date_creation AT TIME ZONE v_tz)
      END AS periode,
      COALESCE(SUM(c.montant_total), 0)::BIGINT AS chiffre_affaires,
      COUNT(*)::BIGINT AS nombre_commandes
    FROM commandes c
    WHERE c.etablissement_id = v_etab
      AND c.statut IN ('validee', 'terminee')
      AND COALESCE(c.date_validation, c.date_creation) >= p_debut
      AND COALESCE(c.date_validation, c.date_creation) <= p_fin
    GROUP BY 1
  ) e;

  RETURN json_build_object(
    'periode', json_build_object('debut', p_debut, 'fin', p_fin, 'granularite', v_gran),
    'fuseau_horaire', v_tz,
    'kpis', v_kpis,
    'ventes_produits', v_produits,
    'evolution', v_evolution
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_analytics(TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO authenticated;

-- ============================================================================
-- 7. MODES DE PAIEMENT (cloisonné)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_payment_modes_stats(
  p_debut TIMESTAMPTZ,
  p_fin TIMESTAMPTZ
)
RETURNS TABLE (
  mode_paiement TEXT,
  montant_total BIGINT,
  nombre_transactions BIGINT,
  pourcentage_total NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_etab UUID;
BEGIN
  SELECT etablissement_id INTO v_etab FROM public.reporting_scope();
  IF v_etab IS NULL THEN
    RAISE EXCEPTION 'Aucun établissement associé à votre compte.';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT e.mode_paiement, SUM(e.montant)::BIGINT AS total, COUNT(*)::BIGINT AS nb
    FROM encaissements e
    WHERE e.etablissement_id = v_etab
      AND e.date_encaissement >= p_debut
      AND e.date_encaissement <= p_fin
    GROUP BY e.mode_paiement
  ),
  total AS (SELECT NULLIF(SUM(total), 0) AS global FROM base)
  SELECT b.mode_paiement,
         b.total,
         b.nb,
         CASE WHEN t.global IS NULL THEN 0
              ELSE ROUND((b.total::NUMERIC / t.global) * 100, 2) END
  FROM base b
  CROSS JOIN total t
  ORDER BY b.total DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_payment_modes_stats(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- ============================================================================
-- 8. RECHERCHE DE TRANSACTIONS (cloisonnée)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.search_transactions(
  p_date_debut TIMESTAMPTZ DEFAULT NULL,
  p_date_fin TIMESTAMPTZ DEFAULT NULL,
  p_serveuse_id UUID DEFAULT NULL,
  p_table_id UUID DEFAULT NULL,
  p_produit_id UUID DEFAULT NULL,
  p_page INTEGER DEFAULT 1,
  p_limit INTEGER DEFAULT 50
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_etab UUID;
  v_offset INTEGER;
  v_total BIGINT;
  v_rows JSON;
BEGIN
  IF p_page < 1 THEN
    RAISE EXCEPTION 'Le numéro de page doit être >= 1';
  END IF;
  IF p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION 'La limite doit être entre 1 et 100';
  END IF;

  SELECT etablissement_id INTO v_etab FROM public.reporting_scope();
  IF v_etab IS NULL THEN
    RAISE EXCEPTION 'Aucun établissement associé à votre compte.';
  END IF;

  v_offset := (p_page - 1) * p_limit;

  SELECT COUNT(DISTINCT c.id)
  INTO v_total
  FROM commandes c
  LEFT JOIN commande_items ci ON ci.commande_id = c.id
  WHERE c.etablissement_id = v_etab
    AND c.statut IN ('validee', 'terminee')
    AND (p_date_debut IS NULL OR COALESCE(c.date_validation, c.date_creation) >= p_date_debut)
    AND (p_date_fin IS NULL OR COALESCE(c.date_validation, c.date_creation) <= p_date_fin)
    AND (p_serveuse_id IS NULL OR c.serveuse_id = p_serveuse_id)
    AND (p_table_id IS NULL OR c.table_id = p_table_id)
    AND (p_produit_id IS NULL OR ci.produit_id = p_produit_id);

  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.date DESC), '[]'::json)
  INTO v_rows
  FROM (
    SELECT
      c.id,
      c.numero_commande,
      COALESCE(c.date_validation, c.date_creation) AS date,
      c.montant_total,
      c.statut,
      c.canal,
      c.type_service,
      t2.numero AS table_numero,
      s.nom AS serveuse_nom,
      s.prenom AS serveuse_prenom,
      (SELECT COALESCE(SUM(f.montant_paye), 0) FROM factures f WHERE f.commande_id = c.id) AS montant_paye,
      (SELECT COALESCE(SUM(f.montant_restant), 0) FROM factures f WHERE f.commande_id = c.id) AS montant_restant
    FROM commandes c
    LEFT JOIN tables t2 ON t2.id = c.table_id
    LEFT JOIN profiles s ON s.id = c.serveuse_id
    WHERE c.etablissement_id = v_etab
      AND c.statut IN ('validee', 'terminee')
      AND (p_date_debut IS NULL OR COALESCE(c.date_validation, c.date_creation) >= p_date_debut)
      AND (p_date_fin IS NULL OR COALESCE(c.date_validation, c.date_creation) <= p_date_fin)
      AND (p_serveuse_id IS NULL OR c.serveuse_id = p_serveuse_id)
      AND (p_table_id IS NULL OR c.table_id = p_table_id)
      AND (p_produit_id IS NULL OR EXISTS (
        SELECT 1 FROM commande_items ci
        WHERE ci.commande_id = c.id AND ci.produit_id = p_produit_id
      ))
    ORDER BY COALESCE(c.date_validation, c.date_creation) DESC
    OFFSET v_offset LIMIT p_limit
  ) t;

  RETURN json_build_object(
    'transactions', v_rows,
    'total', v_total,
    'page', p_page,
    'limit', p_limit,
    'pages', CASE WHEN p_limit > 0 THEN CEIL(v_total::NUMERIC / p_limit) ELSE 0 END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_transactions(TIMESTAMPTZ, TIMESTAMPTZ, UUID, UUID, UUID, INTEGER, INTEGER) TO authenticated;

-- ============================================================================
-- 9. PLATS SERVIS (fuseau établissement)
-- ============================================================================

CREATE OR REPLACE VIEW public.plats_servis_journalier AS
WITH scope AS (
  SELECT p.etablissement_id,
         COALESCE(e.fuseau_horaire, 'Africa/Douala') AS tz
  FROM profiles p
  LEFT JOIN etablissements e ON e.id = p.etablissement_id
  WHERE p.id = auth.uid()
)
SELECT
  (COALESCE(c.date_validation, c.date_creation) AT TIME ZONE s.tz)::date AS jour,
  p.id AS produit_id,
  p.nom AS produit_nom,
  c.etablissement_id,
  SUM(ci.quantite) AS quantite_servie,
  SUM(ci.montant_ligne) AS chiffre_affaires,
  COUNT(DISTINCT c.id) AS nombre_commandes_concernees
FROM commande_items ci
JOIN commandes c ON ci.commande_id = c.id
JOIN produits p ON ci.produit_id = p.id
CROSS JOIN scope s
WHERE c.etablissement_id = s.etablissement_id
  AND c.statut IN ('validee', 'terminee')
  AND LOWER(BTRIM(p.categorie)) = 'nourriture'
GROUP BY (COALESCE(c.date_validation, c.date_creation) AT TIME ZONE s.tz)::date,
         p.id, p.nom, c.etablissement_id;

GRANT SELECT ON public.plats_servis_journalier TO authenticated;

NOTIFY pgrst, 'reload schema';
