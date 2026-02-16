-- DIAGNOSTIC APPROFONDI AUTH & TRIGGERS
-- Ce script va vérifier l'état réel du RLS, les triggers (même internes) et l'état du compte utilisateur.

-- 1. VÉRIFICATION ÉTAT RLS (Doit être 'false' pour users, sessions, refresh_tokens si le script précédent a fonctionné)
SELECT 
    schemaname, 
    tablename, 
    rowsecurity 
FROM pg_tables 
WHERE schemaname = 'auth' 
  AND tablename IN ('users', 'sessions', 'refresh_tokens');

-- 2. VÉRIFICATION DES TRIGGERS VIA PG_TRIGGER (Plus fiable que information_schema)
-- Cela listera TOUS les triggers sur auth.users et public.profiles
SELECT 
    n.nspname as schema_name,
    c.relname as table_name,
    t.tgname as trigger_name,
    CASE t.tgenabled 
        WHEN 'O' THEN 'Enabled'
        WHEN 'D' THEN 'Disabled'
        WHEN 'R' THEN 'Replica'
        WHEN 'A' THEN 'Always'
    END as status,
    t.tgisinternal as is_internal
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname IN ('auth', 'public')
  AND c.relname IN ('users', 'profiles')
ORDER BY schema_name, table_name;

-- 3. VÉRIFICATION DU COMPTE UTILISATEUR
SELECT 
    id, 
    email, 
    role, 
    confirmed_at, 
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data
FROM auth.users 
WHERE email = 'serveuse@ck-f.fr';
