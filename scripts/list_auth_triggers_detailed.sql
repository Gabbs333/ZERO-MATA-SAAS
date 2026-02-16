-- Script pour lister TOUS les triggers sur le schéma auth
-- Aidera à identifier les triggers cachés qui pourraient causer l'erreur 500

SELECT 
    event_object_schema as schema_name,
    event_object_table as table_name,
    trigger_name,
    event_manipulation as event,
    action_timing as timing,
    action_statement as definition
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
ORDER BY event_object_table, trigger_name;
