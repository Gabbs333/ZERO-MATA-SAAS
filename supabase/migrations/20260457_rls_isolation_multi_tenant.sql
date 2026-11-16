-- Migration: Isolation multi-tenant — réactivation de la RLS sur les tables critiques
-- Description:
--   La RLS était **désactivée** (`relrowsecurity = false`) sur `factures`,
--   `commandes`, `commande_items`, `mouvements_stock` et `profiles`.
--   Conséquence : toute requête cliente qui ne filtre pas explicitement par
--   établissement (alertes de factures impayées, graphiques, exports) ramenait
--   les données de TOUS les établissements.
--
--   Correctifs :
--     1. Purge de TOUTES les policies existantes sur ces 5 tables (certaines,
--        dormantes, étaient récursives : elles auraient bloqué dès la
--        réactivation).
--     2. RLS réactivée avec des policies cloisonnées par établissement et sans
--        récursion : les lectures de `profiles` passent par des helpers
--        SECURITY DEFINER (`get_user_etablissement_id()`, `is_admin()` et le
--        nouveau `current_user_role()`), jamais par une sous-requête sur la
--        table elle-même.
--     3. Serveuses : accès limité à leurs propres commandes / factures ;
--        les autres rôles voient leur établissement.
--     4. Vue `factures_overdue` cloisonnée (une vue s'exécute avec les droits
--        de son propriétaire et ignore la RLS : le filtre doit être explicite).
--     5. `get_factures_impayees_alerts()` cloisonnée et corrigée (elle échouait
--        avec « structure of query does not match function result type » car
--        les montants sont des INTEGER).
--
-- Created: 2026-04-57

-- ============================================================================
-- 0. HELPERS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;

COMMENT ON FUNCTION public.current_user_role() IS
  'Rôle du membre connecté. SECURITY DEFINER : utilisable dans les policies de profiles sans récursion.';

-- ============================================================================
-- 1. PURGE DES POLICIES EXISTANTES
-- ============================================================================

DO $purge_policies$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('factures', 'commandes', 'commande_items', 'mouvements_stock', 'profiles')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END
$purge_policies$;

-- ============================================================================
-- 2. FACTURES
-- ============================================================================

ALTER TABLE public.factures ENABLE ROW LEVEL SECURITY;

CREATE POLICY factures_read ON public.factures
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR (
      public.current_user_role() IS DISTINCT FROM 'serveuse'
      AND etablissement_id = public.get_user_etablissement_id()
    )
    OR EXISTS (
      SELECT 1 FROM public.commandes c
      WHERE c.id = factures.commande_id
        AND c.serveuse_id = auth.uid()
    )
  );

CREATE POLICY factures_insert ON public.factures
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (
      etablissement_id = public.get_user_etablissement_id()
      AND public.current_user_role() IN ('comptoir', 'gerant', 'patron')
    )
  );

CREATE POLICY factures_update ON public.factures
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR (
      etablissement_id = public.get_user_etablissement_id()
      AND public.current_user_role() IN ('comptoir', 'gerant', 'patron')
    )
  )
  WITH CHECK (
    public.is_admin()
    OR (
      etablissement_id = public.get_user_etablissement_id()
      AND public.current_user_role() IN ('comptoir', 'gerant', 'patron')
    )
  );

CREATE POLICY factures_delete ON public.factures
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR (
      etablissement_id = public.get_user_etablissement_id()
      AND public.current_user_role() IN ('gerant', 'patron')
    )
  );

-- ============================================================================
-- 3. COMMANDES
-- ============================================================================

ALTER TABLE public.commandes ENABLE ROW LEVEL SECURITY;

CREATE POLICY commandes_read ON public.commandes
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR serveuse_id = auth.uid()
    OR (
      public.current_user_role() IS DISTINCT FROM 'serveuse'
      AND etablissement_id = public.get_user_etablissement_id()
    )
  );

CREATE POLICY commandes_insert ON public.commandes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (serveuse_id = auth.uid() AND statut = 'en_attente')
    OR (
      etablissement_id = public.get_user_etablissement_id()
      AND public.current_user_role() IN ('comptoir', 'gerant', 'patron')
    )
  );

CREATE POLICY commandes_update ON public.commandes
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR (
      etablissement_id = public.get_user_etablissement_id()
      AND public.current_user_role() IN ('comptoir', 'gerant', 'patron')
    )
    OR (serveuse_id = auth.uid() AND statut = 'en_attente')
  )
  WITH CHECK (
    public.is_admin()
    OR (
      etablissement_id = public.get_user_etablissement_id()
      AND public.current_user_role() IN ('comptoir', 'gerant', 'patron')
    )
    OR (serveuse_id = auth.uid() AND statut = 'en_attente')
  );

CREATE POLICY commandes_delete ON public.commandes
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR (
      etablissement_id = public.get_user_etablissement_id()
      AND public.current_user_role() IN ('gerant', 'patron')
    )
    OR (serveuse_id = auth.uid() AND statut = 'en_attente')
  );

-- ============================================================================
-- 4. COMMANDE_ITEMS
-- ============================================================================

ALTER TABLE public.commande_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY commande_items_read ON public.commande_items
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.commandes c
      WHERE c.id = commande_items.commande_id
        AND (
          c.serveuse_id = auth.uid()
          OR (
            public.current_user_role() IS DISTINCT FROM 'serveuse'
            AND c.etablissement_id = public.get_user_etablissement_id()
          )
        )
    )
  );

