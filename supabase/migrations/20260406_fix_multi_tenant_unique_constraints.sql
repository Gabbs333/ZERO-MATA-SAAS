-- Migration: Fix multi-tenant unique constraints on produits and tables
-- Description: Change global unique constraints to composite unique constraints
--              with etablissement_id so different establishments can have
--              products and tables with the same name/number.

-- ============================================================================
-- PART 1: Fix produits table - nom should be unique per etablissement
-- ============================================================================

-- Drop the global unique constraint on nom
ALTER TABLE produits DROP CONSTRAINT IF EXISTS produits_nom_key;

-- Add composite unique constraint: nom must be unique only within the same etablissement
ALTER TABLE produits ADD CONSTRAINT produits_nom_etablissement_key UNIQUE (nom, etablissement_id);

-- ============================================================================
-- PART 2: Fix tables table - numero should be unique per etablissement
-- ============================================================================

-- Drop the global unique constraint on numero
ALTER TABLE tables DROP CONSTRAINT IF EXISTS tables_numero_key;

-- Add composite unique constraint: numero must be unique only within the same etablissement
ALTER TABLE tables ADD CONSTRAINT tables_numero_etablissement_key UNIQUE (numero, etablissement_id);

-- ============================================================================
-- PART 3: Fix stock table - produit_id should be unique per etablissement
-- ============================================================================

-- The stock table has a UNIQUE constraint on produit_id, but since produits
-- are now scoped to etablissements, this should be fine. However, if there's
-- a separate stocks table, we need to handle it too.

-- Check if there's a UNIQUE constraint on stock.produit_id that needs adjustment
-- The current constraint is: stock.produit_id UNIQUE (one stock per product)
-- This is correct since each product belongs to one establishment.

-- ============================================================================
-- PART 4: Verify and add indexes for performance
-- ============================================================================

-- Ensure indexes exist for the composite unique constraints
CREATE INDEX IF NOT EXISTS idx_produits_etablissement_id ON produits(etablissement_id);
CREATE INDEX IF NOT EXISTS idx_tables_etablissement_id ON tables(etablissement_id);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON CONSTRAINT produits_nom_etablissement_key ON produits IS 'Product name must be unique within the same establishment (allows same name across different establishments)';
COMMENT ON CONSTRAINT tables_numero_etablissement_key ON tables IS 'Table number must be unique within the same establishment (allows same number across different establishments)';
