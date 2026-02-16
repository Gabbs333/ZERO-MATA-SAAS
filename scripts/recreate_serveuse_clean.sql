-- Script de recréation PROPRE du compte serveuse
-- VERSION CORRIGÉE : Enveloppée dans un bloc DO pour supporter le PL/pgSQL (RAISE NOTICE)

DO $$
BEGIN

    -- 1. Nettoyage complet
    RAISE NOTICE 'Suppression des anciens comptes serveuse...';
    DELETE FROM auth.users WHERE email IN ('serveuse@snackbar.cm', 'serveuse_new@snackbar.cm');

    -- 2. Création du user auth (Même config que comptoir : pas de metadata)
    RAISE NOTICE 'Création du nouveau user serveuse@snackbar.cm...';
    INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data, -- On laisse vide comme comptoir
        created_at,
        updated_at,
        confirmation_token,
        recovery_token
    ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        gen_random_uuid(),
        'authenticated',
        'authenticated',
        'serveuse@snackbar.cm',
        crypt('password123', gen_salt('bf')), -- Mot de passe explicite
        now(),
        '{"provider":"email","providers":["email"]}',
        '{}', -- Important : Vide comme comptoir
        now(),
        now(),
        '',
        ''
    );

    -- 3. Création du profil public (Lien vital avec l'établissement valide)
    RAISE NOTICE 'Création du profil public lié à l''établissement e0000...0001...';
    INSERT INTO public.profiles (
        id,
        role,
        nom,
        prenom,
        etablissement_id,
        actif,
        created_at,
        updated_at
    ) 
    SELECT 
        id,
        'serveuse',
        'Serveuse',
        'Test',
        'e0000000-0000-0000-0000-000000000001', -- L'ID qui fonctionne pour comptoir/patron
        true,
        now(),
        now()
    FROM auth.users 
    WHERE email = 'serveuse@snackbar.cm';

    RAISE NOTICE '✅ Compte serveuse recréé proprement sur l''établissement valide';

END $$;
