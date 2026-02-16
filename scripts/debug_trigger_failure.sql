
DO $$
DECLARE
    v_user_id uuid;
BEGIN
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'serveuse@snackbar.cm';
    
    -- Simulation de ce que fait Supabase Auth lors d'un login
    -- Si ça plante ici, c'est un trigger ON UPDATE sur auth.users
    BEGIN
        UPDATE auth.users SET last_sign_in_at = now() WHERE id = v_user_id;
        RAISE NOTICE '✅ UPDATE auth.users (last_sign_in_at) réussi';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ ÉCHEC UPDATE auth.users: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
    END;

    -- Si ça plante ici, c'est un trigger ON INSERT sur auth.sessions
    BEGIN
        INSERT INTO auth.sessions (user_id, created_at, updated_at)
        VALUES (v_user_id, now(), now());
        RAISE NOTICE '✅ INSERT auth.sessions réussi';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ ÉCHEC INSERT auth.sessions: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
    END;

END $$;
