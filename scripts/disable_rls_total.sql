-- FIX NUCLEAR PERMISSIONS & DISABLE RLS ON AUTH
-- Ce script désactive le RLS sur toutes les tables d'authentification et accorde des droits explicites
-- pour éliminer toute cause liée aux permissions ou aux policies.

-- 1. Désactiver le RLS sur les tables critiques
ALTER TABLE auth.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE auth.sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE auth.refresh_tokens DISABLE ROW LEVEL SECURITY;

-- 2. Accorder les droits massifs (pour être sûr que supabase_auth_admin peut tout faire)
GRANT ALL ON ALL TABLES IN SCHEMA auth TO postgres, service_role, supabase_auth_admin, dashboard_user;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO postgres, service_role, supabase_auth_admin, dashboard_user;
GRANT ALL ON ALL ROUTINES IN SCHEMA auth TO postgres, service_role, supabase_auth_admin, dashboard_user;

-- 3. S'assurer que le trigger a bien accès à pgcrypto ou gen_random_uuid
GRANT EXECUTE ON FUNCTION gen_random_uuid() TO public, anon, authenticated, service_role, supabase_auth_admin;

-- 4. Vérification simple
SELECT 
    tablename, 
    rowsecurity as rls_enabled 
FROM pg_tables 
WHERE schemaname = 'auth' 
AND tablename IN ('users', 'sessions', 'refresh_tokens');
