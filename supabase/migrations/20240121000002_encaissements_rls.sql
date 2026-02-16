-- Migration: Encaissements RLS Policies and Triggers
-- Description: Creates RLS policies for encaissements table and trigger for automatic facture status update

-- ============================================================================
-- ENABLE RLS
-- ============================================================================

ALTER TABLE encaissements ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES FOR ENCAISSEMENTS
-- ============================================================================

-- Policy: Seul le comptoir peut créer des encaissements
CREATE POLICY "comptoir_create_encaissements" ON encaissements
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'comptoir'
    )
  );

-- Policy: Le comptoir et le patron/gérant peuvent lire les encaissements
CREATE POLICY "comptoir_patron_gerant_read_encaissements" ON encaissements
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('comptoir', 'patron', 'gerant')
    )
  );

-- Policy: Les encaissements sont immuables après création (pas de modification)
CREATE POLICY "no_update_encaissements" ON encaissements
  FOR UPDATE
  USING (false);

-- Policy: Les encaissements ne peuvent pas être supprimés
CREATE POLICY "no_delete_encaissements" ON encaissements
  FOR DELETE
  USING (false);

-- ============================================================================
-- FUNCTION: Update facture status after encaissement
-- ============================================================================

CREATE OR REPLACE FUNCTION update_facture_after_encaissement()
RETURNS TRIGGER AS $$
DECLARE
  v_facture_montant_total INTEGER;
  v_total_encaisse INTEGER;
  v_nouveau_montant_paye INTEGER;
  v_nouveau_montant_restant INTEGER;
  v_nouveau_statut TEXT;
BEGIN
  -- Get facture montant_total
  SELECT montant_total INTO v_facture_montant_total
  FROM factures
  WHERE id = NEW.facture_id;
  
  -- Calculate total encaissé for this facture
  SELECT COALESCE(SUM(montant), 0) INTO v_total_encaisse
  FROM encaissements
  WHERE facture_id = NEW.facture_id;
  
  -- Calculate new values
  v_nouveau_montant_paye := v_total_encaisse;
  v_nouveau_montant_restant := v_facture_montant_total - v_total_encaisse;
  
  -- Determine new status
  IF v_nouveau_montant_restant = 0 THEN
    v_nouveau_statut := 'payee';
  ELSIF v_nouveau_montant_paye > 0 AND v_nouveau_montant_restant > 0 THEN
    v_nouveau_statut := 'partiellement_payee';
  ELSE
    v_nouveau_statut := 'en_attente_paiement';
  END IF;
  
  -- Update facture
  UPDATE factures
  SET 
    montant_paye = v_nouveau_montant_paye,
    montant_restant = v_nouveau_montant_restant,
    statut = v_nouveau_statut,
    date_paiement_complet = CASE 
      WHEN v_nouveau_statut = 'payee' THEN NOW()
      ELSE date_paiement_complet
    END
  WHERE id = NEW.facture_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGER: Update facture after encaissement
-- ============================================================================

CREATE TRIGGER trigger_update_facture_after_encaissement
  AFTER INSERT ON encaissements
  FOR EACH ROW
  EXECUTE FUNCTION update_facture_after_encaissement();

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant usage on encaissements table to authenticated users
GRANT SELECT, INSERT ON encaissements TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON POLICY "comptoir_create_encaissements" ON encaissements IS 
  'Seul le comptoir peut créer des encaissements';

COMMENT ON POLICY "comptoir_patron_gerant_read_encaissements" ON encaissements IS 
  'Le comptoir, patron et gérant peuvent lire les encaissements';

COMMENT ON FUNCTION update_facture_after_encaissement() IS 
  'Mise à jour automatique du statut de facture après encaissement (total ou partiel)';

