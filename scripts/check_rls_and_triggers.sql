-- DIAGNOSTIC APPROFONDI : RLS ET TRIGGERS
-- Vérifie si le RLS est activé sur les tables critiques et liste tous les triggers restants.

-- 1. ETAT DU RLS (Row Level Security)
SELECT 
    tablename, 
    rowsecurity as rls_enabled 
FROM pg_tables 
WHERE schemaname = 'auth' 
AND tablename IN ('users', 'sessions', 'refresh_tokens');

-- 2. LISTE COMPLETE DES TRIGGERS (AUTH)
SELECT 
    event_object_table as table,
    trigger_name,
    action_statement as definition
FROM information_schema.triggers
WHERE event_object_schema = 'auth';

-- 3. POLITIQUES ACTIVES
SELECT 
    tablename, 
    policyname, 
    cmd, 
    roles, 
    qual 
FROM pg_policies 
WHERE schemaname = 'auth';
