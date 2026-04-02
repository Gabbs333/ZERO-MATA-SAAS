-- Migration: Add 'retour' as valid type_reference for mouvements_stock
-- Description: Extends the check constraint to include 'retour' type
-- Created: 2026-04-02

-- Drop the existing constraint
ALTER TABLE mouvements_stock DROP CONSTRAINT IF EXISTS mouvements_stock_type_reference_check;

-- Add the new constraint with 'retour' included
ALTER TABLE mouvements_stock 
  ADD CONSTRAINT mouvements_stock_type_reference_check 
  CHECK (type_reference IN ('commande', 'ravitaillement', 'ajustement', 'retour'));

COMMENT ON CONSTRAINT mouvements_stock_type_reference_check ON mouvements_stock IS 'Valid type_reference values: commande, ravitaillement, ajustement, retour';
