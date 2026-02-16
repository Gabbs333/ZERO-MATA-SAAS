
SELECT 
    u.id as user_id, 
    u.email, 
    p.id as profile_id, 
    p.nom 
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE u.email = 'serveuse.test@snackbar.cm';
