-- Simulation d'un UPDATE sur auth.users (comme lors d'un login)
-- But : Vérifier si un trigger sur auth.users plante la mise à jour de last_sign_in_at

DO $$
DECLARE
    v_user_id uuid;
BEGIN
    -- 1. Récupérer l'ID
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'serveuse@snackbar.cm';
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Utilisateur serveuse@snackbar.cm non trouvé';
    END IF;

    RAISE NOTICE 'Test Update pour User ID : %', v_user_id;

    -- 2. Tenter l'UPDATE (transaction annulée à la fin)
    UPDATE auth.users 
    SET last_sign_in_at = now() 
    WHERE id = v_user_id;
    
    RAISE NOTICE '✅ SUCCÈS : UPDATE auth.users passé sans erreur !';

    -- Rollback volontaire pour ne pas laisser de traces
    RAISE EXCEPTION 'TEST_OK_ROLLBACK';

EXCEPTION 
    WHEN OTHERS THEN
        IF SQLERRM = 'TEST_OK_ROLLBACK' THEN
            RAISE NOTICE 'Test terminé avec succès (Rollback effectué)';
        ELSE
            RAISE NOTICE '❌ ÉCHEC UPDATE : % (Code: %)', SQLERRM, SQLSTATE;
            RAISE NOTICE '💡 Ce test confirme qu''un trigger sur auth.users bloque le login.';
        END IF;
END $$;
