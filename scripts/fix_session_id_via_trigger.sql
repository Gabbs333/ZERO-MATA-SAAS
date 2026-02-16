-- Solution de contournement "MacGyver" : Trigger pour générer l'ID manquant
-- Si l'ALTER TABLE est bloqué par les permissions, un trigger peut parfois passer ou être la seule solution.

-- 1. Créer la fonction de correction (dans public pour éviter les droits restreints de auth)
CREATE OR REPLACE FUNCTION public.set_session_id_if_null()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
BEGIN
    -- Si l'ID est manquant, on le génère nous-mêmes
    IF NEW.id IS NULL THEN
        NEW.id := gen_random_uuid();
    END IF;
    RETURN NEW;
END;
$$;

-- 2. Tenter d'attacher le trigger à la table auth.sessions
-- Note: Si cela échoue avec 42501, c'est que Supabase a verrouillé la table à double tour.
DO $$
BEGIN
    DROP TRIGGER IF EXISTS ensure_session_id_trigger ON auth.sessions;
    
    CREATE TRIGGER ensure_session_id_trigger
    BEFORE INSERT ON auth.sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.set_session_id_if_null();
    
    RAISE NOTICE '✅ SUCCÈS : Trigger de réparation installé ! Le login devrait fonctionner.';
EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE '❌ ÉCHEC (42501) : Impossible de créer le trigger.';
    RAISE NOTICE 'Dernier recours : Il faut contacter le support Supabase ou recréer le projet.';
WHEN OTHERS THEN
    RAISE NOTICE '❌ ERREUR IMPRÉVUE : %', SQLERRM;
END $$;
