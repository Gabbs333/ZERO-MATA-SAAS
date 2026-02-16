-- FIX ROBUST SESSION ID TRIGGER
-- Ce script corrige le problème de search_path qui empêche probablement supabase_auth_admin
-- de trouver la fonction gen_random_uuid() lors de la connexion API.

BEGIN;

-- 1. Redéfinition de la fonction avec search_path explicite
CREATE OR REPLACE FUNCTION public.force_session_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.id IS NULL THEN
        -- On utilise gen_random_uuid() qui est dans extensions ou public
        -- Grâce au search_path défini ci-dessous, Postgres le trouvera.
        NEW.id := gen_random_uuid();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, extensions, auth, pg_temp; -- CRUCIAL: Définit où chercher les fonctions

-- 2. Permissions explicites
GRANT EXECUTE ON FUNCTION public.force_session_id() TO postgres, service_role, authenticated, anon, supabase_auth_admin;

-- 3. Récréation du trigger
DROP TRIGGER IF EXISTS ensure_session_id_trigger ON auth.sessions;

CREATE TRIGGER ensure_session_id_trigger
    BEFORE INSERT ON auth.sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.force_session_id();

COMMIT;

-- 4. Message de confirmation (dans un bloc DO pour être valide)
DO $$
BEGIN
    RAISE NOTICE 'Fix appliqué : Trigger sécurisé avec search_path explicite.';
END $$;
