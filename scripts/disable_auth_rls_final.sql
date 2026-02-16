-- DÉSACTIVATION SÉCURITÉ SYSTÈME AUTH
-- Ce script désactive le RLS sur les tables système critiques de Supabase Auth.
-- Le RLS ne devrait JAMAIS être activé sur ces tables car cela interfère avec le moteur d'authentification.

-- 1. Désactiver RLS sur auth.users (CRITIQUE)
ALTER TABLE auth.users DISABLE ROW LEVEL SECURITY;

-- 2. Désactiver RLS sur auth.sessions (CRITIQUE pour le login)
ALTER TABLE auth.sessions DISABLE ROW LEVEL SECURITY;

-- 3. Désactiver RLS sur auth.refresh_tokens (CRITIQUE pour le refresh)
ALTER TABLE auth.refresh_tokens DISABLE ROW LEVEL SECURITY;

-- 4. Vérification immédiate
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'auth' 
AND tablename IN ('users', 'sessions', 'refresh_tokens');
