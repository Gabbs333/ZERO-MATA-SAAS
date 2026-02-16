-- Migration: Enhanced RLS Policies for Products and Stock
-- Description: Adds specific policies for serveuses to see only available products with stock

-- ============================================================================
-- ENHANCED PRODUITS TABLE POLICIES
-- ============================================================================

-- Drop the existing generic policy for reading products
DROP POLICY IF EXISTS "Everyone can read active products" ON produits;

-- Create separate policies for different roles

-- Serveuses can only read active products with stock > 0
CREATE POLICY "Serveuses can read available products"
  ON produits FOR SELECT
  USING (
    get_user_role() = 'serveuse' AND
    actif = true AND
    EXISTS (
      SELECT 1 FROM stock
      WHERE stock.produit_id = produits.id
      AND stock.quantite_disponible > 0
    )
  );

-- Comptoir can read all active products
CREATE POLICY "Comptoir can read active products"
  ON produits FOR SELECT
  USING (
    get_user_role() = 'comptoir' AND
    actif = true
  );

-- Gerant and Patron can read all products (active and inactive)
CREATE POLICY "Gerant and Patron can read all products"
  ON produits FOR SELECT
  USING (
    get_user_role() IN ('gerant', 'patron')
  );

-- ============================================================================
-- STOCK TABLE POLICIES (Enhanced)
-- ============================================================================

-- Note: The existing "Everyone can read stock" policy already exists in 20240116000002_rls_policies.sql
-- We only need to add policies for manual stock adjustments by gerant/patron

-- Gerant and Patron can manually insert stock entries (for new products)
CREATE POLICY "Gerant and Patron can insert stock"
  ON stock FOR INSERT
  WITH CHECK (
    get_user_role() IN ('gerant', 'patron')
  );

-- Gerant and Patron can manually update stock (for corrections)
CREATE POLICY "Gerant and Patron can update stock"
  ON stock FOR UPDATE
  USING (
    get_user_role() IN ('gerant', 'patron')
  );

-- Note: Stock is primarily modified by triggers during commande validation and ravitaillement
-- Manual modifications by gerant/patron are for corrections only

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON POLICY "Serveuses can read available products" ON produits IS 
  'Requirement 12.4: Serveuses see only active products with stock > 0';
COMMENT ON POLICY "Comptoir can read active products" ON produits IS 
  'Requirement 12.1: Comptoir can see all active products';
COMMENT ON POLICY "Gerant and Patron can read all products" ON produits IS 
  'Requirements 12.1, 12.2, 12.3: Gerant/Patron have full access to manage products';

COMMENT ON POLICY "Gerant and Patron can insert stock" ON stock IS 
  'Requirement 3.1: Gerant/Patron can manually create stock entries for new products';
COMMENT ON POLICY "Gerant and Patron can update stock" ON stock IS 
  'Requirement 3.2: Gerant/Patron can manually adjust stock for corrections';

