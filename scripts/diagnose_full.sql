-- DIAGNOSTIC COMPLET DU LOGIN
-- Ce script va nous révéler pourquoi le login échoue pour serveuse mais marche pour patron.

-- 1. Lister tous les triggers actifs sur auth.users (la source probable du crash 500)
SELECT 
    event_object_schema as schema,
    event_object_table as table,
    trigger_name,
    event_manipulation as event,
    action_statement as definition
FROM information_schema.triggers
WHERE event_object_schema = 'auth' AND event_object_table = 'users';

-- 2. Comparer les données brutes de Patron (qui marche) et Serveuse (qui plante)
SELECT 
    email,
    role,
    email_confirmed_at IS NOT NULL as email_confirmed,
    last_sign_in_at,
    raw_user_meta_data,
    raw_app_meta_data,
    is_super_admin,
    confirmation_token
FROM auth.users
WHERE email IN ('serveuse@snackbar.cm', 'patron@snackbar.cm');

-- 3. Vérifier s'il y a des politiques RLS sur auth.users qui pourraient bloquer l'UPDATE du login
SELECT * FROM pg_policies WHERE schemaname = 'auth' AND tablename = 'users';
