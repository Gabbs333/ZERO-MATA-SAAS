-- SIMULATION LOGIN AVEC RÔLE SUPABASE_AUTH_ADMIN (Version forcée)
-- Force le changement de rôle pour reproduire exactement l'erreur API

-- 1. Forcer le changement de rôle (nécessite les droits superuser)
SET ROLE supabase_auth_admin;

-- 2. Vérifier le changement
SELECT current_user as role_actuel, session_user as role_original;

-- 3. Simulation du login complet
DO $$
DECLARE
    v_user_id uuid;
    v_session_id uuid;
    v_token_id bigint;
    v_error_message text;
BEGIN
    RAISE NOTICE '=== SIMULATION LOGIN AVEC RÔLE % ===', current_user;

    -- Récupération de l'utilisateur
    SELECT id INTO v_user_id 
    FROM auth.users 
    WHERE email = 'serveuse@snackbar.cm';
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Utilisateur non trouvé';
    END IF;
    
    RAISE NOTICE 'Utilisateur ID: %', v_user_id;

    -- ÉTAPE 1: UPDATE last_sign_in_at (auth.users)
    BEGIN
        UPDATE auth.users 
        SET last_sign_in_at = now() 
        WHERE id = v_user_id;
        
        RAISE NOTICE '✅ UPDATE auth.users: SUCCÈS';
    EXCEPTION WHEN OTHERS THEN
        v_error_message := SQLERRM;
        RAISE NOTICE '❌ UPDATE auth.users: ÉCHEC - %', v_error_message;
    END;

    -- ÉTAPE 2: INSERT session (auth.sessions)
    BEGIN
        INSERT INTO auth.sessions (user_id, created_at, updated_at)
        VALUES (v_user_id, now(), now())
        RETURNING id INTO v_session_id;
        
        RAISE NOTICE '✅ INSERT auth.sessions: SUCCÈS (ID: %)', v_session_id;
    EXCEPTION WHEN OTHERS THEN
        v_error_message := SQLERRM;
        RAISE NOTICE '❌ INSERT auth.sessions: ÉCHEC - %', v_error_message;
        v_session_id := NULL;
    END;

    -- ÉTAPE 3: INSERT refresh token (auth.refresh_tokens)
    IF v_session_id IS NOT NULL THEN
        BEGIN
            INSERT INTO auth.refresh_tokens (token, user_id, parent, session_id, created_at, updated_at)
            VALUES (gen_random_uuid()::text, v_user_id, NULL, v_session_id, now(), now())
            RETURNING id INTO v_token_id;
            
            RAISE NOTICE '✅ INSERT auth.refresh_tokens: SUCCÈS (ID: %)', v_token_id;
        EXCEPTION WHEN OTHERS THEN
            v_error_message := SQLERRM;
            RAISE NOTICE '❌ INSERT auth.refresh_tokens: ÉCHEC - %', v_error_message;
        END;
    ELSE
        RAISE NOTICE '⚠️ INSERT auth.refresh_tokens: IGNORÉ (pas de session)';
    END IF;

    RAISE NOTICE '=== SIMULATION TERMINÉE ===';

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Erreur critique: %', SQLERRM;
END $$;

-- 4. Retour au rôle original
RESET ROLE;
SELECT current_user as role_retourne;