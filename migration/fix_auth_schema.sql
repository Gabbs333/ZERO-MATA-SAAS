
-- Fix pour "Database error querying schema" sur Supabase Auth
-- Ce script ajoute des triggers pour garantir que les IDs sont générés si manquants
-- dans auth.sessions et auth.refresh_tokens.

-- 1. Fix auth.sessions
CREATE OR REPLACE FUNCTION auth.set_session_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.id IS NULL THEN
    NEW.id := gen_random_uuid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS ensure_session_id ON auth.sessions;
CREATE TRIGGER ensure_session_id
  BEFORE INSERT ON auth.sessions
  FOR EACH ROW
  EXECUTE FUNCTION auth.set_session_id();

-- 2. Fix auth.refresh_tokens
CREATE OR REPLACE FUNCTION auth.set_refresh_token_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.id IS NULL THEN
    NEW.id := gen_random_uuid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS ensure_refresh_token_id ON auth.refresh_tokens;
CREATE TRIGGER ensure_refresh_token_id
  BEFORE INSERT ON auth.refresh_tokens
  FOR EACH ROW
  EXECUTE FUNCTION auth.set_refresh_token_id();

RAISE NOTICE 'Fix appliqué pour auth.sessions et auth.refresh_tokens';
