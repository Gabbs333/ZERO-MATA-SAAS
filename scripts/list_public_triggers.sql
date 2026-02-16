
SELECT 
    tg.tgname as trigger_name,
    cls.relname as table_name,
    pg_get_triggerdef(tg.oid) as definition
FROM pg_trigger tg
JOIN pg_class cls ON tg.tgrelid = cls.oid
JOIN pg_namespace ns ON cls.relnamespace = ns.oid
WHERE ns.nspname = 'public';
