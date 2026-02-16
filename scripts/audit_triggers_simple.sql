-- Liste simple de TOUS les triggers sur auth.users et auth.sessions
-- Sans jointures complexes pour éviter de masquer des résultats

SELECT 
    event_object_schema as schema,
    event_object_table as table,
    trigger_name,
    event_manipulation as event,
    action_timing as timing,
    action_statement as definition
FROM information_schema.triggers
WHERE event_object_schema IN ('auth', 'public')
AND event_object_table IN ('users', 'sessions')
ORDER BY event_object_schema, event_object_table;
