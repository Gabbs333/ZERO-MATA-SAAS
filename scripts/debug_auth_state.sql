-- Check triggers on auth.users
SELECT 
    trigger_schema,
    trigger_name,
    event_manipulation,
    action_statement,
    action_orientation,
    action_timing
FROM information_schema.triggers
WHERE event_object_schema = 'auth' 
AND event_object_table = 'users';

-- Check RLS on auth.users (usually not enabled, but good to check)
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class
WHERE oid = 'auth.users'::regclass;

-- Check if we can select from auth.users (as superuser/postgres)
SELECT count(*) FROM auth.users;

-- Check profiles trigger
SELECT 
    trigger_schema,
    trigger_name,
    event_manipulation
FROM information_schema.triggers
WHERE event_object_schema = 'public' 
AND event_object_table = 'profiles';
