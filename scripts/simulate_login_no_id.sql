-- SIMULATION INSERTION SANS ID (REPRO ERROR 500)
-- On tente d'insérer une session SANS fournir d'ID, exactement comme le fait l'API.
-- Si ça plante ici, c'est que notre trigger force_session_id ne fonctionne pas correctement.

BEGIN;

-- 1. On se met dans la peau du rôle système (si possible, sinon on reste en postgres mais on teste la logique)
-- SET ROLE supabase_auth_admin; -- Souvent bloqué, donc on teste juste la logique INSERT

DO $$
DECLARE
    v_user_id uuid;
    v_session_id uuid;
BEGIN
    -- Récupérer l'ID de la serveuse
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'serveuse@snackbar.cm';
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User serveuse not found';
    END IF;

    RAISE NOTICE 'Tentative insertion session pour user %', v_user_id;

    -- 2. INSERTION SANS ID (C'est là que ça doit planter si le trigger déconne)
    INSERT INTO auth.sessions (user_id, created_at, updated_at)
    VALUES (v_user_id, now(), now())
    RETURNING id INTO v_session_id;

    RAISE NOTICE 'SUCCES ! Session générée avec ID: %', v_session_id;

    -- Si on arrive ici, le trigger marche. On rollback pour ne pas polluer.
    RAISE EXCEPTION 'TEST_OK_ROLLBACK';

EXCEPTION WHEN OTHERS THEN
    -- Si ça plante, on veut voir l'erreur exacte
    IF SQLERRM = 'TEST_OK_ROLLBACK' THEN
        RAISE NOTICE 'Test réussi (Rollback effectué)';
    ELSE
        RAISE NOTICE '❌ ERREUR LORS DU INSERT: % (State: %)', SQLERRM, SQLSTATE;
    END IF;
END $$;

ROLLBACK;
