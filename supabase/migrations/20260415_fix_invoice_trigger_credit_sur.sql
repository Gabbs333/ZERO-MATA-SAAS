-- Migration: Fix Invoice Trigger to set credit_sur based on client.credit_active
-- Description: Updates create_invoice_on_validation() to check if the commande's
-- client has credit enabled and set credit_sur on the facture accordingly.
-- Created: 2026-04-15

-- ============================================================================
-- Mise à jour de la fonction trigger de création de facture
-- ============================================================================

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

-- ============================================================================
-- Mise à jour rétroactive : marquer les factures existantes sans credit_sur
-- qui appartiennent à des clients avec crédit actif
-- ============================================================================

UPDATE factures f
SET credit_sur = true
FROM commandes c
JOIN clients cl ON c.client_id = cl.id AND cl.credit_active = true
WHERE f.commande_id = c.id
  AND f.credit_sur = false;

COMMENT ON FUNCTION create_invoice_on_validation() IS 'Crée automatiquement une facture quand une commande est validée. Définit credit_sur=true si le client a le crédit actif.';
