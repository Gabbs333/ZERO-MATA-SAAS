-- DIAGNOSTIC APPROFONDI (TRADUCTION EN ERREUR 500)
-- On cherche ce qui peut faire planter la transaction de login.

-- 1. Vérifier si RLS est vraiment désactivé sur profiles
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'profiles';

-- 2. Lister les triggers sur auth.sessions (souvent oubliés)
SELECT 
    event_object_table as table,
    trigger_name,
    event_manipulation as event,
    action_statement as definition
FROM information_schema.triggers
WHERE event_object_schema = 'auth' AND event_object_table = 'sessions';

-- 3. Lister les triggers sur auth.refresh_tokens
SELECT 
    event_object_table as table,
    trigger_name,
    event_manipulation as event
FROM information_schema.triggers
WHERE event_object_schema = 'auth' AND event_object_table = 'refresh_tokens';

-- 4. Lister les triggers RESTANTS sur auth.users (pour être sûr)
SELECT 
    trigger_name,
    event_manipulation as event
FROM information_schema.triggers
WHERE event_object_schema = 'auth' AND event_object_table = 'users'
AND trigger_name NOT LIKE 'supabase_%'; -- On exclut les systèmes

-- 5. Vérifier les politiques qui s'appliquent au SELECT sur profiles (au cas où un trigger fait un SELECT)
SELECT * FROM pg_policies WHERE tablename = 'profiles';
