-- Simulation d'accès RLS pour serveuse@snackbar.cm
-- But : Vérifier si l'utilisateur peut lire son propre profil et son établissement
-- Si ce script échoue, c'est que les policies RLS sur 'public' bloquent le login (via un trigger)

DO $$
DECLARE
    v_user_id uuid;
    v_etablissement_id uuid;
    v_count integer;
BEGIN
    -- 1. Récupérer l'ID de serveuse (en tant qu'admin pour l'instant)
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'serveuse@snackbar.cm';
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Utilisateur serveuse@snackbar.cm non trouvé !';
    END IF;

    RAISE NOTICE 'User ID trouvé : %', v_user_id;

    -- 2. SIMULATION DE CONNEXION (Switch to authenticated role)
    -- On définit les variables de session comme si on était connecté via l'API
    PERFORM set_config('request.jwt.claim.sub', v_user_id::text, true);
    PERFORM set_config('role', 'authenticated', true);

    RAISE NOTICE '--- DÉBUT TEST RLS (Role: authenticated) ---';

    -- 3. Test lecture Profil
    BEGIN
        SELECT count(*) INTO v_count FROM public.profiles WHERE id = v_user_id;
        RAISE NOTICE 'Lecture Profil : % lignes trouvées (Attendu: 1)', v_count;
        
        IF v_count = 0 THEN
            RAISE NOTICE '⚠️ PROBLÈME : Impossible de lire son propre profil !';
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ ERREUR Lecture Profil : %', SQLERRM;
    END;

    -- 4. Test lecture Etablissement (via le lien dans profil)
    BEGIN
        -- On récupère l'ID établissement depuis le profil (si accessible)
        SELECT etablissement_id INTO v_etablissement_id FROM public.profiles WHERE id = v_user_id;
        
        IF v_etablissement_id IS NOT NULL THEN
            SELECT count(*) INTO v_count FROM public.etablissements WHERE id = v_etablissement_id;
            RAISE NOTICE 'Lecture Etablissement : % lignes trouvées (Attendu: 1)', v_count;
             IF v_count = 0 THEN
                RAISE NOTICE '⚠️ PROBLÈME : Impossible de lire son établissement !';
            END IF;
        ELSE
             RAISE NOTICE '⚠️ Impossible de tester établissement (etablissement_id non récupéré)';
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ ERREUR Lecture Etablissement : %', SQLERRM;
    END;
    
    RAISE NOTICE '--- FIN TEST RLS ---';

END $$;