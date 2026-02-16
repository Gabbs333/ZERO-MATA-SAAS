-- Vérifier si des sessions ont été créées pour l'utilisateur
SELECT s.id, s.created_at, u.email 
FROM auth.sessions s
JOIN auth.users u ON s.user_id = u.id
WHERE u.email = 'serveuse@snackbar.cm'
ORDER BY s.created_at DESC;
