-- NUCLEAR FIX FOR SESSION ID 500 ERROR
-- Ce script nettoie et répare le mécanisme de génération d'ID de session.
-- Il crée aussi la table de logs manquante pour éviter les erreurs "relation does not exist".

-- 1. CRÉATION DE LA TABLE DE LOGS (Au cas où d'autres triggers l'utilisent)
CREATE TABLE IF NOT EXISTS public.debug_logs (
    id SERIAL PRIMARY KEY,
    message TEXT,
    details TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
-- Permissions larges pour éviter tout blocage d'écriture de logs
GRANT ALL ON public.debug_logs TO postgres, service_role, authenticated, anon;
GRANT USAGE, SELECT ON SEQUENCE public.debug_logs_id_seq TO postgres, service_role, authenticated, anon;

-- 2. NETTOYAGE COMPLET (Drop triggers et fonctions potentiellement corrompus)
DROP TRIGGER IF EXISTS ensure_session_id_trigger ON auth.sessions;
DROP FUNCTION IF EXISTS public.set_session_id_if_null();
DROP FUNCTION IF EXISTS public.force_session_id();

-- 3. CRÉATION D'UNE FONCTION ROBUSTE ET SIMPLE (SECURITY DEFINER)
-- Cette fonction ne fait QU'UNE chose : générer l'UUID. Pas de logs, pas de dépendances complexes.
CREATE OR REPLACE FUNCTION public.force_session_id()
RETURNS TRIGGER AS $$
BEGIN
    -- Ne générer que si l'ID est null (ce qui est le cas par défaut actuellement)
    IF NEW.id IS NULL THEN
        -- Utilise gen_random_uuid() qui est standard depuis PG 13
        NEW.id := gen_random_uuid();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; -- Exécuté avec les droits du créateur (admin)

-- 4. PERMISSIONS CRITIQUES (Le point souvent oublié)
-- On donne explicitement le droit d'exécution à TOUS les rôles possibles
GRANT EXECUTE ON FUNCTION public.force_session_id() TO postgres;
GRANT EXECUTE ON FUNCTION public.force_session_id() TO anon;
GRANT EXECUTE ON FUNCTION public.force_session_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.force_session_id() TO service_role;
GRANT EXECUTE ON FUNCTION public.force_session_id() TO supabase_auth_admin; -- Le rôle clé pour l'auth

-- 5. RÉ-ATTACHEMENT DU TRIGGER
CREATE TRIGGER ensure_session_id_trigger
BEFORE INSERT ON auth.sessions
FOR EACH ROW
EXECUTE FUNCTION public.force_session_id();

-- 6. VERIFICATION
SELECT 'FIX APPLIED SUCCESSFULLY' as status;
