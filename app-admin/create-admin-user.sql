-- Script pour créer un utilisateur admin de test
-- À exécuter après avoir créé l'utilisateur dans Supabase Auth

-- ÉTAPE 1: Créer l'utilisateur dans Supabase Auth
-- Via Dashboard: Authentication > Users > Add User
-- Ou via CLI: supabase auth users create admin@test.com --password "AdminTest123!"

-- ÉTAPE 2: Mettre à jour le profil pour le rôle admin
-- Remplacer 'admin@test.com' par l'email de votre utilisateur admin

UPDATE profiles 
SET 
  role = 'admin',
  etablissement_id = NULL,
  nom = 'Admin',
  prenom = 'Test',
  actif = true
WHERE email = 'admin@test.com';

-- Vérifier que l'utilisateur admin a été créé correctement
SELECT 
  id,
  email,
  nom,
  prenom,
  role,
  etablissement_id,
  actif
FROM profiles
WHERE role = 'admin';

-- NOTES:
-- 1. Les utilisateurs admin DOIVENT avoir etablissement_id = NULL
-- 2. Le rôle DOIT être 'admin'
-- 3. L'utilisateur doit d'abord exister dans auth.users
-- 4. Le profil est créé automatiquement par le trigger après création dans auth.users
