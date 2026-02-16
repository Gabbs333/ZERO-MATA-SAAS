-- Script pour simuler une insertion de session (étape critique du login)
DO $$
DECLARE
    v_user_id uuid;
BEGIN
    -- Récupérer l'ID de l'utilisateur
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'serveuse@snackbar.cm';
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Utilisateur serveuse@snackbar.cm non trouvé';
    END IF;

    RAISE NOTICE 'Tentative INSERT auth.sessions pour user %', v_user_id;

    -- Insertion minimale dans auth.sessions
    INSERT INTO auth.sessions (user_id, created_at, updated_at)
    VALUES (v_user_id, now(), now());
    
    RAISE NOTICE '✅ SUCCÈS: Insertion dans auth.sessions réussie !';
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ ÉCHEC INSERT SESSION: %', SQLERRM;
END $$;
