-- DIAGNOSTIC SEARCH_PATH & EXTENSIONS
-- Ce script vérifie si pgcrypto est accessible et quel est le search_path courant.

-- 1. Vérifier l'installation de pgcrypto
SELECT * FROM pg_extension WHERE extname = 'pgcrypto';

-- 2. Vérifier si gen_random_uuid est accessible
SELECT 
    proname, 
    nspname as schema_name 
FROM pg_proc 
JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid 
WHERE proname = 'gen_random_uuid';

-- 3. Vérifier le search_path pour le rôle postgres et authenticated
SHOW search_path;

-- 4. Tenter d'exécuter gen_random_uuid() directement
SELECT gen_random_uuid() as test_uuid;
