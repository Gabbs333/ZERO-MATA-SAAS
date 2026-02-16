-- Inspection des données avec les noms de colonnes corrigés
SELECT id, nom, date_creation FROM public.etablissements LIMIT 5;

SELECT 
    p.id, 
    u.email, 
    p.role, 
    p.etablissement_id, 
    u.confirmed_at, 
    u.last_sign_in_at,
    u.raw_app_meta_data,
    u.raw_user_meta_data
FROM public.profiles p
JOIN auth.users u ON p.id = u.id
ORDER BY p.created_at DESC;