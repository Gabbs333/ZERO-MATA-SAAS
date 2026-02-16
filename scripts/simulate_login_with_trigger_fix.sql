DO $$
DECLARE
    v_user_id uuid;
    v_session_id uuid;
BEGIN
    -- 1. Récupérer l'user
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'serveuse@snackbar.cm';
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Utilisateur non trouvé';
    END IF;

    RAISE NOTICE '---------------------------------------------------';
    RAISE NOTICE 'TEST 1: INSERTION SESSION (Sans ID, via Trigger)';
    
    BEGIN
        INSERT INTO auth.sessions (user_id, created_at, updated_at)
        VALUES (v_user_id, now(), now())
        RETURNING id INTO v_session_id;
        
        IF v_session_id IS NULL THEN
            RAISE EXCEPTION 'ID Session est NULL après insertion - Le trigger n''a pas fonctionné';
        END IF;

        RAISE NOTICE '✅ SUCCÈS: Session créée avec ID %', v_session_id;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ ÉCHEC INSERT SESSION: %', SQLERRM;
        RAISE; -- Arrêter si ça échoue
    END;

    RAISE NOTICE '---------------------------------------------------';
    RAISE NOTICE 'TEST 2: INSERTION REFRESH TOKEN';
    
    BEGIN
        INSERT INTO auth.refresh_tokens (instance_id, token, user_id, revoked, created_at, updated_at, session_id)
        VALUES ('00000000-0000-0000-0000-000000000000', 'test_token_' || gen_random_uuid(), v_user_id, false, now(), now(), v_session_id);
        
        RAISE NOTICE '✅ SUCCÈS: Refresh Token créé';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ ÉCHEC INSERT REFRESH TOKEN: %', SQLERRM;
    END;

    RAISE NOTICE '---------------------------------------------------';
    RAISE NOTICE 'TEST 3: UPDATE USER (Last Sign In)';
    
    BEGIN
        UPDATE auth.users 
        SET last_sign_in_at = now() 
        WHERE id = v_user_id;
        
        RAISE NOTICE '✅ SUCCÈS: User updated (last_sign_in_at)';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ ÉCHEC UPDATE USER: %', SQLERRM;
    END;

    -- Nettoyage
    BEGIN
        DELETE FROM auth.sessions WHERE id = v_session_id;
        RAISE NOTICE 'Nettoyage effectué.';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Erreur nettoyage: %', SQLERRM;
    END;

END $$;
