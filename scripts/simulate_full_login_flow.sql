-- Simulation complète du flux de login (Update User + Session + Refresh Token)
DO $$
DECLARE
    v_user_id uuid;
    v_session_id uuid;
BEGIN
    -- 1. Récupérer User
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'serveuse@snackbar.cm';
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User not found';
    END IF;

    RAISE NOTICE 'User found: %', v_user_id;

    -- 2. Update last_sign_in_at
    UPDATE auth.users SET last_sign_in_at = now() WHERE id = v_user_id;
    RAISE NOTICE 'Update last_sign_in_at OK';

    -- 3. Insert Session
    INSERT INTO auth.sessions (user_id, created_at, updated_at)
    VALUES (v_user_id, now(), now())
    RETURNING id INTO v_session_id;
    
    RAISE NOTICE 'Insert Session OK: %', v_session_id;

    -- 4. Insert Refresh Token (Souvent le point de blocage)
    -- Note: parent est null pour le premier token
    INSERT INTO auth.refresh_tokens (token, user_id, session_id, created_at, updated_at, parent)
    VALUES (
        encode(gen_random_bytes(32), 'hex'), -- Fake token
        v_user_id, 
        v_session_id, 
        now(), 
        now(), 
        NULL
    );
    
    RAISE NOTICE 'Insert Refresh Token OK';
    
    RAISE NOTICE '✅ FLUX COMPLET LOGIN SIMULÉ AVEC SUCCÈS !';

EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ ÉCHEC FLUX LOGIN: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END $$;
