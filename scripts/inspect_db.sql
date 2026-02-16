-- Inspect functions and triggers
SELECT 
    n.nspname as schema,
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as args
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'log_audit_action';

-- Check triggers on profiles
SELECT 
    event_object_table as table_name,
    trigger_name,
    action_timing,
    event_manipulation
FROM information_schema.triggers
WHERE event_object_table = 'profiles';

-- Check triggers on auth.users (requires superuser mostly, but let's try via psql if possible or just rely on what we know)
-- Supabase exposes this via some views usually, but standard info schema is scoped to current user.
