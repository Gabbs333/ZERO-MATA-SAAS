-- Migration: Create Invoice on Commande Validation
-- Description: Automates Invoice generation when a command is validated.
-- Updated: Now auto-sets credit_sur based on client.credit_active.

CREATE OR REPLACE FUNCTION create_invoice_on_validation()
RETURNS TRIGGER AS $$
DECLARE
  v_credit_sur BOOLEAN := false;
BEGIN
  -- Only proceed if status changed to 'validee'
  IF NEW.statut = 'validee' AND (OLD.statut IS NULL OR OLD.statut != 'validee') THEN

    -- Check if client has credit enabled
    IF NEW.client_id IS NOT NULL THEN
      SELECT credit_active INTO v_credit_sur FROM clients WHERE id = NEW.client_id;
      IF v_credit_sur IS NULL THEN v_credit_sur := false; END IF;
    END IF;

    -- Create Invoice automatically
    INSERT INTO factures (
      commande_id,
      etablissement_id,
      montant_total,
      montant_paye,
      montant_restant,
      statut,
      credit_sur,
      date_generation
    ) VALUES (
      NEW.id,
      NEW.etablissement_id,
      NEW.montant_total,
      0,
      NEW.montant_total,
      'en_attente_paiement',
      v_credit_sur,
      NOW()
    )
    ON CONFLICT (commande_id) DO NOTHING;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create Trigger
DROP TRIGGER IF EXISTS trigger_create_invoice_on_validation ON commandes;

CREATE TRIGGER trigger_create_invoice_on_validation
  AFTER UPDATE ON commandes
  FOR EACH ROW
  EXECUTE FUNCTION create_invoice_on_validation();
