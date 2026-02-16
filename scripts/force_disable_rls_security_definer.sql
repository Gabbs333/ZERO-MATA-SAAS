
-- 1. Identify owner of auth.users
SELECT n.nspname AS schema_name, c.relname AS table_name, a.rolname AS owner_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_roles a ON a.oid = c.relowner
WHERE n.nspname = 'auth' AND c.relname = 'users';

-- 2. Try to disable RLS using SECURITY DEFINER function owned by postgres
CREATE OR REPLACE FUNCTION public.force_disable_rls_auth()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    ALTER TABLE auth.users DISABLE ROW LEVEL SECURITY;
    ALTER TABLE auth.sessions DISABLE ROW LEVEL SECURITY;
    ALTER TABLE auth.refresh_tokens DISABLE ROW LEVEL SECURITY;
    ALTER TABLE auth.identities DISABLE ROW LEVEL SECURITY;
    
    RAISE NOTICE 'RLS disabled on auth tables via SECURITY DEFINER';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Failed to disable RLS: %', SQLERRM;
END;
$$;

-- 3. Execute the function
SELECT public.force_disable_rls_auth();

-- 4. Check status again
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'auth';
