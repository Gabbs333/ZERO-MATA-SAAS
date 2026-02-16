-- SCRIPT DE SECOURS ABSOLU (NUCLEAR OPTION)
-- Ce script désactive TOUS les mécanismes automatiques qui peuvent bloquer le login.
-- Objectif : Restaurer l'accès Admin coûte que coûte.

BEGIN;

-- 1. DÉSACTIVER RLS SUR LES TABLES CRITIQUES
-- On enlève la sécurité niveau ligne pour l'instant. L'authentification API reste active.
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.etablissements DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs DISABLE ROW LEVEL SECURITY;

-- 2. SUPPRIMER LES TRIGGERS SUR AUTH.USERS (Source fréquente de "Database error querying schema")
-- On utilise une boucle DO pour être sûr de tout nettoyer sans connaître les noms exacts
DO $$
DECLARE
    trg_name TEXT;
BEGIN
    FOR trg_name IN 
        SELECT trigger_name 
        FROM information_schema.triggers 
        WHERE event_object_schema = 'auth' 
        AND event_object_table = 'users'
        AND action_statement NOT LIKE '%internal%' -- Ne pas toucher aux triggers internes de Supabase
    LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(trg_name) || ' ON auth.users CASCADE';
    END LOOP;
END $$;

-- 3. SUPPRIMER LES TRIGGERS SUR PUBLIC.PROFILES
DO $$
DECLARE
    trg_name TEXT;
BEGIN
    FOR trg_name IN 
        SELECT trigger_name 
        FROM information_schema.triggers 
        WHERE event_object_schema = 'public' 
        AND event_object_table = 'profiles'
    LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(trg_name) || ' ON public.profiles CASCADE';
    END LOOP;
END $$;

-- 4. DONNER LES PLEINS POUVOIRS SUR LE SCHEMA PUBLIC
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO authenticated;

-- 5. RECRÉER L'UTILISATEUR ADMIN (Au cas où)
-- (Version simplifiée sans trigger)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
    v_admin_id UUID := 'a0000000-0000-0000-0000-000000000001';
    v_email TEXT := 'admin@snackbar.cm';
    v_existing_id UUID;
BEGIN
    -- Vérifier auth.users
    SELECT id INTO v_existing_id FROM auth.users WHERE email = v_email;

    IF v_existing_id IS NULL THEN
        INSERT INTO auth.users (
            instance_id, id, aud, role, email, encrypted_password, 
            email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
        ) VALUES (
            '00000000-0000-0000-0000-000000000000', v_admin_id, 'authenticated', 'authenticated', v_email, 
            crypt('password123', gen_salt('bf')), NOW(), 
            '{"provider": "email", "providers": ["email"]}', 
            '{"nom": "Admin", "prenom": "System", "role": "admin"}', NOW(), NOW()
        );
    ELSE
        v_admin_id := v_existing_id;
    END IF;

    -- Vérifier public.profiles
    INSERT INTO public.profiles (id, nom, prenom, role, actif, etablissement_id)
    VALUES (v_admin_id, 'Admin', 'System', 'admin', true, NULL)
    ON CONFLICT (id) DO UPDATE SET
        role = 'admin',
        actif = true,
        etablissement_id = NULL;
END $$;

COMMIT;
