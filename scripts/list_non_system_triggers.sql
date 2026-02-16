
SELECT 
    cls.relname as table_name,
    tg.tgname as trigger_name,
    tg.tgenabled as status
FROM pg_trigger tg
JOIN pg_class cls ON tg.tgrelid = cls.oid
JOIN pg_namespace ns ON cls.relnamespace = ns.oid
WHERE ns.nspname = 'auth'
AND tg.tgname NOT LIKE 'RI_ConstraintTrigger%';
