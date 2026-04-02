-- Migration: RLS Policies for retours tables
-- Description: Creates RLS policies for retours and retour_items tables
-- Created: 2026-04-02

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE retours ENABLE ROW LEVEL SECURITY;
ALTER TABLE retour_items ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RETOURS TABLE POLICIES
-- ============================================================================

-- Patron can read all retours in their establishment
CREATE POLICY "patron_read_establishment_retours"
  ON retours FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'patron'
      AND p.actif = true
      AND p.etablissement_id = retours.etablissement_id
    )
  );

-- Gerant can read all retours in their establishment
CREATE POLICY "gerant_read_establishment_retours"
  ON retours FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'gerant'
      AND p.actif = true
      AND p.etablissement_id = retours.etablissement_id
    )
  );

-- Patron can create retours in their establishment
CREATE POLICY "patron_create_retours"
  ON retours FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'patron'
      AND p.actif = true
      AND p.etablissement_id = retours.etablissement_id
    )
  );

-- Gerant can create retours in their establishment
CREATE POLICY "gerant_create_retours"
  ON retours FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'gerant'
      AND p.actif = true
      AND p.etablissement_id = retours.etablissement_id
    )
  );

-- Retours are immutable (no update or delete)
CREATE POLICY "no_update_retours"
  ON retours FOR UPDATE
  TO authenticated
  USING (false);

CREATE POLICY "no_delete_retours"
  ON retours FOR DELETE
  TO authenticated
  USING (false);

-- ============================================================================
-- RETOUR_ITEMS TABLE POLICIES
-- ============================================================================

-- Patron and Gerant can read retour_items through retours
CREATE POLICY "patron_gerant_read_retour_items"
  ON retour_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM retours r
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE r.id = retour_items.retour_id
      AND p.role IN ('patron', 'gerant')
      AND p.actif = true
      AND p.etablissement_id = r.etablissement_id
    )
  );

-- Patron and Gerant can create retour_items
CREATE POLICY "patron_gerant_create_retour_items"
  ON retour_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM retours r
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE r.id = retour_items.retour_id
      AND p.role IN ('patron', 'gerant')
      AND p.actif = true
      AND p.etablissement_id = r.etablissement_id
    )
  );

-- Retour items are immutable
CREATE POLICY "no_update_retour_items"
  ON retour_items FOR UPDATE
  TO authenticated
  USING (false);

CREATE POLICY "no_delete_retour_items"
  ON retour_items FOR DELETE
  TO authenticated
  USING (false);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON POLICY "patron_read_establishment_retours" ON retours IS 'Patron can read all returns in their establishment';
COMMENT ON POLICY "patron_create_retours" ON retours IS 'Patron can create returns in their establishment';
COMMENT ON POLICY "patron_gerant_read_retour_items" ON retour_items IS 'Patron and Gerant can read return items';
COMMENT ON POLICY "patron_gerant_create_retour_items" ON retour_items IS 'Patron and Gerant can create return items';
