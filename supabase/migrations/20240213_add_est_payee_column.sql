-- Migration: Add est_payee column to commandes table
-- Description: Adds the missing 'est_payee' column required by payment triggers and frontend logic.

ALTER TABLE commandes
ADD COLUMN IF NOT EXISTS est_payee BOOLEAN DEFAULT false;

-- Update existing records based on status
UPDATE commandes
SET est_payee = true
WHERE statut = 'terminee' OR statut = 'annulee'; -- Assuming annulee implies settled or closed

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_commandes_est_payee ON commandes(est_payee);
