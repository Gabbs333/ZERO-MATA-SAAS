
-- Tente d'identifier la cause exacte via un log explicite dans une fonction SECURITY DEFINER
-- qui s'exécute en tant que superuser (donc qui devrait passer outre RLS)

CREATE OR REPLACE FUNCTION public.debug_login_failure(p_email text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_user_id uuid;
    v_session_id uuid;
BEGIN
    -- 1. Get User
    SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;
    IF v_user_id IS NULL THEN
        RETURN 'User not found';
    END IF;

    -- 2. Try Update (Simulation Login)
    BEGIN
        UPDATE auth.users SET last_sign_in_at = now() WHERE id = v_user_id;
    EXCEPTION WHEN OTHERS THEN
        RETURN 'UPDATE auth.users FAILED: ' || SQLERRM;
    END;

    -- 3. Try Insert Session
    BEGIN
        INSERT INTO auth.sessions (user_id, created_at, updated_at)
        VALUES (v_user_id, now(), now())
        RETURNING id INTO v_session_id;
    EXCEPTION WHEN OTHERS THEN
        RETURN 'INSERT auth.sessions FAILED: ' || SQLERRM;
    END;

    RETURN 'SUCCESS: Session ID ' || v_session_id;
END;
$$;

-- Exécuter la fonction
SELECT public.debug_login_failure('serveuse@snackbar.cm');
