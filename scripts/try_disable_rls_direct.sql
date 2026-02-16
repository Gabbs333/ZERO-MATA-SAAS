
-- Tente de désactiver le RLS directement (si ça échoue, on le saura)
ALTER TABLE auth.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE auth.sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE auth.refresh_tokens DISABLE ROW LEVEL SECURITY;
ALTER TABLE auth.identities DISABLE ROW LEVEL SECURITY;

RAISE NOTICE 'RLS Disabled on auth tables';
