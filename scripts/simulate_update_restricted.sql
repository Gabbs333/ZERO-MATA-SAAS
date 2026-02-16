-- Script pour simuler un UPDATE auth.users avec un rôle restreint
-- Cela permet de vérifier si le problème vient des permissions (RLS/Triggers)

DO $$
DECLARE
    v_user_id uuid;
BEGIN
    -- 1. Récupérer l'ID de serveuse@snackbar.cm
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'serveuse@snackbar.cm';
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Utilisateur serveuse@snackbar.cm non trouvé';
    END IF;

    -- 2. Switcher au rôle "anon" ou "authenticated" (pour simuler l'API)
    -- Note: On ne peut pas facilement impersonate "authenticated" sans set_config, 
    -- mais on peut tester si le problème persiste même en étant "postgres" (déjà testé et OK).
    -- Essayons de voir si des triggers spécifiques posent problème.
    
    RAISE NOTICE 'Test UPDATE auth.users pour ID %', v_user_id;
    
    -- Update test
    UPDATE auth.users 
    SET last_sign_in_at = now() 
    WHERE id = v_user_id;
    
    RAISE NOTICE 'UPDATE réussi.';
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ERREUR UPDATE: %', SQLERRM;
END $$;
