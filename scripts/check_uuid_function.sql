-- Vérifier où se trouve exactement la fonction gen_random_uuid()
SELECT n.nspname as schema_name, p.proname as function_name
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'gen_random_uuid';
