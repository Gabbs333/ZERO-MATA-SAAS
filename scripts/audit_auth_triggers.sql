-- AUDIT COMPLET DES TRIGGERS ET FONCTIONS SUR LE SCHÉMA AUTH
-- Ce script liste tous les triggers attachés aux tables auth pour identifier les coupables potentiels

SELECT 
    event_object_schema as table_schema,
    event_object_table as table_name,
    trigger_name,
    event_manipulation as event,
    action_timing as timing,
    action_statement as function_definition
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
ORDER BY event_object_table, trigger_name;

-- Vérifier aussi les fonctions utilisées par ces triggers pour voir leur search_path
SELECT 
    r.routine_name,
    r.routine_definition,
    p.prosrc as source_code,
    p.proconfig as runtime_config -- Contient le search_path si défini
FROM information_schema.routines r
JOIN pg_proc p ON r.routine_name = p.proname
WHERE r.routine_schema = 'public' 
AND r.routine_name IN (
    SELECT substring(action_statement from 'EXECUTE FUNCTION ([\w_]+)\(')
    FROM information_schema.triggers
    WHERE event_object_schema = 'auth'
);
