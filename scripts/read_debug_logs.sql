-- LECTURE DES LOGS DE DEBUG
-- Ce script lit les logs générés par notre trigger instrumenté pour comprendre pourquoi ça plante.

SELECT 
    id, 
    created_at, 
    message, 
    details 
FROM public.debug_logs 
ORDER BY created_at DESC 
LIMIT 20;
