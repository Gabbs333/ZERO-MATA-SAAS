-- Ce script rétablit la génération automatique des IDs pour les tables auth critiques
-- L'erreur "null value in column id" indique que la valeur par défaut a sauté

BEGIN;

-- 1. Réparer auth.sessions
-- Si l'ID n'est pas fourni, la base doit le générer
ALTER TABLE auth.sessions 
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- 2. Réparer auth.refresh_tokens (par précaution)
ALTER TABLE auth.refresh_tokens 
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- 3. Vérification immédiate
DO $$
DECLARE
    col_default text;
BEGIN
    SELECT column_default INTO col_default
    FROM information_schema.columns
    WHERE table_schema = 'auth' 
      AND table_name = 'sessions' 
      AND column_name = 'id';

    IF col_default IS NULL THEN
        RAISE EXCEPTION 'La colonne auth.sessions.id n''a toujours pas de valeur par défaut !';
    ELSE
        RAISE NOTICE 'Succès : auth.sessions.id a maintenant la valeur par défaut : %', col_default;
    END IF;
END $$;

COMMIT;
