-- NETTOYAGE ULTIME ET RECRÉATION PROPRE (CORRIGÉ)
-- Correction de l'erreur de type (UUID vs VARCHAR) sur refresh_tokens

BEGIN;

-- 1. Désactiver temporairement les contraintes
SET CONSTRAINTS ALL DEFERRED;

-- 2. Supprimer de profiles (si existe encore)
DELETE FROM public.profiles WHERE id IN (SELECT id FROM auth.users WHERE email = 'serveuse@snackbar.cm');

-- 3. Supprimer des tables liées (avec correction des types)
-- auth.identities
DELETE FROM auth.identities WHERE email = 'serveuse@snackbar.cm';

-- auth.sessions
DELETE FROM auth.sessions WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'serveuse@snackbar.cm');

-- auth.refresh_tokens (Simplifié pour éviter l'erreur de récursion/type)
-- On supprime simplement tous les tokens liés à cet utilisateur
DELETE FROM auth.refresh_tokens WHERE session_id IN (
    SELECT id FROM auth.sessions WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'serveuse@snackbar.cm')
);

-- 4. Supprimer l'utilisateur auth
DELETE FROM auth.users WHERE email = 'serveuse@snackbar.cm';

-- 5. Recréation PROPRE (Sans trigger, sans metadata complexe)
SET session_replication_role = 'replica'; 

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
  updated_at,
  confirmation_token,
  is_super_admin
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'serveuse@snackbar.cm',
  crypt('password123', gen_salt('bf')),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{}', 
  NOW(),
  NOW(),
  '',
  FALSE
);

SET session_replication_role = 'origin';

-- 6. Création manuelle du profil
INSERT INTO public.profiles (id, nom, prenom, role, etablissement_id, actif)
SELECT 
  id, 
  'Marie', 
  'Kamga', 
  'serveuse', 
  (SELECT id FROM public.etablissements LIMIT 1), 
  TRUE
FROM auth.users 
WHERE email = 'serveuse@snackbar.cm';

COMMIT;

SELECT 'Compte recréé après nettoyage total (Corrigé).' as status;
