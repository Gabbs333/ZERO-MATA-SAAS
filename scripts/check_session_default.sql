-- VERIFICATION DE LA COLONNE ID
SELECT column_name, column_default, is_nullable, data_type
FROM information_schema.columns
WHERE table_schema = 'auth' 
  AND table_name = 'sessions' 
  AND column_name = 'id';
