-- FIX FINAL - TRIGGER ULTRA-SIMPLIFIÉ POUR SUPABASE AUTH
-- Ce trigger contourne complètement les problèmes de permissions/RLS
-- en étant le plus simple et accessible possible pour tous les rôles

BEGIN;

-- 1. Supprimer tous les triggers existants sur auth.sessions
DROP TRIGGER IF EXISTS ensure_session_id_trigger ON auth.sessions;
DROP TRIGGER IF EXISTS trg_sessions_id ON auth.sessions;
DROP TRIGGER IF EXISTS auth_sessions_insert ON auth.sessions;

-- 2. Créer une fonction ULTRA-simple (pas de SECURITY DEFINER complexe)
CREATE OR REPLACE FUNCTION public.simple_session_id()
RETURNS TRIGGER AS $$
BEGIN
    -- Génération d'ID uniquement si NULL (évite les conflits)
    IF NEW.id IS NULL THEN
        NEW.id := gen_random_uuid();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Permissions ultra-permissives (tous les rôles importants)
GRANT EXECUTE ON FUNCTION public.simple_session_id() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.simple_session_id() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.simple_session_id() TO supabase_auth_admin;

-- 4. Créer le trigger le plus simple possible
CREATE TRIGGER trg_simple_session_id
    BEFORE INSERT ON auth.sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.simple_session_id();

-- 5. Vérifier que gen_random_uuid est bien accessible
DO $$
BEGIN
    PERFORM gen_random_uuid();
    RAISE NOTICE '✅ gen_random_uuid() accessible - Fix appliqué avec succès';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ gen_random_uuid() inaccessible - %', SQLERRM;
END $$;

COMMIT;

-- Message de confirmation
SELECT 'Fix final appliqué : Trigger ultra-simplifié pour auth.sessions' as status;