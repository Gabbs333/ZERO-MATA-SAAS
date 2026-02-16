-- Migration: Automate Commande Completion on Facture Payment
-- Description: Adds a trigger to automatically update the commande status when its facture is paid.

-- ============================================================================
-- FUNCTION: Update commande after facture payment
-- ============================================================================

CREATE OR REPLACE FUNCTION update_commande_after_facture_payee()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if status changed to 'payee'
  IF NEW.statut = 'payee' AND (OLD.statut IS NULL OR OLD.statut != 'payee') THEN
    -- Update the linked commande
    UPDATE commandes
    SET 
      est_payee = true,
      statut = 'terminee'
    WHERE id = NEW.commande_id;
    
    -- Also update the table status to 'libre' if needed? 
    -- Usually tables are freed manually or when the client leaves, 
    -- but if payment implies the end of the service, we might want to log it or let the serveuse do it.
    -- For now, we only mark the commande as finished.
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGER: Update commande after facture payment
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_update_commande_after_facture_payee ON factures;

CREATE TRIGGER trigger_update_commande_after_facture_payee
  AFTER UPDATE ON factures
  FOR EACH ROW
  EXECUTE FUNCTION update_commande_after_facture_payee();
