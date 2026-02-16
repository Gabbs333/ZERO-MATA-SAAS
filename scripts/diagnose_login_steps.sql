-- DIAGNOSTIC COMPLET DES ÉTAPES DE LOGIN (avec messages visibles)
-- Ce script simule les 3 actions effectuées par Supabase lors d'un login.
-- Les messages RAISE NOTICE seront visibles dans l'onglet "Messages".

DO $$
DECLARE
    v_user_id uuid;
    v_session_id uuid;
    v_token_id bigint;
BEGIN
    -- 1. Récupération de l'ID utilisateur
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'serveuse@snackbar.cm';
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Utilisateur serveuse@snackbar.cm introuvable !';
    END IF;
    
    RAISE NOTICE 'Utilisateur trouvé : %', v_user_id;

    -- ---------------------------------------------------------
    -- ÉTAPE 1 : Simulation UPDATE last_sign_in_at (auth.users)
    -- ---------------------------------------------------------
    BEGIN
        UPDATE auth.users 
        SET last_sign_in_at = now() 
        WHERE id = v_user_id;
        
        RAISE NOTICE '✅ ÉTAPE 1 (UPDATE USER) : SUCCÈS';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ ÉTAPE 1 (UPDATE USER) : ÉCHEC - %', SQLERRM;
        -- On continue pour tester les autres étapes
    END;

    -- ---------------------------------------------------------
    -- ÉTAPE 2 : Simulation INSERT session (auth.sessions)
    -- ---------------------------------------------------------
    BEGIN
        -- On laisse l'ID null pour tester le trigger de génération
        INSERT INTO auth.sessions (user_id, created_at, updated_at)
        VALUES (v_user_id, now(), now())
        RETURNING id INTO v_session_id;
        
        RAISE NOTICE '✅ ÉTAPE 2 (INSERT SESSION) : SUCCÈS (Session ID: %)', v_session_id;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ ÉTAPE 2 (INSERT SESSION) : ÉCHEC - %', SQLERRM;
    END;

    -- ---------------------------------------------------------
    -- ÉTAPE 3 : Simulation INSERT refresh_token (auth.refresh_tokens)
    -- ---------------------------------------------------------
    BEGIN
        IF v_session_id IS NOT NULL THEN
            INSERT INTO auth.refresh_tokens (token, user_id, parent, session_id, created_at, updated_at)
            VALUES ('test_token_' || gen_random_uuid(), v_user_id, NULL, v_session_id, now(), now())
            RETURNING id INTO v_token_id;
            
            RAISE NOTICE '✅ ÉTAPE 3 (INSERT TOKEN) : SUCCÈS (Token ID: %)', v_token_id;
        ELSE
            RAISE NOTICE '⚠️ ÉTAPE 3 (INSERT TOKEN) : IGNORÉE (Pas de session créée)';
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ ÉTAPE 3 (INSERT TOKEN) : ÉCHEC - %', SQLERRM;
    END;

    -- Message final
    RAISE NOTICE 'Diagnostic terminé.';

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Erreur critique dans le script de diagnostic : %', SQLERRM;
END $$;
