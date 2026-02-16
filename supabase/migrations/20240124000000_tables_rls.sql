-- Migration: Tables RLS Policies and Triggers
-- Description: Implements RLS policies for table management and automatic status updates

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE tables ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Policy: Everyone can read tables
-- Validates: Requirement 10.1
CREATE POLICY "authenticated_can_read_tables"
  ON tables FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Serveuses can update table status
-- Validates: Requirement 10.4
CREATE POLICY "serveuses_can_update_table_status"
  ON tables FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('serveuse', 'comptoir', 'gerant', 'patron')
      AND actif = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('serveuse', 'comptoir', 'gerant', 'patron')
      AND actif = true
    )
  );

-- Policy: Managers and owners can insert tables
CREATE POLICY "managers_can_insert_tables"
  ON tables FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('gerant', 'patron')
      AND actif = true
    )
  );

-- ============================================================================
-- FUNCTIONS FOR TABLE STATUS MANAGEMENT
-- ============================================================================

-- Function: Update table status when commande is created
-- Validates: Requirement 10.2
CREATE OR REPLACE FUNCTION update_table_status_on_commande_create()
RETURNS TRIGGER AS $$
BEGIN
  -- Mark table as "commande_en_attente" when a new order is created
  UPDATE tables
  SET statut = 'commande_en_attente',
      derniere_mise_a_jour = NOW()
  WHERE id = NEW.table_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: Update table status when commande is validated
-- Validates: Requirement 10.3
CREATE OR REPLACE FUNCTION update_table_status_on_commande_validate()
RETURNS TRIGGER AS $$
BEGIN
  -- Mark table as "occupee" when order is validated
  IF NEW.statut = 'validee' AND OLD.statut = 'en_attente' THEN
    UPDATE tables
    SET statut = 'occupee',
        derniere_mise_a_jour = NOW()
    WHERE id = NEW.table_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger: Update table status on commande creation
-- Validates: Requirement 10.2
CREATE TRIGGER trigger_update_table_on_commande_create
  AFTER INSERT ON commandes
  FOR EACH ROW
  EXECUTE FUNCTION update_table_status_on_commande_create();

-- Trigger: Update table status on commande validation
-- Validates: Requirement 10.3
CREATE TRIGGER trigger_update_table_on_commande_validate
  AFTER UPDATE ON commandes
  FOR EACH ROW
  WHEN (NEW.statut IS DISTINCT FROM OLD.statut)
  EXECUTE FUNCTION update_table_status_on_commande_validate();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON POLICY "authenticated_can_read_tables" ON tables IS 
  'All authenticated users can view tables and their status';

COMMENT ON POLICY "serveuses_can_update_table_status" ON tables IS 
  'Serveuses and other staff can update table status (e.g., mark as libre)';

COMMENT ON POLICY "managers_can_insert_tables" ON tables IS 
  'Only managers and owners can create new tables';

COMMENT ON FUNCTION update_table_status_on_commande_create() IS 
  'Automatically marks table as commande_en_attente when order is created';

COMMENT ON FUNCTION update_table_status_on_commande_validate() IS 
  'Automatically marks table as occupee when order is validated';
