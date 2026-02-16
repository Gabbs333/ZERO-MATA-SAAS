-- Simulation d'insertion dans auth.refresh_tokens
-- C'est la dernière étape du login. Si elle échoue, tout rollback.

DO $$
DECLARE
    v_user_id uuid;
    v_session_id uuid;
    v_token_id uuid;
BEGIN
    -- 1. Récupérer l'ID utilisateur
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'serveuse@snackbar.cm';
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'User not found'; END IF;

    -- 2. Créer une session temporaire (nécessaire pour le refresh token)
    INSERT INTO auth.sessions (user_id, created_at, updated_at)
    VALUES (v_user_id, now(), now())
    RETURNING id INTO v_session_id;

    RAISE NOTICE 'Session temporaire créée : %', v_session_id;

    -- 3. Tenter d'insérer le refresh token
    INSERT INTO auth.refresh_tokens (
        instance_id,
        token,
        user_id,
        revoked,
        created_at,
        updated_at,
        session_id
    ) VALUES (
        '00000000-0000-0000-0000-000000000000', -- instance_id par défaut
        'test_token_' || gen_random_uuid(),    -- token unique
        v_user_id,
        false,
        now(),
        now(),
        v_session_id
    ) RETURNING id INTO v_token_id;

    RAISE NOTICE '✅ SUCCÈS : Refresh Token inséré avec ID : %', v_token_id;

    -- Rollback pour nettoyer
    RAISE EXCEPTION 'TEST_OK_ROLLBACK';

EXCEPTION 
    WHEN OTHERS THEN
        IF SQLERRM = 'TEST_OK_ROLLBACK' THEN
            RAISE NOTICE 'Test terminé avec succès (Rollback effectué)';
        ELSE
            RAISE NOTICE '❌ ÉCHEC REFRESH TOKEN : % (Code: %)', SQLERRM, SQLSTATE;
            
            IF SQLERRM LIKE '%null value%' THEN
                 RAISE NOTICE '💡 INDICE : Colonne NULL sans valeur par défaut (peut-être ID ?)';
            END IF;
        END IF;
END $$;
