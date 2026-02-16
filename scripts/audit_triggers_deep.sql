-- Audit complet des triggers et de leurs fonctions
-- Objectif : Identifier le trigger ou la fonction qui cause l'erreur 500
-- (Recherche de problèmes de permissions, search_path, ou dépendances manquantes)

SELECT 
    t.event_object_schema as table_schema,
    t.event_object_table as table_name,
    t.trigger_name,
    t.event_manipulation as event,
    t.action_timing as timing,
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM information_schema.triggers t
JOIN pg_proc p ON t.action_statement LIKE '%(' || p.proname || ')%' OR t.action_statement LIKE '%' || p.proname || '%'
WHERE t.event_object_schema IN ('auth', 'public')
AND t.event_object_table IN ('users', 'sessions', 'profiles')
ORDER BY t.event_object_schema, t.event_object_table, t.action_timing;
