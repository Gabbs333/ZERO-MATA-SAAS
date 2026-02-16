
-- Script pour configurer l'environnement de test
-- CE SCRIPT DOIT ÊTRE EXÉCUTÉ DANS L'ÉDITEUR SQL DE SUPABASE
-- Il crée un établissement de test et des comptes utilisateurs associés.

-- 1. Activer l'extension pour le hachage des mots de passe
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  v_etab_id UUID;
  v_patron_id UUID := uuid_generate_v4();
  v_serveuse_id UUID := uuid_generate_v4();
  v_comptoir_id UUID := uuid_generate_v4();
BEGIN
  -- 2. Créer l'établissement
  -- Vérifier si l'établissement existe déjà
  SELECT id INTO v_etab_id FROM etablissements WHERE nom = 'Etablissement Test' LIMIT 1;
  
  IF v_etab_id IS NULL THEN
    v_etab_id := uuid_generate_v4();
    INSERT INTO etablissements (
      id, nom, adresse, telephone, email, 
      statut_abonnement, date_debut, date_fin, actif
    )
    VALUES (
      v_etab_id, 'Etablissement Test', '123 Rue du Test', '600000000', 'contact@test.com',
      'actif', NOW(), NOW() + INTERVAL '12 months', true
    );
    RAISE NOTICE 'Etablissement créé avec ID: %', v_etab_id;
  ELSE
    RAISE NOTICE 'Etablissement existant trouvé avec ID: %', v_etab_id;
  END IF;

  -- 3. Créer les utilisateurs (PATRON)
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'patron@test.com') THEN
    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token
    ) VALUES (
      v_patron_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'patron@test.com',
      crypt('password123', gen_salt('bf')), -- Mot de passe: password123
      NOW(), -- Email confirmé immédiatement
      '{"provider": "email", "providers": ["email"]}',
      jsonb_build_object(
        'nom', 'Patron',
        'prenom', 'Test',
        'role', 'patron',
        'etablissement_id', v_etab_id
      ),
      NOW(),
      NOW(),
      '',
      ''
    );
    RAISE NOTICE 'Utilisateur Patron créé (patron@test.com / password123)';
  ELSE
    RAISE NOTICE 'Utilisateur Patron déjà existant';
  END IF;

  -- 4. Créer les utilisateurs (SERVEUSE)
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'serveuse@test.com') THEN
    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token
    ) VALUES (
      v_serveuse_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'serveuse@test.com',
      crypt('password123', gen_salt('bf')), -- Mot de passe: password123
      NOW(), -- Email confirmé immédiatement
      '{"provider": "email", "providers": ["email"]}',
      jsonb_build_object(
        'nom', 'Serveuse',
        'prenom', 'Test',
        'role', 'serveuse',
        'etablissement_id', v_etab_id
      ),
      NOW(),
      NOW(),
      '',
      ''
    );
    RAISE NOTICE 'Utilisateur Serveuse créé (serveuse@test.com / password123)';
  ELSE
    RAISE NOTICE 'Utilisateur Serveuse déjà existant';
  END IF;

  -- 5. Créer les utilisateurs (COMPTOIR)
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'comptoir@test.com') THEN
    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token
    ) VALUES (
      v_comptoir_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'comptoir@test.com',
      crypt('password123', gen_salt('bf')), -- Mot de passe: password123
      NOW(), -- Email confirmé immédiatement
      '{"provider": "email", "providers": ["email"]}',
      jsonb_build_object(
        'nom', 'Comptoir',
        'prenom', 'Test',
        'role', 'comptoir',
        'etablissement_id', v_etab_id
      ),
      NOW(),
      NOW(),
      '',
      ''
    );
    RAISE NOTICE 'Utilisateur Comptoir créé (comptoir@test.com / password123)';
  ELSE
    RAISE NOTICE 'Utilisateur Comptoir déjà existant';
  END IF;

  -- 6. L'utilisateur ADMIN est ignoré car déjà configuré
  -- (Partie supprimée à la demande de l'utilisateur)

END $$;
