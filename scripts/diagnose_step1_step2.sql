-- DIAGNOSTIC LOGIN - Test séparé par étape
-- Ce script teste chaque étape individuellement pour identifier l'échec

-- ÉTAPE 1: Vérifier l'utilisateur
SELECT 'ÉTAPE 1 - Utilisateur trouvé:' as step, id, email, last_sign_in_at
FROM auth.users 
WHERE email = 'serveuse@snackbar.cm';

-- ÉTAPE 2: Tester UPDATE last_sign_in_at
UPDATE auth.users 
SET last_sign_in_at = now()
WHERE email = 'serveuse@snackbar.cm';

SELECT 'ÉTAPE 2 - UPDATE last_sign_in_at: OK' as step;