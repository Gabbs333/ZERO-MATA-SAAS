-- FIX NETTOYAGE COMPLET DES POLITIQUES RÉCURSIVES
-- Ce script supprime TOUTES les politiques RLS connues qui causent la récursion infinie.
-- Il restaure ensuite un accès propre et sécurisé.

BEGIN;

-- ==============================================================================
-- 1. SUPPRESSION DE TOUTES LES POLITIQUES SUSCEPTIBLES D'ÊTRE RÉCURSIVES
-- ==============================================================================

-- Politiques "Multi-Tenant" (Source de la récursion "patron_read_establishment_profiles")
DROP POLICY IF EXISTS "users_read_own_profile" ON profiles;
DROP POLICY IF EXISTS "patron_read_establishment_profiles" ON profiles;
DROP POLICY IF EXISTS "patron_insert_establishment_profiles" ON profiles;
DROP POLICY IF EXISTS "patron_update_establishment_profiles" ON profiles;
DROP POLICY IF EXISTS "prevent_etablissement_id_modification" ON profiles;

-- Politiques "Admin" (Pour être sûr qu'il n'y a pas de conflit)
DROP POLICY IF EXISTS "admin_read_all_profiles" ON profiles;
DROP POLICY IF EXISTS "admin_insert_profiles" ON profiles;
DROP POLICY IF EXISTS "admin_update_all_profiles" ON profiles;

-- Politiques "Originales" (Au cas où elles traînent encore)
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Patron can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Patron can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Patron can update profiles" ON profiles;
DROP POLICY IF EXISTS "Patron can delete profiles" ON profiles;
DROP POLICY IF EXISTS "Admin full access" ON profiles;
DROP POLICY IF EXISTS "Public profiles access" ON profiles;
DROP POLICY IF EXISTS "Admin and Patron view all" ON profiles;
DROP POLICY IF EXISTS "Admin and Patron manage profiles" ON profiles;


-- ==============================================================================
-- 2. RESTAURATION DES POLITIQUES SÉCURISÉES (GARANTIES SANS RÉCURSION)
-- ==============================================================================
-- On réutilise la logique de get_user_role() qui est SECURITY DEFINER (donc safe)

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 1. Lecture : Chacun voit son propre profil
CREATE POLICY "safe_users_read_own_profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

-- 2. Lecture : Admin et Patron voient TOUT (Utilise la fonction safe get_user_role)
CREATE POLICY "safe_admin_patron_view_all"
  ON profiles FOR SELECT
  USING (
    get_user_role() IN ('admin', 'patron')
  );

-- 3. Écriture : Admin et Patron peuvent gérer les profils
CREATE POLICY "safe_admin_patron_manage_all"
  ON profiles FOR ALL
  USING (
    get_user_role() IN ('admin', 'patron')
  );

-- ==============================================================================
-- 3. VERIFICATION ET VALIDATION
-- ==============================================================================
-- On s'assure que les fonctions critiques existent bien (au cas où le script précédent n'a pas marché)

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role FROM public.profiles WHERE id = auth.uid();
  RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

COMMIT;

DO $$
BEGIN
  RAISE NOTICE 'Nettoyage des politiques récursives terminé. Accès restauré.';
END $$;
