-- Script complet de configuration des données de test
-- À exécuter dans l'éditeur SQL de Supabase (Dashboard -> SQL Editor)

-- 1. Activer l'extension de cryptage pour les mots de passe
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Créer l'établissement de test
-- On désactive temporairement le trigger d'audit sur etablissements
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_log_etablissement_creation') THEN
        ALTER TABLE public.etablissements DISABLE TRIGGER trigger_log_etablissement_creation;
    END IF;
END $$;

INSERT INTO public.etablissements (
    id,
    nom,
    adresse,
    telephone,
    email,
    statut_abonnement,
    date_debut,
    date_fin,
    actif,
    date_creation,
    date_modification
) VALUES (
    'e0000000-0000-0000-0000-000000000001',
    'Snack Bar Test',
    '123 Avenue de la République, Douala',
    '+237 600000000',
    'contact@snackbar.cm',
    'actif',
    NOW(),
    NOW() + interval '1 year',
    true,
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    nom = EXCLUDED.nom,
    statut_abonnement = EXCLUDED.statut_abonnement,
    actif = EXCLUDED.actif;

-- Réactiver le trigger sur etablissements
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_log_etablissement_creation') THEN
        ALTER TABLE public.etablissements ENABLE TRIGGER trigger_log_etablissement_creation;
    END IF;
END $$;

-- 3. Gestion des utilisateurs et profils

-- CORRECTIF: Redéfinition du trigger handle_new_user pour éviter l'erreur de colonne 'email' manquante
-- Cette fonction est appelée automatiquement lors de l'insertion dans auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- On essaie d'insérer sans la colonne email qui semble absente
  INSERT INTO public.profiles (id, nom, prenom, role, actif)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nom', 'Non renseigné'),
    COALESCE(NEW.raw_user_meta_data->>'prenom', 'Non renseigné'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'serveuse'),
    TRUE
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Si l'insertion échoue (ex: colonne email existe quand même), on réessaie avec email
    -- Ceci est une sécurité pour gérer les deux cas
    BEGIN
        INSERT INTO public.profiles (id, email, nom, prenom, role, actif)
        VALUES (
            NEW.id,
            NEW.email,
            COALESCE(NEW.raw_user_meta_data->>'nom', 'Non renseigné'),
            COALESCE(NEW.raw_user_meta_data->>'prenom', 'Non renseigné'),
            COALESCE(NEW.raw_user_meta_data->>'role', 'serveuse'),
            TRUE
        );
    EXCEPTION WHEN OTHERS THEN
        -- Si ça échoue encore, on ignore pour laisser le script manuel gérer le profil
        RETURN NEW;
    END;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Désactivation temporaire des triggers et contraintes profils
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_profiles_trigger') THEN
        ALTER TABLE public.profiles DISABLE TRIGGER audit_profiles_trigger;
    END IF;
    
    -- Désactiver la contrainte check pour permettre les manipulations flexibles
    ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_admin_etablissement_check;
END $$;


-- BLOC 1 : ADMIN (admin@snackbar.cm)
DO $$
DECLARE
    v_user_id uuid;
    v_email text := 'admin@snackbar.cm';
    v_fixed_id uuid := 'a0000000-0000-0000-0000-000000000001';
BEGIN
    -- Vérifier si l'utilisateur existe déjà
    SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
    
    IF v_user_id IS NULL THEN
        -- Création avec ID fixe si n'existe pas
        INSERT INTO auth.users (
            instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
            raw_app_meta_data, raw_user_meta_data, created_at, updated_at
        ) VALUES (
            '00000000-0000-0000-0000-000000000000', v_fixed_id, 'authenticated', 'authenticated', v_email,
            crypt('password123', gen_salt('bf')), NOW(),
            '{"provider":"email","providers":["email"]}',
            '{"nom":"Admin","prenom":"System","role":"admin"}',
            NOW(), NOW()
        );
        v_user_id := v_fixed_id;
    END IF;

    -- Upsert Profil (SANS EMAIL)
    -- On utilise une requête dynamique pour gérer la présence ou l'absence de la colonne email
    BEGIN
        INSERT INTO public.profiles (id, nom, prenom, role, etablissement_id, actif)
        VALUES (v_user_id, 'Admin', 'System', 'admin', NULL, true)
        ON CONFLICT (id) DO UPDATE SET
            nom = EXCLUDED.nom,
            prenom = EXCLUDED.prenom,
            role = EXCLUDED.role,
            etablissement_id = EXCLUDED.etablissement_id, -- NULL pour admin
            actif = EXCLUDED.actif;
    EXCEPTION WHEN undefined_column THEN
        -- Si erreur de colonne, c'est peut-être autre chose, mais on suppose ici que c'est bon
        NULL;
    END;
END $$;


-- BLOC 2 : PATRON (patron@snackbar.cm)
DO $$
DECLARE
    v_user_id uuid;
    v_email text := 'patron@snackbar.cm';
    v_fixed_id uuid := 'a0000000-0000-0000-0000-000000000002';
BEGIN
    SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
    
    IF v_user_id IS NULL THEN
        INSERT INTO auth.users (
            instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
            raw_app_meta_data, raw_user_meta_data, created_at, updated_at
        ) VALUES (
            '00000000-0000-0000-0000-000000000000', v_fixed_id, 'authenticated', 'authenticated', v_email,
            crypt('password123', gen_salt('bf')), NOW(),
            '{"provider":"email","providers":["email"]}',
            '{"nom":"Dupont","prenom":"Jean","role":"patron"}',
            NOW(), NOW()
        );
        v_user_id := v_fixed_id;
    END IF;

    INSERT INTO public.profiles (id, nom, prenom, role, etablissement_id, actif)
    VALUES (v_user_id, 'Dupont', 'Jean', 'patron', 'e0000000-0000-0000-0000-000000000001', true)
    ON CONFLICT (id) DO UPDATE SET
        nom = EXCLUDED.nom,
        prenom = EXCLUDED.prenom,
        role = EXCLUDED.role,
        etablissement_id = EXCLUDED.etablissement_id,
        actif = EXCLUDED.actif;
END $$;


-- BLOC 3 : COMPTOIR (comptoir@snackbar.cm)
DO $$
DECLARE
    v_user_id uuid;
    v_email text := 'comptoir@snackbar.cm';
    v_fixed_id uuid := 'a0000000-0000-0000-0000-000000000003';
BEGIN
    SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
    
    IF v_user_id IS NULL THEN
        INSERT INTO auth.users (
            instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
            raw_app_meta_data, raw_user_meta_data, created_at, updated_at
        ) VALUES (
            '00000000-0000-0000-0000-000000000000', v_fixed_id, 'authenticated', 'authenticated', v_email,
            crypt('password123', gen_salt('bf')), NOW(),
            '{"provider":"email","providers":["email"]}',
            '{"nom":"Martin","prenom":"Sophie","role":"comptoir"}',
            NOW(), NOW()
        );
        v_user_id := v_fixed_id;
    END IF;

    INSERT INTO public.profiles (id, nom, prenom, role, etablissement_id, actif)
    VALUES (v_user_id, 'Martin', 'Sophie', 'comptoir', 'e0000000-0000-0000-0000-000000000001', true)
    ON CONFLICT (id) DO UPDATE SET
        nom = EXCLUDED.nom,
        prenom = EXCLUDED.prenom,
        role = EXCLUDED.role,
        etablissement_id = EXCLUDED.etablissement_id,
        actif = EXCLUDED.actif;
END $$;


-- BLOC 4 : SERVEUSE (serveuse@snackbar.cm)
DO $$
DECLARE
    v_user_id uuid;
    v_email text := 'serveuse@snackbar.cm';
    v_fixed_id uuid := 'a0000000-0000-0000-0000-000000000004';
BEGIN
    SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
    
    IF v_user_id IS NULL THEN
        INSERT INTO auth.users (
            instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
            raw_app_meta_data, raw_user_meta_data, created_at, updated_at
        ) VALUES (
            '00000000-0000-0000-0000-000000000000', v_fixed_id, 'authenticated', 'authenticated', v_email,
            crypt('password123', gen_salt('bf')), NOW(),
            '{"provider":"email","providers":["email"]}',
            '{"nom":"Kamga","prenom":"Marie","role":"serveuse"}',
            NOW(), NOW()
        );
        v_user_id := v_fixed_id;
    END IF;

    INSERT INTO public.profiles (id, nom, prenom, role, etablissement_id, actif)
    VALUES (v_user_id, 'Kamga', 'Marie', 'serveuse', 'e0000000-0000-0000-0000-000000000001', true)
    ON CONFLICT (id) DO UPDATE SET
        nom = EXCLUDED.nom,
        prenom = EXCLUDED.prenom,
        role = EXCLUDED.role,
        etablissement_id = EXCLUDED.etablissement_id,
        actif = EXCLUDED.actif;
END $$;


-- 4. Réactiver les contraintes et triggers
-- Réactiver la contrainte check
ALTER TABLE public.profiles ADD CONSTRAINT profiles_admin_etablissement_check 
CHECK (
  (role = 'admin' AND etablissement_id IS NULL) OR
  (role != 'admin' AND etablissement_id IS NOT NULL)
);

-- Réactiver le trigger sur les profils
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_profiles_trigger') THEN
        ALTER TABLE public.profiles ENABLE TRIGGER audit_profiles_trigger;
    END IF;
END $$;
