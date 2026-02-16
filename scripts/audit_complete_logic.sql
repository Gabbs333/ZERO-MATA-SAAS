-- AUDIT COMPLET DE LA LOGIQUE D'AUTHENTIFICATION ET DES TRIGGERS
-- Ce script génère une vue d'ensemble de tous les éléments actifs lors d'une connexion/inscription.

-- 1. TRIGGERS SUR AUTH.USERS
SELECT 
    event_object_schema as schema,
    event_object_table as table,
    trigger_name,
    event_manipulation as event,
    action_timing as timing,
    action_statement as definition
FROM information_schema.triggers
WHERE event_object_schema = 'auth' AND event_object_table = 'users';

-- 2. TRIGGERS SUR PUBLIC.PROFILES (souvent liés à auth.users)
SELECT 
    event_object_schema as schema,
    event_object_table as table,
    trigger_name,
    event_manipulation as event,
    action_timing as timing,
    action_statement as definition
FROM information_schema.triggers
WHERE event_object_schema = 'public' AND event_object_table = 'profiles';

-- 3. FONCTIONS DÉCLENCHÉES (SOURCE CODE LIMITÉ)
-- Récupère le code des fonctions utilisées par les triggers ci-dessus
SELECT 
    n.nspname as schema,
    p.proname as function_name,
    pg_get_functiondef(p.oid) as source_code
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname IN ('public', 'auth')
AND (
    p.proname ILIKE '%handle_new_user%' 
    OR p.proname ILIKE '%sync%' 
    OR p.proname ILIKE '%update%'
    OR p.proname ILIKE '%ensure%'
    OR p.proname ILIKE '%log%'
);

-- 4. POLITIQUES RLS (ROW LEVEL SECURITY)
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname IN ('auth', 'public') 
AND tablename IN ('users', 'profiles', 'sessions', 'refresh_tokens');

-- 5. VERIFICATION DE LA DEFINITION DU TRIGGER DE SESSION (CRITIQUE)
-- On verifie le code source de la fonction pour voir si elle essaie d'ecrire dans une table inexistante
SELECT 
    p.proname as function_name,
    pg_get_functiondef(p.oid) as source_code
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND p.proname = 'set_session_id_if_null';

-- 6. VERIFICATION DES COLONNES DE SESSION
SELECT column_name, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'auth' AND table_name = 'sessions' AND column_name = 'id';
