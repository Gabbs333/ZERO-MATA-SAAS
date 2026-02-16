
-- 1. List non-system triggers on auth schema
SELECT 
    'TRIGGER' as type,
    cls.relname as table_name,
    tg.tgname as name,
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
AND tg.tgname NOT LIKE 'RI_ConstraintTrigger%'

UNION ALL

-- 2. Check RLS status of auth tables
SELECT 
    'RLS_STATUS' as type,
    tablename as table_name,
    'rowsecurity' as name,
    CASE rowsecurity 
        WHEN true THEN 'ENABLED' 
        ELSE 'DISABLED' 
    END as status
FROM pg_tables 
WHERE schemaname = 'auth'

UNION ALL

-- 3. Count policies
SELECT 
    'POLICY_COUNT' as type,
    tablename as table_name,
    'count' as name,
    count(*)::text as status
FROM pg_policies 
WHERE schemaname = 'auth'
GROUP BY tablename;
