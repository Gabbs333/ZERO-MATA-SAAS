-- Migration: Revert Invoice Trigger - credit_sur is now set manually at payment time
-- Description: Reverts create_invoice_on_validation() to NOT auto-set credit_sur.
-- Credit is chosen manually by the comptoir at payment time, not auto-derived
-- from the client's credit_active flag.
-- Created: 2026-04-15 | Updated: reverts credit auto-set

-- ============================================================================
-- Mise à jour de la fonction trigger de création de facture (forme simplifiée)
-- ============================================================================

CREATE OR REPLACE FUNCTION create_invoice_on_validation()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if status changed to 'validee'
  IF NEW.statut = 'validee' AND (OLD.statut IS NULL OR OLD.statut != 'validee') THEN

    -- Create Invoice automatically (credit_sur always false, set manually at payment)
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
      false,
      NOW()
    )
    ON CONFLICT (commande_id) DO NOTHING;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_invoice_on_validation() IS 'Crée automatiquement une facture quand une commande est validée. credit_sur reste à false (défini manuellement au moment du paiement).';
