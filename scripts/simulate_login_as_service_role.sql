-- Diagnostic: Simulation Login en tant que Service Role
-- Cela permet de vérifier si le problème vient des permissions du rôle système

BEGIN;

-- 1. Se faire passer pour le service_role (le rôle utilisé par l'API Auth)
-- Si cette commande échoue, c'est que vous n'êtes pas superadmin, mais essayons.
SET LOCAL ROLE service_role;

DO $$
DECLARE
    v_user_id uuid;
    v_session_id uuid;
BEGIN
    RAISE NOTICE '--- DÉBUT DIAGNOSTIC SERVICE_ROLE ---';
    
    -- Récupérer l'ID user (le service_role a le droit de lire auth.users)
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'serveuse@snackbar.cm';
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Impossible de lire auth.users en tant que service_role';
    END IF;
    RAISE NOTICE '✅ Lecture auth.users OK';

    -- TEST 1 : Insertion Session (Test du Trigger Fix + RLS)
    -- On insère SANS ID pour vérifier que notre trigger public.set_session_id_if_null fonctionne pour le service_role
    BEGIN
        INSERT INTO auth.sessions (user_id, created_at, updated_at)
        VALUES (v_user_id, now(), now())
        RETURNING id INTO v_session_id;
        
        RAISE NOTICE '✅ Insertion Session OK (ID généré: %)', v_session_id;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ ÉCHEC INSERT SESSION: % (Code: %)', SQLERRM, SQLSTATE;
    END;

    -- TEST 2 : Update User (Test des Triggers cachés)
    BEGIN
        UPDATE auth.users 
        SET last_sign_in_at = now() 
        WHERE id = v_user_id;
        
        RAISE NOTICE '✅ Update User OK';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ ÉCHEC UPDATE USER: % (Code: %)', SQLERRM, SQLSTATE;
    END;

END $$;

ROLLBACK; -- On annule tout à la fin pour ne pas laisser de traces
