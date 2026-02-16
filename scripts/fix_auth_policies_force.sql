
DO $$
DECLARE
    r RECORD;
BEGIN
    -- 1. DROP ALL existing policies on auth tables (users, sessions, refresh_tokens, identities)
    FOR r IN 
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE schemaname = 'auth' 
        AND tablename IN ('users', 'sessions', 'refresh_tokens', 'identities')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON auth.%I', r.policyname, r.tablename);
        RAISE NOTICE 'Dropped policy % on auth.%', r.policyname, r.tablename;
    END LOOP;

    -- 2. CREATE permissive policies (using 'true' for both USING and WITH CHECK)
    --    This effectively makes the table public for all operations, assuming permissions are granted.
    
    -- auth.users
    EXECUTE 'CREATE POLICY "allow_all_users_policy" ON auth.users FOR ALL USING (true) WITH CHECK (true)';
    RAISE NOTICE 'Created permissive policy on auth.users';

    -- auth.sessions
    EXECUTE 'CREATE POLICY "allow_all_sessions_policy" ON auth.sessions FOR ALL USING (true) WITH CHECK (true)';
    RAISE NOTICE 'Created permissive policy on auth.sessions';

    -- auth.refresh_tokens
    EXECUTE 'CREATE POLICY "allow_all_refresh_tokens_policy" ON auth.refresh_tokens FOR ALL USING (true) WITH CHECK (true)';
    RAISE NOTICE 'Created permissive policy on auth.refresh_tokens';
    
    -- auth.identities
    EXECUTE 'CREATE POLICY "allow_all_identities_policy" ON auth.identities FOR ALL USING (true) WITH CHECK (true)';
    RAISE NOTICE 'Created permissive policy on auth.identities';

    -- 3. GRANT permissions to roles used by Supabase Auth (postgres, service_role, anon, authenticated)
    --    Even if RLS allows it, standard permissions must also allow it.
    GRANT ALL ON TABLE auth.users TO postgres, service_role, dashboard_user, authenticated, anon;
    GRANT ALL ON TABLE auth.sessions TO postgres, service_role, dashboard_user, authenticated, anon;
    GRANT ALL ON TABLE auth.refresh_tokens TO postgres, service_role, dashboard_user, authenticated, anon;
    GRANT ALL ON TABLE auth.identities TO postgres, service_role, dashboard_user, authenticated, anon;
    
    RAISE NOTICE 'Granted ALL permissions on auth tables to postgres, service_role, dashboard_user, authenticated, anon';

END $$;
