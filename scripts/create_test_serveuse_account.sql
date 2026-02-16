-- CRÉATION D'UN NOUVEAU COMPTE SERVEUSE DE TEST (Version corrigée v2)
-- Ce script crée un compte serveuse avec un email "test" évident
-- Correction : Suppression de la colonne 'email' dans public.profiles car elle n'existe pas

BEGIN;

-- 0. Nettoyage préalable (pour éviter l'erreur de duplication)
DELETE FROM auth.users WHERE email = 'serveuse.test@snackbar.cm';

-- 1. Récupérer l'établissement_id du comptoir via auth.users
WITH etablissement_comptoir AS (
    SELECT p.etablissement_id 
    FROM public.profiles p
    JOIN auth.users u ON p.id = u.id
    WHERE u.email = 'comptoir@snackbar.cm'
    LIMIT 1
)
-- 2. Créer le nouvel utilisateur auth.users
, nouvel_utilisateur AS (
    INSERT INTO auth.users (
        instance_id, 
        id, 
        aud, 
        role, 
        email, 
        encrypted_password, 
        email_confirmed_at, 
        invited_at, 
        confirmation_token, 
        confirmation_sent_at, 
        recovery_token, 
        recovery_sent_at, 
        email_change_token_new, 
        email_change, 
        email_change_sent_at, 
        last_sign_in_at, 
        raw_app_meta_data, 
        raw_user_meta_data, 
        is_super_admin, 
        created_at, 
        updated_at, 
        phone, 
        phone_confirmed_at, 
        phone_change, 
        phone_change_token, 
        phone_change_sent_at, 
        email_change_token_current, 
        email_change_confirm_status, 
        banned_until, 
        reauthentication_token, 
        reauthentication_sent_at, 
        is_sso_user, 
        deleted_at
    ) 
    SELECT 
        instance_id,
        gen_random_uuid(), -- ID unique
        aud,
        role,
        'serveuse.test@snackbar.cm', -- Email de test évident
        encrypted_password, -- Même mot de passe hashé que serveuse@snackbar.cm
        email_confirmed_at,
        invited_at,
        confirmation_token,
        confirmation_sent_at,
        recovery_token,
        recovery_sent_at,
        email_change_token_new,
        email_change,
        email_change_sent_at,
        last_sign_in_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin, 
        now(),
        now(),
        phone,
        phone_confirmed_at,
        phone_change,
        phone_change_token,
        phone_change_sent_at,
        email_change_token_current,
        email_change_confirm_status, 
        banned_until, 
        reauthentication_token, 
        reauthentication_sent_at, 
        is_sso_user, 
        deleted_at
    FROM auth.users 
    WHERE email = 'serveuse@snackbar.cm'
    LIMIT 1
    RETURNING id, email
)
-- 3. Créer le profil correspondant (SANS la colonne email)
, nouveau_profil AS (
    INSERT INTO public.profiles (
        id,
        -- email, -- Colonne supprimée
        nom,
        prenom,
        role,
        etablissement_id,
        created_at,
        updated_at
    )
    SELECT 
        nu.id,
        -- nu.email, -- Valeur supprimée
        'Serveuse Test',
        'Test',
        'serveuse',
        ec.etablissement_id,
        now(),
        now()
    FROM nouvel_utilisateur nu
    CROSS JOIN etablissement_comptoir ec
    RETURNING id, etablissement_id -- email supprimé du returning
)
-- 4. Résultat final
SELECT 
    '✅ NOUVEAU COMPTE SERVEUSE CRÉÉ' as status,
    nu.email as nouvel_email,
    nu.id as user_id,
    np.etablissement_id,
    (SELECT email FROM auth.users WHERE email = 'comptoir@snackbar.cm') as email_comptoir_reference,
    'Mot de passe: le même que serveuse@snackbar.cm' as info_mot_de_passe
FROM nouvel_utilisateur nu
JOIN nouveau_profil np ON nu.id = np.id;

COMMIT;
