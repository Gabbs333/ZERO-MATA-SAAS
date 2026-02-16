-- DIAGNOSTIC LOGIN - Test INSERT refresh token seul
-- Test isolé pour l'insertion du refresh token

INSERT INTO auth.refresh_tokens (token, user_id, parent, session_id, created_at, updated_at)
SELECT 'test_token_' || gen_random_uuid(), u.id, NULL, s.id, now(), now()
FROM auth.users u
JOIN auth.sessions s ON s.user_id = u.id
WHERE u.email = 'serveuse@snackbar.cm'
ORDER BY s.created_at DESC
LIMIT 1
RETURNING 'ÉTAPE 4 - Refresh token créé avec ID: ' || id as result;