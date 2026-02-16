-- Diagnostic Script: List all triggers on auth.users and public.profiles
-- This helps identify any hidden triggers causing 500 errors during login/signup

SELECT 
    event_object_schema as table_schema,
    event_object_table as table_name,
    trigger_name,
    event_manipulation as event,
    action_timing as timing,
    action_statement as definition
FROM information_schema.triggers
WHERE 
    (event_object_schema = 'auth' AND event_object_table = 'users')
    OR 
    (event_object_schema = 'public' AND event_object_table = 'profiles');
