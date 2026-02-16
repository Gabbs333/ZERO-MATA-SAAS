-- LINK TEST USERS TO ESTABLISHMENT
-- À exécuter DANS L'ÉDITEUR SQL SUPABASE *APRÈS* avoir créé les utilisateurs manuellement via le Dashboard Auth.

-- Instructions:
-- 1. Allez dans Authentication > Users
-- 2. Créez les utilisateurs suivants (mot de passe suggéré: password123):
--    - patron@test.com
--    - serveuse@test.com
--    - comptoir@test.com
--    - gerant@test.com
-- 3. Exécutez ce script pour définir leurs rôles et les lier à l'établissement test.

DO $$
DECLARE
    v_etab_id UUID;
BEGIN
    -- 1. Récupérer l'ID de l'établissement test
    SELECT id INTO v_etab_id FROM public.etablissements WHERE nom = 'Etablissement Test';
    
    IF v_etab_id IS NULL THEN
        RAISE EXCEPTION '❌ Etablissement Test non trouvé. Veuillez d''abord exécuter le script "migration/seed_test_establishment.sql".';
    END IF;

    RAISE NOTICE '✅ Établissement trouvé: %', v_etab_id;

    -- 2. Mettre à jour PATRON
    UPDATE public.profiles
    SET role = 'patron', etablissement_id = v_etab_id, nom = 'Patron', prenom = 'Test', actif = true
    WHERE email = 'patron@test.com';
    
    IF FOUND THEN RAISE NOTICE '   -> patron@test.com mis à jour.'; END IF;

    -- 3. Mettre à jour SERVEUSE
    UPDATE public.profiles
    SET role = 'serveuse', etablissement_id = v_etab_id, nom = 'Serveuse', prenom = 'Test', actif = true
    WHERE email = 'serveuse@test.com';
    
    IF FOUND THEN RAISE NOTICE '   -> serveuse@test.com mis à jour.'; END IF;

    -- 4. Mettre à jour COMPTOIR
    UPDATE public.profiles
    SET role = 'comptoir', etablissement_id = v_etab_id, nom = 'Comptoir', prenom = 'Test', actif = true
    WHERE email = 'comptoir@test.com';
    
    IF FOUND THEN RAISE NOTICE '   -> comptoir@test.com mis à jour.'; END IF;

    -- 5. Mettre à jour GERANT
    UPDATE public.profiles
    SET role = 'gerant', etablissement_id = v_etab_id, nom = 'Gerant', prenom = 'Test', actif = true
    WHERE email = 'gerant@test.com';
    
    IF FOUND THEN RAISE NOTICE '   -> gerant@test.com mis à jour.'; END IF;
    
    RAISE NOTICE 'Terminé.';
END $$;
