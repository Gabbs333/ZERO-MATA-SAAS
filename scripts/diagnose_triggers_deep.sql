-- DIAGNOSTIC DEEP SCAN
-- Ce script va lister TOUT ce qui se déclenche automatiquement lors d'un login ou d'une modification utilisateur.

-- 1. Vérifier si le RLS est bien désactivé sur profiles (devrait être false si le script précédent a marché)
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'profiles';

-- 2. Lister TOUS les triggers sur les tables sensibles (auth.users, profiles, sessions)
-- On cherche un trigger caché qui ferait planter le système
SELECT 
    nspname as schema,
    relname as table,
    tgname as trigger_name,
    CASE tgtype::integer & 66
        WHEN 2 THEN 'BEFORE'
        WHEN 64 THEN 'INSTEAD OF'
        ELSE 'AFTER'
    END as timing,
    pg_get_triggerdef(pg_trigger.oid) as definition
FROM pg_trigger
JOIN pg_class ON pg_trigger.tgrelid = pg_class.oid
JOIN pg_namespace ON pg_class.relnamespace = pg_namespace.oid
WHERE nspname IN ('auth', 'public')
  AND relname IN ('users', 'profiles', 'sessions', 'refresh_tokens')
  AND tgisinternal = false -- Exclure les triggers internes de Postgres
ORDER BY relname;

-- 3. Vérifier les fonctions définies par l'utilisateur dans le schéma public
-- Pour voir s'il y a des fonctions "bizarres" ou récursives
SELECT 
    proname as function_name,
    prosrc as source_code
FROM pg_proc
JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid
WHERE pg_namespace.nspname = 'public';
