-- Migration: Create retour_items_en_attente table for pending returns
-- Description: Creates table for pending return items that need patron validation
-- Created: 2026-04-08

-- ============================================================================
-- TABLE: retour_items_en_attente
-- ============================================================================

-- Pending return items table (items awaiting patron validation)
CREATE TABLE IF NOT EXISTS retour_items_en_attente (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  facture_id UUID NOT NULL REFERENCES factures(id),
  commande_id UUID NOT NULL REFERENCES commandes(id),
  commande_item_id UUID NOT NULL REFERENCES commande_items(id),
  produit_id UUID NOT NULL REFERENCES produits(id),
  nom_produit TEXT NOT NULL,
  quantite_retournee INTEGER NOT NULL CHECK (quantite_retournee > 0),
  prix_unitaire INTEGER NOT NULL CHECK (prix_unitaire >= 0),
  montant_ligne INTEGER NOT NULL CHECK (montant_ligne >= 0),
  motif TEXT,
  utilisateur_id UUID NOT NULL REFERENCES profiles(id),
  date_demande TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  etablissement_id UUID NOT NULL REFERENCES etablissements(id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_retour_items_en_attente_facture ON retour_items_en_attente(facture_id);
CREATE INDEX IF NOT EXISTS idx_retour_items_en_attente_commande ON retour_items_en_attente(commande_id);
CREATE INDEX IF NOT EXISTS idx_retour_items_en_attente_utilisateur ON retour_items_en_attente(utilisateur_id);
CREATE INDEX IF NOT EXISTS idx_retour_items_en_attente_date ON retour_items_en_attente(date_demande);
CREATE INDEX IF NOT EXISTS idx_retour_items_en_attente_etablissement ON retour_items_en_attente(etablissement_id);
CREATE INDEX IF NOT EXISTS idx_retour_items_en_attente_produit ON retour_items_en_attente(produit_id);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE retour_items_en_attente ENABLE ROW LEVEL SECURITY;

-- Comptoir can create pending returns in their establishment
CREATE POLICY "comptoir_create_pending_retours"
  ON retour_items_en_attente FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'comptoir'
      AND p.actif = true
      AND p.etablissement_id = retour_items_en_attente.etablissement_id
    )
  );

-- Patron and Gerant can read pending returns in their establishment
CREATE POLICY "patron_gerant_read_pending_retours"
  ON retour_items_en_attente FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('patron', 'gerant')
      AND p.actif = true
      AND p.etablissement_id = retour_items_en_attente.etablissement_id
    )
  );

-- Comptoir can delete their own pending returns (before validation)
CREATE POLICY "comptoir_delete_own_pending_retours"
  ON retour_items_en_attente FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'comptoir'
      AND p.actif = true
      AND p.id = retour_items_en_attente.utilisateur_id
    )
  );

-- No updates allowed (items are immutable once created)
CREATE POLICY "no_update_pending_retours"
  ON retour_items_en_attente FOR UPDATE
  TO authenticated
  USING (false);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE retour_items_en_attente IS 'Pending return items awaiting patron validation';
COMMENT ON COLUMN retour_items_en_attente.motif IS 'Reason for the return (optional)';
COMMENT ON COLUMN retour_items_en_attente.date_demande IS 'Timestamp when the return was requested';