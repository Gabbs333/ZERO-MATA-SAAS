-- Migration: Create Invoice on Commande Validation
-- Description: Automates Invoice generation when a command is validated.

CREATE OR REPLACE FUNCTION create_invoice_on_validation()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if status changed to 'validee'
  IF NEW.statut = 'validee' AND (OLD.statut IS NULL OR OLD.statut != 'validee') THEN
    
    -- Create Invoice automatically
    INSERT INTO factures (
      commande_id,
      etablissement_id,
      montant_total,
      montant_paye,
      montant_restant,
      statut,
      date_generation
    ) VALUES (
      NEW.id,
      NEW.etablissement_id,
      NEW.montant_total,
      0,
      NEW.montant_total,
      'en_attente_paiement',
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
