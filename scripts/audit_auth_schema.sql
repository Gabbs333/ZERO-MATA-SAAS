-- AUDIT COMPLET DU SCHÉMA AUTH
-- Objectif : Identifier la source de l'erreur 500 en listant TOUS les objets actifs du schéma auth.

-- 1. Lister toutes les tables du schéma auth
SELECT 
    table_name 
FROM information_schema.tables 
WHERE table_schema = 'auth'
ORDER BY table_name;

-- 2. Lister TOUS les triggers du schéma auth (sur toutes les tables)
SELECT 
    event_object_table as table_cible,
    trigger_name,
    event_manipulation as action,
    action_statement as definition,
    action_timing as timing
FROM information_schema.triggers
WHERE trigger_schema = 'auth'
ORDER BY event_object_table, trigger_name;

-- 3. Lister les triggers via pg_trigger (plus bas niveau, montre parfois ce que information_schema cache)
SELECT 
    cl.relname as table_name,
    trg.tgname as trigger_name,
    CASE trg.tgtype::integer & 66
        WHEN 2 THEN 'BEFORE'
        WHEN 64 THEN 'INSTEAD OF'
        ELSE 'AFTER'
    END as timing,
    pg_get_triggerdef(trg.oid) as definition
FROM pg_trigger trg
JOIN pg_class cl ON trg.tgrelid = cl.oid
JOIN pg_namespace nsp ON cl.relnamespace = nsp.oid
WHERE nsp.nspname = 'auth'
ORDER BY cl.relname;

-- 4. Vérifier s'il y a des RLS activés sur les tables auth (normalement non, mais on vérifie)
SELECT 
    tablename, 
    rowsecurity 
FROM pg_tables 
WHERE schemaname = 'auth';
