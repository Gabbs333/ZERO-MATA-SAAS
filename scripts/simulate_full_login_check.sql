-- Script de simulation COMPLÈTE du flux de login (INSERT session + UPDATE user)
-- Cela permet d'identifier exactement quelle ligne provoque l'erreur 500.

DO $$
DECLARE
    v_user_id uuid;
    v_session_id uuid;
    v_col_default text;
BEGIN
    RAISE NOTICE '---------------------------------------------------';
    RAISE NOTICE 'TEST 1: VÉRIFICATION CONFIGURATION ID';
    
    SELECT column_default INTO v_col_default
    FROM information_schema.columns
    WHERE table_schema = 'auth' 
      AND table_name = 'sessions' 
      AND column_name = 'id';

    RAISE NOTICE 'Valeur par défaut actuelle pour auth.sessions.id : %', COALESCE(v_col_default, 'NULL (CATASTROPHE !)');
    
    IF v_col_default IS NULL THEN
        RAISE EXCEPTION 'ARRÊT IMMÉDIAT: La colonne id n''a pas de valeur par défaut. Le fix précédent n''a pas fonctionné.';
    END IF;

    -- Récupérer l'ID de l'utilisateur
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'serveuse@snackbar.cm';
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Utilisateur serveuse@snackbar.cm non trouvé';
    END IF;

    RAISE NOTICE '---------------------------------------------------';
    RAISE NOTICE 'TEST 2: INSERTION SESSION';
    
    BEGIN
        INSERT INTO auth.sessions (user_id, created_at, updated_at)
        VALUES (v_user_id, now(), now())
        RETURNING id INTO v_session_id;
        
        RAISE NOTICE '✅ SUCCÈS: Session créée avec ID %', v_session_id;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ ÉCHEC INSERT SESSION: %', SQLERRM;
        RAISE NOTICE '   Détail: %', SQLSTATE;
    END;

    RAISE NOTICE '---------------------------------------------------';
    RAISE NOTICE 'TEST 3: INSERTION REFRESH TOKEN';
    
    BEGIN
        INSERT INTO auth.refresh_tokens (instance_id, token, user_id, revoked, created_at, updated_at, session_id)
        VALUES ('00000000-0000-0000-0000-000000000000', 'test_token_' || gen_random_uuid(), v_user_id, false, now(), now(), v_session_id);
        
        RAISE NOTICE '✅ SUCCÈS: Refresh Token créé';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ ÉCHEC INSERT REFRESH TOKEN: %', SQLERRM;
    END;

    RAISE NOTICE '---------------------------------------------------';
    RAISE NOTICE 'TEST 4: UPDATE USER (Last Sign In)';
    
    BEGIN
        UPDATE auth.users 
        SET last_sign_in_at = now() 
        WHERE id = v_user_id;
        
        RAISE NOTICE '✅ SUCCÈS: User updated (last_sign_in_at)';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ ÉCHEC UPDATE USER: %', SQLERRM;
    END;

    -- Nettoyage
    IF v_session_id IS NOT NULL THEN
        DELETE FROM auth.sessions WHERE id = v_session_id;
        RAISE NOTICE 'Nettoyage effectué.';
    END IF;

END $$;
