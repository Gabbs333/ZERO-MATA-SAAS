
-- Test script to check if retour_items_en_attente table exists and has data
SELECT 'Table exists' as status 
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'retour_items_en_attente');

-- Check if create_pending_retour function exists
SELECT 'create_pending_retour function exists' as status 
WHERE EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'create_pending_retour');

-- Check if valider_retour_en_attente function exists  
SELECT 'valider_retour_en_attente function exists' as status 
WHERE EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'valider_retour_en_attente');

-- Check for any data in retour_items_en_attente
SELECT COUNT(*) as total_retours_en_attente FROM retour_items_en_attente;

