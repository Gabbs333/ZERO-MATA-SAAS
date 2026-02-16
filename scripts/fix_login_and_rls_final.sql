-- FIX COMPLET ET FINAL : LOGIN + RLS
-- Ce script corrige :
-- 1. Les mots de passe (force à "password123")
-- 2. Les politiques RLS (supprime la récursion infinie)
-- 3. Les permissions (restaure l'accès au schéma)

BEGIN;

-- ==============================================================================
-- 1. CORRECTION DES MOTS DE PASSE (Au cas où ils seraient corrompus)
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

UPDATE auth.users 
SET encrypted_password = crypt('password123', gen_salt('bf'))
WHERE email IN ('admin@snackbar.cm', 'patron@snackbar.cm', 'comptoir@snackbar.cm', 'serveuse@snackbar.cm');


-- ==============================================================================
-- 2. NETTOYAGE COMPLET RLS
-- ==============================================================================
-- Désactiver RLS temporairement pour éviter tout blocage immédiat
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- Supprimer les fonctions problématiques
DROP FUNCTION IF EXISTS get_user_role() CASCADE;
DROP FUNCTION IF EXISTS is_user_active() CASCADE;

-- Supprimer TOUTES les politiques sur profiles pour repartir à zéro
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Patron can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Patron can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Patron can update profiles" ON profiles;
DROP POLICY IF EXISTS "Patron can delete profiles" ON profiles;
DROP POLICY IF EXISTS "Admin full access" ON profiles;
DROP POLICY IF EXISTS "Public profiles access" ON profiles;


-- ==============================================================================
-- 3. RECRÉATION DES FONCTIONS SÉCURISÉES
-- ==============================================================================
-- IMPORTANT : On force le search_path pour éviter les détournements
-- IMPORTANT : SECURITY DEFINER permet d'exécuter avec les droits de créateur (postgres)

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
DECLARE
  user_role text;
BEGIN
  -- On interroge directement la table. Comme c'est SECURITY DEFINER, 
  -- ça ignore les RLS de la table profiles pour cette requête.
  SELECT role INTO user_role FROM public.profiles WHERE id = auth.uid();
  RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_user_active()
RETURNS BOOLEAN AS $$
DECLARE
  user_active boolean;
BEGIN
  SELECT COALESCE(actif, FALSE) INTO user_active FROM public.profiles WHERE id = auth.uid();
  RETURN user_active;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;


-- ==============================================================================
-- 4. RECRÉATION DES POLITIQUES SIMPLIFIÉES
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 1. Lecture : Chacun voit son propre profil
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

-- 2. Lecture : Admin et Patron voient TOUT
-- On utilise une fonction optimisée pour éviter la récursion
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
-- 5. PERMISSIONS DE BASE
-- ==============================================================================
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON public.profiles TO authenticated;

COMMIT;

DO $$
BEGIN
  RAISE NOTICE 'Correction complète appliquée : Mots de passe réinitialisés et RLS réparé.';
END $$;
