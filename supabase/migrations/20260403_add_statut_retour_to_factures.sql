-- Migration: Add statut_retour to factures table
-- Description: Adds a return status field to track invoices with returns
-- Created: 2026-04-03

-- Add statut_retour column to factures
ALTER TABLE factures ADD COLUMN IF NOT EXISTS statut_retour TEXT DEFAULT 'sans_retour' CHECK (statut_retour IN ('sans_retour', 'retour_partiel', 'retour_total'));

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_factures_statut_retour ON factures(statut_retour);

COMMENT ON COLUMN factures.statut_retour IS 'Return status: sans_retour, retour_partiel, retour_total';
