-- FIX FINAL POUR LE TRIGGER DE SESSION (Version corrigée CASCADE)
-- Ce script corrige les permissions et le search_path de la fonction simple_session_id
-- Ajout: Suppression explicite de TOUS les triggers potentiels et usage de CASCADE

BEGIN;

-- 1. S'assurer que l'extension pgcrypto est active (pour gen_random_uuid)
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

-- 2. Nettoyage des versions précédentes (tous les noms possibles)
DROP TRIGGER IF EXISTS ensure_session_id_trigger ON auth.sessions;
DROP TRIGGER IF EXISTS trg_simple_session_id ON auth.sessions; -- Celui mentionné dans l'erreur
DROP FUNCTION IF EXISTS public.simple_session_id() CASCADE; -- CASCADE pour être sûr

-- 3. Création de la fonction ROBUSTE
-- SECURITY DEFINER : S'exécute avec les droits de l'admin (contourne les RLS)
-- search_path : Défini explicitement pour trouver gen_random_uuid
CREATE OR REPLACE FUNCTION public.simple_session_id()
RETURNS trigger
SECURITY DEFINER
SET search_path = public, extensions, auth
LANGUAGE plpgsql
AS $$
BEGIN
    -- Génération défensive d'UUID si manquant
    IF NEW.id IS NULL THEN
        NEW.id := extensions.gen_random_uuid(); -- Appel qualifié explicite
    END IF;
    RETURN NEW;
END;
$$;

-- 4. Permissions explicites pour TOUS les rôles possibles
-- supabase_auth_admin est le rôle utilisé par l'API Auth
GRANT EXECUTE ON FUNCTION public.simple_session_id() TO postgres;
GRANT EXECUTE ON FUNCTION public.simple_session_id() TO service_role;
GRANT EXECUTE ON FUNCTION public.simple_session_id() TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.simple_session_id() TO anon;
GRANT EXECUTE ON FUNCTION public.simple_session_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.simple_session_id() TO public;

-- 5. Recréation du trigger sur auth.sessions
CREATE TRIGGER ensure_session_id_trigger
BEFORE INSERT ON auth.sessions
FOR EACH ROW
EXECUTE FUNCTION public.simple_session_id();

-- 6. Vérification
SELECT 
    '✅ FIX APPLIQUÉ' as status,
    p.proname as function_name,
    p.prosecdef as security_definer,
    p.proconfig as runtime_config,
    array_agg(grantee) as granted_to
FROM pg_proc p
JOIN information_schema.routine_privileges rp ON p.proname = rp.routine_name
WHERE p.proname = 'simple_session_id'
GROUP BY p.proname, p.prosecdef, p.proconfig;

COMMIT;
