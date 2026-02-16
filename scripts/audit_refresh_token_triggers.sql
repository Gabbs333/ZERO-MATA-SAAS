-- Vérifier les triggers sur auth.refresh_tokens
SELECT 
    event_object_schema as schema,
    event_object_table as table,
    trigger_name,
    event_manipulation as event,
    action_timing as timing,
    action_statement as definition
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
AND event_object_table = 'refresh_tokens';
