-- Vérifier la structure de auth.refresh_tokens (Default Value ?)
SELECT column_name, column_default, is_nullable, data_type
FROM information_schema.columns
WHERE table_schema = 'auth'
AND table_name = 'refresh_tokens'
AND column_name = 'id';
