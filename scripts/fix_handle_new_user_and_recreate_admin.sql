-- FIX: CORRECTION DU TRIGGER handle_new_user ET RECRÉATION ADMIN
-- Ce script :
-- 1. Met à jour le trigger handle_new_user pour ne plus utiliser la colonne 'email' (supprimée).
-- 2. Gère les conflits (ON CONFLICT) pour éviter les erreurs si le profil est déjà créé manuellement.
-- 3. Recrée l'utilisateur Admin proprement.

BEGIN;

-- 1. Redéfinir handle_new_user (Version compatible sans colonne email)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nom, prenom, role, actif)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nom', 'Non renseigné'),
    COALESCE(NEW.raw_user_meta_data->>'prenom', 'Non renseigné'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'serveuse'),
    TRUE
  )
  ON CONFLICT (id) DO NOTHING; -- Évite le crash si le profil est créé manuellement
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Recréer l'Admin (Pour être sûr qu'il existe et est propre)
-- Suppression préalable
DELETE FROM public.profiles WHERE role = 'admin';
DELETE FROM auth.users WHERE email = 'admin@snackbar.cm';

-- Création de l'utilisateur auth (Le trigger handle_new_user va se déclencher et créer le profil !)
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    'a0000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'admin@snackbar.cm',
    crypt('password123', gen_salt('bf')),
    NOW(),
    '{"provider": "email", "providers": ["email"]}',
    '{"nom": "Admin", "prenom": "Systeme", "role": "admin"}', -- Ajout du role ici pour le trigger
    NOW(),
    NOW()
);

-- Note: On n'insère plus manuellement dans profiles car le trigger s'en charge maintenant.
-- Mais par sécurité, on update le profil créé pour s'assurer qu'il est bien admin et actif
UPDATE public.profiles
SET role = 'admin', actif = true, nom = 'Admin', prenom = 'Systeme'
WHERE id = 'a0000000-0000-0000-0000-000000000000';

COMMIT;

DO $$
BEGIN
  RAISE NOTICE 'Fix appliqué : Trigger corrigé et Admin recréé.';
END $$;
