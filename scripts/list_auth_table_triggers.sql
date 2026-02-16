
-- List triggers specifically ON auth.users and auth.sessions
SELECT 
    tg.tgname as trigger_name,
    cls.relname as table_name,
    pg_get_triggerdef(tg.oid) as definition,
    CASE tg.tgenabled 
        WHEN 'O' THEN 'Enabled'
        WHEN 'D' THEN 'Disabled'
        WHEN 'A' THEN 'Always'
        WHEN 'R' THEN 'Replica'
    END as status
FROM pg_trigger tg
JOIN pg_class cls ON tg.tgrelid = cls.oid
JOIN pg_namespace ns ON cls.relnamespace = ns.oid
WHERE ns.nspname = 'auth' 
AND cls.relname IN ('users', 'sessions', 'refresh_tokens');
