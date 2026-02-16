-- Migration: Update table status on payment
-- Description: Updates the trigger function to set table status to 'libre' when commande is paid.

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
    
    -- Update the table status to 'libre'
    IF v_table_id IS NOT NULL THEN
      UPDATE tables
      SET statut = 'libre',
          derniere_mise_a_jour = NOW()
      WHERE id = v_table_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
