-- Script de correction des permissions et du path pour le trigger de session
-- VERSION CORRIGÉE : Utilise le schéma PUBLIC car le schéma AUTH est protégé en écriture

BEGIN;

-- 1. Nettoyage (on supprime l'ancienne version si elle existe)
DROP TRIGGER IF EXISTS ensure_session_id_trigger ON auth.sessions;
-- On ne touche pas aux fonctions dans auth (permissions refusées), on utilise public
DROP FUNCTION IF EXISTS public.set_session_id_if_null(); 

-- 2. Création de la fonction dans PUBLIC (schéma accessible)
CREATE OR REPLACE FUNCTION public.set_session_id_if_null()
RETURNS trigger AS $$
BEGIN
    -- Si l'ID est NULL, on le génère
    IF NEW.id IS NULL THEN
        -- gen_random_uuid() est généralement dans 'extensions' ou 'public'
        NEW.id := gen_random_uuid();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql 
SECURITY DEFINER -- Exécute avec les droits du créateur (admin)
SET search_path = extensions, public, auth; -- Force le chemin pour trouver les fonctions UUID

-- 3. Réapplication du Trigger sur la table auth.sessions
-- (Supabase autorise souvent les triggers sur auth via le dashboard/SQL editor même si create function dans auth est bloqué)
CREATE TRIGGER ensure_session_id_trigger
    BEFORE INSERT ON auth.sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.set_session_id_if_null();

-- 4. Permissions explicites (Blindage)
-- On donne le droit d'exécuter cette fonction publique à tout le monde
GRANT EXECUTE ON FUNCTION public.set_session_id_if_null() TO postgres;
GRANT EXECUTE ON FUNCTION public.set_session_id_if_null() TO service_role;
GRANT EXECUTE ON FUNCTION public.set_session_id_if_null() TO anon; 
GRANT EXECUTE ON FUNCTION public.set_session_id_if_null() TO authenticated;

-- On s'assure que gen_random_uuid est accessible
GRANT USAGE ON SCHEMA extensions TO postgres, service_role, anon, authenticated;

COMMIT;

SELECT '✅ Trigger (Public) et Permissions mis à jour avec succès' as status;
