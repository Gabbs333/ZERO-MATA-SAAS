-- Migration: Factures RLS Policies and Triggers
-- Description: Creates RLS policies for factures table and trigger for automatic facture generation

-- ============================================================================
-- ENABLE RLS
-- ============================================================================

ALTER TABLE factures ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES FOR FACTURES
-- ============================================================================

-- Policy: Le comptoir et le patron/gérant peuvent lire toutes les factures
CREATE POLICY "comptoir_patron_gerant_read_factures" ON factures
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('comptoir', 'patron', 'gerant')
    )
  );

-- Policy: Les factures sont créées automatiquement (via trigger)
-- Seul le système peut insérer des factures (pas d'accès direct)
CREATE POLICY "system_only_insert_factures" ON factures
  FOR INSERT
  WITH CHECK (false);

-- Policy: Les factures sont immuables (pas de modification manuelle)
-- Seul le système peut mettre à jour les factures (via triggers d'encaissement)
CREATE POLICY "system_only_update_factures" ON factures
  FOR UPDATE
  USING (false);

-- Policy: Les factures ne peuvent pas être supprimées
CREATE POLICY "no_delete_factures" ON factures
  FOR DELETE
  USING (false);

-- ============================================================================
-- FUNCTION: Generate facture automatically after commande validation
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_facture_after_validation()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate facture when commande is validated
  IF NEW.statut = 'validee' AND (OLD.statut IS NULL OR OLD.statut != 'validee') THEN
    -- Insert facture with same montant_total as commande
    INSERT INTO factures (
      commande_id,
      montant_total,
      montant_paye,
      montant_restant,
      statut
    ) VALUES (
      NEW.id,
      NEW.montant_total,
      0,
      NEW.montant_total,
      'en_attente_paiement'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGER: Generate facture after commande validation
-- ============================================================================

CREATE TRIGGER trigger_generate_facture_after_validation
  AFTER INSERT OR UPDATE ON commandes
  FOR EACH ROW
  EXECUTE FUNCTION generate_facture_after_validation();

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant usage on factures table to authenticated users
GRANT SELECT ON factures TO authenticated;

