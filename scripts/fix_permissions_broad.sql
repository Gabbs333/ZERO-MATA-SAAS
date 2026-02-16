
-- Grant explicit permissions to roles likely used by GoTrue
GRANT USAGE ON SCHEMA auth TO postgres, service_role, anon, authenticated, dashboard_user;
GRANT USAGE ON SCHEMA public TO postgres, service_role, anon, authenticated, dashboard_user;

GRANT ALL ON ALL TABLES IN SCHEMA auth TO postgres, service_role, dashboard_user;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO postgres, service_role, dashboard_user;

GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role, dashboard_user;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role, dashboard_user;

-- Ensure auth_admin role (if exists) has access
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    GRANT USAGE ON SCHEMA auth TO supabase_auth_admin;
    GRANT ALL ON ALL TABLES IN SCHEMA auth TO supabase_auth_admin;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO supabase_auth_admin;
    GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO supabase_auth_admin;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO supabase_auth_admin;
    RAISE NOTICE 'Granted permissions to supabase_auth_admin';
  END IF;

  RAISE NOTICE 'Permissions granted successfully';
END $$;
