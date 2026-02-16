-- FIX ULTIME : FONCTIONS MANQUANTES + RLS + AUDIT
-- Ce script :
-- 1. Définit les fonctions d'audit manquantes (log_audit_action) pour l'app Admin
-- 2. Définit les helpers (get_current_user_etablissement_id)
-- 3. Répare définitivement la récursion RLS avec des fonctions SECURITY DEFINER robustes
-- 4. Nettoie et restaure les politiques de sécurité

BEGIN;

-- ==============================================================================
-- 1. NETTOYAGE PRÉALABLE (Pour éviter les conflits de signature)
-- ==============================================================================
DROP FUNCTION IF EXISTS public.get_user_role() CASCADE;
DROP FUNCTION IF EXISTS public.log_audit_action(TEXT, TEXT, UUID, JSONB, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_current_user_etablissement_id() CASCADE;
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Admin and Patron view all" ON profiles;
DROP POLICY IF EXISTS "Admin and Patron manage profiles" ON profiles;

-- ==============================================================================
-- 2. FONCTIONS DE BASE (RLS HELPERS) - SECURITY DEFINER CRITIQUE
-- ==============================================================================

-- Fonction pour récupérer le rôle sans déclencher de boucle RLS
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
DECLARE
  user_role text;
BEGIN
  -- Accès direct à la table en mode super-utilisateur (SECURITY DEFINER)
  SELECT role INTO user_role FROM public.profiles WHERE id = auth.uid();
  RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;


-- Fonction pour récupérer l'établissement sans boucle RLS
CREATE OR REPLACE FUNCTION public.get_current_user_etablissement_id()
RETURNS UUID AS $$
DECLARE
  user_etablissement_id uuid;
BEGIN
  SELECT etablissement_id INTO user_etablissement_id FROM public.profiles WHERE id = auth.uid();
  RETURN user_etablissement_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;


-- ==============================================================================
-- 3. FONCTION D'AUDIT (Manquante pour l'App Admin)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.log_audit_action(
  p_action TEXT,
  p_entite TEXT,
  p_entite_id UUID,
  p_details JSONB DEFAULT NULL,
  p_etablissement_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_etablissement_id UUID;
  v_utilisateur_id UUID;
BEGIN
  -- Get current user ID
  v_utilisateur_id := auth.uid();
  
  -- Determine etablissement_id
  IF p_etablissement_id IS NOT NULL THEN
    v_etablissement_id := p_etablissement_id;
  ELSIF v_utilisateur_id IS NOT NULL THEN
    -- Utilise la fonction sécurisée définie plus haut
    v_etablissement_id := get_current_user_etablissement_id();
  ELSE
    v_etablissement_id := NULL;
  END IF;
  
  -- Insert audit log entry (Si la table existe)
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'audit_logs') THEN
      INSERT INTO public.audit_logs (
        utilisateur_id,
        action,
        entite,
        entite_id,
        etablissement_id,
        details_apres
      ) VALUES (
        v_utilisateur_id,
        p_action,
        p_entite,
        p_entite_id::TEXT,
        v_etablissement_id,
        p_details
      );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ==============================================================================
-- 4. POLITIQUES DE SÉCURITÉ (RLS)
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 1. Lecture : Chacun voit son propre profil (Condition simple, pas de fonction complexe)
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

-- 2. Lecture : Admin et Patron voient TOUT
-- Utilise get_user_role() qui est SECURITY DEFINER -> Pas de récursion
CREATE POLICY "Admin and Patron view all"
  ON profiles FOR SELECT
  USING (
    get_user_role() IN ('admin', 'patron')
  );

-- 3. Écriture : Admin et Patron peuvent gérer les profils
CREATE POLICY "Admin and Patron manage profiles"
  ON profiles FOR ALL
  USING (
    get_user_role() IN ('admin', 'patron')
  );

-- ==============================================================================
-- 5. PERMISSIONS FINALES
-- ==============================================================================
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON public.profiles TO authenticated;
-- Grant execute sur les fonctions RPC
GRANT EXECUTE ON FUNCTION public.log_audit_action TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role TO authenticated;

COMMIT;

DO $$
BEGIN
  RAISE NOTICE 'Correction appliquée : Fonctions audit ajoutées, RLS réparé, Permissions accordées.';
END $$;
