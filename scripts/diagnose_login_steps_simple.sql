-- DIAGNOSTIC COMPLET DES ÉTAPES DE LOGIN (version ultra-simplifiée)
-- Ce script teste chaque étape séparément et affiche les résultats

-- ÉTAPE 1: Vérifier l'utilisateur
SELECT 'ÉTAPE 1 - Utilisateur:' as step, id, email, last_sign_in_at
FROM auth.users 
WHERE email = 'serveuse@snackbar.cm';

-- ÉTAPE 2: Tester l'UPDATE
UPDATE auth.users 
SET last_sign_in_at = now()
WHERE email = 'serveuse@snackbar.cm';

SELECT 'ÉTAPE 2 - UPDATE effectué' as step;

-- ÉTAPE 3: Tester l'INSERT session
INSERT INTO auth.sessions (user_id, created_at, updated_at)
SELECT id, now(), now()
FROM auth.users 
WHERE email = 'serveuse@snackbar.cm';

SELECT 'ÉTAPE 3 - Session créée' as step;

-- ÉTAPE 4: Tester l'INSERT token
INSERT INTO auth.refresh_tokens (token, user_id, parent, session_id, created_at, updated_at)
SELECT 'test_token_' || gen_random_uuid(), u.id, NULL, s.id, now(), now()
FROM auth.users u
JOIN auth.sessions s ON s.user_id = u.id
WHERE u.email = 'serveuse@snackbar.cm'
ORDER BY s.created_at DESC
LIMIT 1;

SELECT 'ÉTAPE 4 - Token créé' as step;

-- Nettoyage
DELETE FROM auth.refresh_tokens WHERE token LIKE 'test_token_%';
DELETE FROM auth.sessions WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'serveuse@snackbar.cm') AND created_at > now() - interval '1 minute';

SELECT 'ÉTAPE 5 - Nettoyage effectué' as step;