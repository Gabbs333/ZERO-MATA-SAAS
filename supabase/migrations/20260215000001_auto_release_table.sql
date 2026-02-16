-- Migration: Auto-release tables when all orders are finished/paid
-- Description: Adds logic to automatically free a table when it has no more active orders or unpaid invoices.

-- ============================================================================
-- FUNCTION: Check and Release Table
-- ============================================================================

CREATE OR REPLACE FUNCTION check_and_release_table(p_table_id UUID)
RETURNS VOID AS $$
DECLARE
  v_active_count INTEGER;
BEGIN
  -- Count active commands for this table
  -- Active means NOT 'terminee' and NOT 'annulee'
  -- Note: 'validee' means invoice created but not necessarily paid.
  -- When paid, command status becomes 'terminee' via trigger.
  SELECT COUNT(*)
  INTO v_active_count
  FROM commandes
  WHERE table_id = p_table_id
  AND statut NOT IN ('terminee', 'annulee');

  -- If no active commands, free the table
  IF v_active_count = 0 THEN
    UPDATE tables
    SET statut = 'libre',
        derniere_mise_a_jour = NOW()
    WHERE id = p_table_id
    AND statut != 'libre'; -- Only update if not already free
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION: Update commande after facture payment (Enhanced)
-- ============================================================================

CREATE OR REPLACE FUNCTION update_commande_after_facture_payee()
RETURNS TRIGGER AS $$
DECLARE
  v_table_id UUID;
BEGIN
  -- Check if status changed to 'payee'
  IF NEW.statut = 'payee' AND (OLD.statut IS NULL OR OLD.statut != 'payee') THEN
    -- Update the linked commande
    UPDATE commandes
    SET 
      est_payee = true,
      statut = 'terminee'
    WHERE id = NEW.commande_id
    RETURNING table_id INTO v_table_id;
    
    -- Check if table can be released
    IF v_table_id IS NOT NULL THEN
      PERFORM check_and_release_table(v_table_id);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGER: Auto-release table on Commande status change
-- ============================================================================

CREATE OR REPLACE FUNCTION on_commande_status_change_release_table()
RETURNS TRIGGER AS $$
BEGIN
  -- If status changed to 'terminee' or 'annulee', check if table is free
  IF (NEW.statut = 'terminee' OR NEW.statut = 'annulee') AND 
     (OLD.statut IS NULL OR OLD.statut != NEW.statut) THEN
     
    PERFORM check_and_release_table(NEW.table_id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_release_table_on_commande_end ON commandes;

CREATE TRIGGER trigger_release_table_on_commande_end
  AFTER UPDATE OF statut ON commandes
  FOR EACH ROW
  EXECUTE FUNCTION on_commande_status_change_release_table();
