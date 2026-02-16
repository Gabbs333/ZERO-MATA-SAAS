-- CRÉATION D'UN SYSTÈME DE LOGGING POUR DÉBUGGER LE TRIGGER

-- 1. Table de logs
CREATE TABLE IF NOT EXISTS public.debug_logs (
    id SERIAL PRIMARY KEY,
    message TEXT,
    details TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Permettre à tout le monde d'écrire dans les logs (pour le debug)
GRANT ALL ON public.debug_logs TO public;
GRANT ALL ON public.debug_logs TO anon;
GRANT ALL ON public.debug_logs TO authenticated;
GRANT ALL ON public.debug_logs TO service_role;
GRANT ALL ON public.debug_logs TO supabase_auth_admin;
GRANT USAGE, SELECT, UPDATE ON SEQUENCE public.debug_logs_id_seq TO public;

-- 2. Modification de la fonction pour logger
CREATE OR REPLACE FUNCTION public.set_session_id_if_null()
RETURNS TRIGGER AS $$
BEGIN
    -- Log début exécution
    -- INSERT INTO public.debug_logs (message, details) VALUES ('Trigger start', 'User: ' || current_user);
    
    IF NEW.id IS NULL THEN
        BEGIN
            NEW.id := gen_random_uuid();
        EXCEPTION WHEN OTHERS THEN
            INSERT INTO public.debug_logs (message, details) 
            VALUES ('ERREUR gen_random_uuid', SQLERRM || ' - ' || SQLSTATE);
            -- Tenter un fallback (si pgcrypto manque)
            NEW.id := uuid_generate_v4(); -- Essaie une autre fonction si dispo
        END;
    END IF;
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.debug_logs (message, details) 
    VALUES ('ERREUR CRITIQUE TRIGGER', SQLERRM || ' - ' || SQLSTATE);
    RETURN NEW; -- Ne pas bloquer l'insertion même si erreur (ça plantera plus loin si ID null, mais on aura le log)
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Accorder les droits (rappel)
GRANT EXECUTE ON FUNCTION public.set_session_id_if_null() TO supabase_auth_admin;

SELECT 'Système de log installé' as status;
