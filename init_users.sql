-- Script pour créer des utilisateurs de test
-- À exécuter dans le SQL Editor de Supabase

-- Activer l'extension pgcrypto pour le hachage des mots de passe
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Création des utilisateurs dans auth.users
-- Note: Le mot de passe est 'password123'

-- 1. Admin
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    'a0000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'admin@test.com',
    crypt('password123', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now(),
    '',
    '',
    '',
    ''
) ON CONFLICT (id) DO NOTHING;

-- 2. Patron
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    'a0000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'patron@test.com',
    crypt('password123', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now(),
    '',
    '',
    '',
    ''
) ON CONFLICT (id) DO NOTHING;

-- 3. Comptoir (Gérant/Caissier)
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    'a0000000-0000-0000-0000-000000000003',
    'authenticated',
    'authenticated',
    'comptoir@test.com',
    crypt('password123', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now(),
    '',
    '',
    '',
    ''
) ON CONFLICT (id) DO NOTHING;

-- 4. Serveuse
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    'a0000000-0000-0000-0000-000000000004',
    'authenticated',
    'authenticated',
    'serveuse@test.com',
    crypt('password123', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now(),
    '',
    '',
    '',
    ''
) ON CONFLICT (id) DO NOTHING;

-- Création d'un établissement de test
INSERT INTO public.etablissements (id, nom, adresse, telephone, email, statut_abonnement, date_debut, date_fin, actif)
VALUES (
    'e0000000-0000-0000-0000-000000000001',
    'Restaurant Test',
    '123 Rue de Test',
    '0102030405',
    'contact@test.com',
    'actif',
    now(),
    now() + interval '1 year',
    true
) ON CONFLICT (id) DO NOTHING;

-- Création des profils associés
-- 1. Admin (Pas d'établissement lié)
INSERT INTO public.profiles (id, nom, prenom, email, role, etablissement_id, actif)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'Admin',
    'System',
    'admin@test.com',
    'admin',
    NULL,
    true
) ON CONFLICT (id) DO NOTHING;

-- 2. Patron
INSERT INTO public.profiles (id, nom, prenom, email, role, etablissement_id, actif)
VALUES (
    'a0000000-0000-0000-0000-000000000002',
    'Patron',
    'Test',
    'patron@test.com',
    'patron',
    'e0000000-0000-0000-0000-000000000001',
    true
) ON CONFLICT (id) DO NOTHING;

-- 3. Comptoir (Role: comptoir ou gerant - on met comptoir selon database.types.ts)
INSERT INTO public.profiles (id, nom, prenom, email, role, etablissement_id, actif)
VALUES (
    'a0000000-0000-0000-0000-000000000003',
    'Comptoir',
    'Test',
    'comptoir@test.com',
    'comptoir',
    'e0000000-0000-0000-0000-000000000001',
    true
) ON CONFLICT (id) DO NOTHING;

-- 4. Serveuse
INSERT INTO public.profiles (id, nom, prenom, email, role, etablissement_id, actif)
VALUES (
    'a0000000-0000-0000-0000-000000000004',
    'Serveuse',
    'Test',
    'serveuse@test.com',
    'serveuse',
    'e0000000-0000-0000-0000-000000000001',
    true
) ON CONFLICT (id) DO NOTHING;