CREATE POLICY commande_items_write ON public.commande_items
  FOR ALL TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.commandes c
      WHERE c.id = commande_items.commande_id
        AND (
          c.serveuse_id = auth.uid()
          OR (
            public.current_user_role() IS DISTINCT FROM 'serveuse'
            AND c.etablissement_id = public.get_user_etablissement_id()
          )
        )
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.commandes c
      WHERE c.id = commande_items.commande_id
        AND (
          c.serveuse_id = auth.uid()
          OR (
            public.current_user_role() IS DISTINCT FROM 'serveuse'
            AND c.etablissement_id = public.get_user_etablissement_id()
          )
        )
    )
  );

-- ============================================================================
-- 5. MOUVEMENTS_STOCK
-- ============================================================================

ALTER TABLE public.mouvements_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY mouvements_stock_read ON public.mouvements_stock
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR etablissement_id = public.get_user_etablissement_id()
  );

CREATE POLICY mouvements_stock_insert ON public.mouvements_stock
  FOR INSERT TO authenticated
  WITH CHECK (
    etablissement_id IS NOT NULL
    AND (
      public.is_admin()
      OR (
        etablissement_id = public.get_user_etablissement_id()
        AND public.current_user_role() IN ('comptoir', 'gerant', 'patron')
      )
    )
  );

CREATE POLICY mouvements_stock_delete ON public.mouvements_stock
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR (
      etablissement_id = public.get_user_etablissement_id()
      AND public.current_user_role() IN ('gerant', 'patron')
    )
  );

-- ============================================================================
-- 6. PROFILES
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_read_self ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY profiles_read_etablissement ON public.profiles
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR (
      etablissement_id IS NOT NULL
      AND etablissement_id = public.get_user_etablissement_id()
    )
  );

CREATE POLICY profiles_insert ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (
      etablissement_id = public.get_user_etablissement_id()
      AND public.current_user_role() IN ('patron', 'gerant')
    )
  );

CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR id = auth.uid()
    OR (
      etablissement_id = public.get_user_etablissement_id()
      AND public.current_user_role() IN ('patron', 'gerant')
    )
  )
  WITH CHECK (
    public.is_admin()
    OR id = auth.uid()
    OR (
      etablissement_id = public.get_user_etablissement_id()
      AND public.current_user_role() IN ('patron', 'gerant')
    )
  );

CREATE POLICY profiles_delete ON public.profiles
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR (
      etablissement_id = public.get_user_etablissement_id()
      AND public.current_user_role() IN ('patron', 'gerant')
    )
  );

-- ============================================================================
-- 7. VUE factures_overdue + RPC d'alertes — cloisonnées
-- ============================================================================

CREATE OR REPLACE VIEW public.factures_overdue AS
SELECT
  f.id,
  f.numero_facture,
  f.commande_id,
  f.montant_total,
  f.montant_paye,
  f.montant_restant,
  f.statut,
  f.date_generation,
  f.date_paiement_complet,
  EXTRACT(EPOCH FROM (NOW() - f.date_generation)) / 3600 AS age_heures,
  EXTRACT(EPOCH FROM (NOW() - f.date_generation)) / 86400 AS age_jours,
  EXTRACT(EPOCH FROM (NOW() - f.date_generation)) / 604800 AS age_semaines,
  CASE
    WHEN EXTRACT(EPOCH FROM (NOW() - f.date_generation)) / 3600 > 168 THEN 'critique'
    WHEN EXTRACT(EPOCH FROM (NOW() - f.date_generation)) / 3600 > 72 THEN 'eleve'
    WHEN EXTRACT(EPOCH FROM (NOW() - f.date_generation)) / 3600 > 24 THEN 'moyen'
    ELSE 'faible'
  END AS niveau_alerte
FROM public.factures f
WHERE f.statut <> 'payee'
  AND EXTRACT(EPOCH FROM (NOW() - f.date_generation)) / 3600 > 24
  AND (
    public.is_admin()
    OR f.etablissement_id = public.get_user_etablissement_id()
  );

GRANT SELECT ON public.factures_overdue TO authenticated;

COMMENT ON VIEW public.factures_overdue IS
  'Factures impayées depuis plus de 24h, limitées à l''établissement de l''appelant.';

DROP FUNCTION IF EXISTS public.get_factures_impayees_alerts();

CREATE FUNCTION public.get_factures_impayees_alerts()
RETURNS TABLE (
  id UUID,
  numero_facture TEXT,
  commande_id UUID,
  montant_total INTEGER,
  montant_paye INTEGER,
  montant_restant INTEGER,
  statut TEXT,
  date_generation TIMESTAMPTZ,
  age_heures NUMERIC,
  age_jours NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_etab UUID := public.get_user_etablissement_id();
BEGIN
  RETURN QUERY
  SELECT
    f.id,
    f.numero_facture,
    f.commande_id,
    f.montant_total,
    f.montant_paye,
    f.montant_restant,
    f.statut,
    f.date_generation,
    EXTRACT(EPOCH FROM (NOW() - f.date_generation)) / 3600,
    EXTRACT(EPOCH FROM (NOW() - f.date_generation)) / 86400
  FROM public.factures f
  WHERE f.statut <> 'payee'
    AND EXTRACT(EPOCH FROM (NOW() - f.date_generation)) / 3600 > 24
    AND (public.is_admin() OR f.etablissement_id = v_etab)
  ORDER BY f.date_generation ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_factures_impayees_alerts() TO authenticated;

COMMENT ON FUNCTION public.get_factures_impayees_alerts() IS
  'Factures impayées depuis plus de 24h pour l''établissement de l''appelant.';

NOTIFY pgrst, 'reload schema';
