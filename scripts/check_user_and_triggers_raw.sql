-- Vérification de l'existence de l'utilisateur
SELECT id, email, last_sign_in_at, created_at 
FROM auth.users 
WHERE email = 'serveuse@snackbar.cm';

-- Vérification des triggers via pg_catalog (plus fiable que information_schema)
SELECT 
    cls.relname as table_name,
    tg.tgname as trigger_name,
    CASE tg.tgenabled 
        WHEN 'O' THEN 'Enabled'
        WHEN 'D' THEN 'Disabled'
        WHEN 'A' THEN 'Always'
        WHEN 'R' THEN 'Replica'
    END as status,
    proname as function_name
FROM pg_trigger tg
JOIN pg_class cls ON tg.tgrelid = cls.oid
JOIN pg_namespace ns ON cls.relnamespace = ns.oid
JOIN pg_proc pr ON tg.tgfoid = pr.oid
WHERE ns.nspname = 'auth'
ORDER BY cls.relname;
