-- RESET DU MOT DE PASSE SERVEUSE
-- Force le mot de passe à 'password123' pour le compte serveuse@ck-f.fr
-- Nécessite l'extension pgcrypto (active par défaut sur Supabase)

UPDATE auth.users
SET encrypted_password = crypt('password123', gen_salt('bf'))
WHERE email = 'serveuse@ck-f.fr';

-- Vérification
SELECT email, updated_at 
FROM auth.users 
WHERE email = 'serveuse@ck-f.fr';
