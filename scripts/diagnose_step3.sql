-- DIAGNOSTIC LOGIN - Test INSERT session seul
-- Test isolé pour l'insertion de session

INSERT INTO auth.sessions (user_id, created_at, updated_at)
SELECT id, now(), now()
FROM auth.users 
WHERE email = 'serveuse@snackbar.cm'
RETURNING 'ÉTAPE 3 - Session créée avec ID: ' || id as result;