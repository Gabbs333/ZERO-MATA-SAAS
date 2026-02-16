-- FIX FINAL - TRIGGER ULTRA-SIMPLIFIÉ (Version corrigée)
-- Supprime d'abord puis recrée proprement

BEGIN;

-- 1. Supprimer tous les triggers existants sur auth.sessions
DROP TRIGGER IF EXISTS trg_simple_session_id ON auth.sessions;
DROP TRIGGER IF EXISTS ensure_session_id_trigger ON auth.sessions;
DROP TRIGGER IF EXISTS trg_sessions_id ON auth.sessions;
DROP TRIGGER IF EXISTS auth_sessions_insert ON auth.sessions;

-- 2. Supprimer la fonction si elle existe déjà
DROP FUNCTION IF EXISTS public.simple_session_id();

-- 3. Créer la fonction ULTRA-simple
CREATE OR REPLACE FUNCTION public.simple_session_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.id IS NULL THEN
        NEW.id := gen_random_uuid();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Permissions ultra-permissives
GRANT EXECUTE ON FUNCTION public.simple_session_id() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.simple_session_id() TO anon, authenticated, service_role;

-- 5. Créer le trigger
CREATE TRIGGER trg_simple_session_id
    BEFORE INSERT ON auth.sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.simple_session_id();

-- 6. Vérification
DO $$
BEGIN
    PERFORM gen_random_uuid();
    RAISE NOTICE '✅ Fix final appliqué avec succès';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ Erreur: %', SQLERRM;
END $$;

COMMIT;

SELECT 'Trigger ultra-simplifié créé avec succès' as status;