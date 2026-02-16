-- Migration: Row Level Security Policies for Ravitaillements
-- Description: Implements RLS policies for ravitaillements and ravitaillement_items tables
-- Requirements: 4.1, 4.2, 4.3, 4.4, 4.5

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE ravitaillements ENABLE ROW LEVEL SECURITY;
ALTER TABLE ravitaillement_items ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RAVITAILLEMENTS POLICIES
-- ============================================================================

-- Policy: Only gerant/patron can create ravitaillements
-- Requirement: 4.1 - Only authorized roles can create supply restocking
CREATE POLICY "gerant_patron_create_ravitaillements" ON ravitaillements
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('gerant', 'patron')
      AND profiles.actif = true
    )
  );

-- Policy: Everyone can read ravitaillements
-- Requirement: 4.5 - All users can consult supply restocking history
CREATE POLICY "everyone_read_ravitaillements" ON ravitaillements
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.actif = true
    )
  );

-- Policy: Ravitaillements are immutable after creation (no updates)
-- Requirement: 4.2, 4.3 - Ravitaillements cannot be modified after creation
CREATE POLICY "no_update_ravitaillements" ON ravitaillements
  FOR UPDATE
  USING (false);

-- Policy: Ravitaillements cannot be deleted
-- Requirement: 4.2, 4.3 - Ravitaillements are permanent records
CREATE POLICY "no_delete_ravitaillements" ON ravitaillements
  FOR DELETE
  USING (false);

-- ============================================================================
-- RAVITAILLEMENT_ITEMS POLICIES
-- ============================================================================

-- Policy: Only gerant/patron can create ravitaillement items
-- Requirement: 4.1 - Only authorized roles can add items to ravitaillements
CREATE POLICY "gerant_patron_create_ravitaillement_items" ON ravitaillement_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('gerant', 'patron')
      AND profiles.actif = true
    )
  );

-- Policy: Everyone can read ravitaillement items
-- Requirement: 4.5 - All users can view ravitaillement details
CREATE POLICY "everyone_read_ravitaillement_items" ON ravitaillement_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.actif = true
    )
  );

-- Policy: Ravitaillement items are immutable (no updates)
-- Requirement: 4.2, 4.3 - Items cannot be modified after creation
CREATE POLICY "no_update_ravitaillement_items" ON ravitaillement_items
  FOR UPDATE
  USING (false);

-- Policy: Ravitaillement items cannot be deleted
-- Requirement: 4.2, 4.3 - Items are permanent records
CREATE POLICY "no_delete_ravitaillement_items" ON ravitaillement_items
  FOR DELETE
  USING (false);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON POLICY "gerant_patron_create_ravitaillements" ON ravitaillements IS 
  'Only gerant and patron roles can create new ravitaillements (Requirement 4.1)';

COMMENT ON POLICY "everyone_read_ravitaillements" ON ravitaillements IS 
  'All authenticated users can read ravitaillements (Requirement 4.5)';

COMMENT ON POLICY "no_update_ravitaillements" ON ravitaillements IS 
  'Ravitaillements are immutable after creation (Requirements 4.2, 4.3)';

COMMENT ON POLICY "no_delete_ravitaillements" ON ravitaillements IS 
  'Ravitaillements cannot be deleted (Requirements 4.2, 4.3)';

COMMENT ON POLICY "gerant_patron_create_ravitaillement_items" ON ravitaillement_items IS 
  'Only gerant and patron roles can create ravitaillement items (Requirement 4.1)';

COMMENT ON POLICY "everyone_read_ravitaillement_items" ON ravitaillement_items IS 
  'All authenticated users can read ravitaillement items (Requirement 4.5)';

COMMENT ON POLICY "no_update_ravitaillement_items" ON ravitaillement_items IS 
  'Ravitaillement items are immutable (Requirements 4.2, 4.3)';

COMMENT ON POLICY "no_delete_ravitaillement_items" ON ravitaillement_items IS 
  'Ravitaillement items cannot be deleted (Requirements 4.2, 4.3)';
