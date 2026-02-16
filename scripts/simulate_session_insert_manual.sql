-- Simulation d'insertion manuelle pour tester le trigger et gen_random_uuid()
-- Si gen_random_uuid() est introuvable ou si les permissions manquent, ce script le dira clairement.

DO $$
DECLARE
    v_user_id uuid;
    v_new_id uuid;
BEGIN
    -- 1. Récupérer l'ID utilisateur
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'serveuse@snackbar.cm';
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Utilisateur serveuse@snackbar.cm non trouvé';
    END IF;

    RAISE NOTICE 'User ID trouvé : %', v_user_id;

    -- 2. Tenter l'insertion SANS id (pour déclencher le trigger)
    -- On utilise une transaction qui sera annulée (ROLLBACK) à la fin
    -- Mais le RAISE NOTICE sortira quand même
    
    INSERT INTO auth.sessions (user_id, created_at, updated_at)
    VALUES (v_user_id, now(), now())
    RETURNING id INTO v_new_id;
    
    RAISE NOTICE '✅ SUCCÈS : Session insérée avec ID généré : %', v_new_id;
    
    -- On provoque une erreur volontaire pour annuler l'insertion (rollback)
    RAISE EXCEPTION 'TEST_OK_ROLLBACK';

EXCEPTION 
    WHEN OTHERS THEN
        IF SQLERRM = 'TEST_OK_ROLLBACK' THEN
            RAISE NOTICE 'Test terminé avec succès (Rollback effectué)';
        ELSE
            RAISE NOTICE '❌ ÉCHEC INSERTION : % (Code: %)', SQLERRM, SQLSTATE;
            -- Est-ce un problème d'extension ?
            IF SQLERRM LIKE '%gen_random_uuid%' THEN
                RAISE NOTICE '💡 INDICE : La fonction gen_random_uuid() semble introuvable. Vérifiez l''extension pgcrypto.';
            END IF;
        END IF;
END $$;
