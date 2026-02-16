-- Add capacite column to tables table if it doesn't exist
ALTER TABLE tables ADD COLUMN IF NOT EXISTS capacite INTEGER DEFAULT 4;

-- Add comment
COMMENT ON COLUMN tables.capacite IS 'Capacité de la table (nombre de places)';
