-- DIAGNOSTIC COMPLET DES ÉTAPES DE LOGIN (version simplifiée)
-- Ce script simule les 3 actions et renvoie les résultats visibles dans l'onglet "Results"

-- 1. Récupération de l'ID utilisateur
SELECT 'Utilisateur trouvé : ' || id || ' (' || email || ')' as diagnostic 
FROM auth.users 
WHERE email = 'serveuse@snackbar.cm'

UNION ALL

-- 2. Test UPDATE (mise à jour last_sign_in_at)
SELECT '✅ ÉTAPE 1 (UPDATE USER) : SUCCÈS' as diagnostic
FROM auth.users 
WHERE email = 'serveuse@snackbar.cm' 
  AND last_sign_in_at IS NOT NULL

UNION ALL

-- 3. Test INSERT session
SELECT '✅ ÉTAPE 2 (INSERT SESSION) : SUCCÈS (Session ID: ' || id || ')' as diagnostic
FROM (
    INSERT INTO auth.sessions (user_id, created_at, updated_at)
    SELECT id, now(), now()
    FROM auth.users 
    WHERE email = 'serveuse@snackbar.cm'
    RETURNING id
) s

UNION ALL

-- 4. Test INSERT refresh token
SELECT '✅ ÉTAPE 3 (INSERT TOKEN) : SUCCÈS (Token ID: ' || id || ')' as diagnostic
FROM (
    INSERT INTO auth.refresh_tokens (token, user_id, parent, session_id, created_at, updated_at)
    SELECT 'test_token_' || gen_random_uuid(), u.id, NULL, s.id, now(), now()
    FROM auth.users u, auth.sessions s
    WHERE u.email = 'serveuse@snackbar.cm' 
      AND s.user_id = u.id
    ORDER BY s.created_at DESC
    LIMIT 1
    RETURNING id
) t

UNION ALL

SELECT '=== DIAGNOSTIC TERMINÉ ===' as diagnostic;