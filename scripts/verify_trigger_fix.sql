DO $$
DECLARE
    v_user_id uuid;
    v_new_id uuid;
BEGIN
    -- Récupérer l'user
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'serveuse@snackbar.cm';
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Utilisateur non trouvé';
    END IF;

    RAISE NOTICE 'Tentative insertion session SANS ID (test du trigger)...';

    -- Insertion SANS ID (le trigger doit le remplir)
    -- Si le trigger fonctionne, ceci ne doit PAS échouer
    INSERT INTO auth.sessions (user_id, created_at, updated_at)
    VALUES (v_user_id, now(), now())
    RETURNING id INTO v_new_id;

    IF v_new_id IS NOT NULL THEN
        RAISE NOTICE '✅ SUCCÈS TOTAL: Le trigger a généré l''ID: %', v_new_id;
        
        -- Nettoyage immédiat pour ne pas polluer
        DELETE FROM auth.sessions WHERE id = v_new_id;
    ELSE
        RAISE EXCEPTION '❌ ÉCHEC: ID est null malgré le trigger';
    END IF;

EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ ÉCHEC TEST TRIGGER: %', SQLERRM;
END $$;
