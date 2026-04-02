-- Migration: Create retours (returns) tables
-- Description: Creates tables for managing product returns from validated orders
-- Created: 2026-04-02

-- ============================================================================
-- TABLES
-- ============================================================================

-- Retours table (main return record)
CREATE TABLE IF NOT EXISTS retours (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero_retour TEXT NOT NULL UNIQUE,
  facture_id UUID NOT NULL REFERENCES factures(id),
  commande_id UUID NOT NULL REFERENCES commandes(id),
  montant_total_retour INTEGER NOT NULL CHECK (montant_total_retour >= 0),
  motif TEXT,
  utilisateur_id UUID NOT NULL REFERENCES profiles(id),
  date_retour TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  etablissement_id UUID NOT NULL REFERENCES etablissements(id)
);

-- Retour items table (individual items being returned)
CREATE TABLE IF NOT EXISTS retour_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  retour_id UUID NOT NULL REFERENCES retours(id) ON DELETE CASCADE,
  commande_item_id UUID NOT NULL REFERENCES commande_items(id),
  produit_id UUID NOT NULL REFERENCES produits(id),
  nom_produit TEXT NOT NULL,
  quantite_retournee INTEGER NOT NULL CHECK (quantite_retournee > 0),
  prix_unitaire INTEGER NOT NULL CHECK (prix_unitaire >= 0),
  montant_ligne INTEGER NOT NULL CHECK (montant_ligne >= 0)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_retours_facture ON retours(facture_id);
CREATE INDEX IF NOT EXISTS idx_retours_commande ON retours(commande_id);
CREATE INDEX IF NOT EXISTS idx_retours_utilisateur ON retours(utilisateur_id);
CREATE INDEX IF NOT EXISTS idx_retours_date ON retours(date_retour);
CREATE INDEX IF NOT EXISTS idx_retours_etablissement ON retours(etablissement_id);
CREATE INDEX IF NOT EXISTS idx_retour_items_retour ON retour_items(retour_id);
CREATE INDEX IF NOT EXISTS idx_retour_items_produit ON retour_items(produit_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger for generating retour numbers
CREATE OR REPLACE FUNCTION generate_numero_retour()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
  date_part TEXT;
BEGIN
  date_part := TO_CHAR(NOW(), 'YYYYMMDD');
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(numero_retour FROM 13) AS INTEGER)), 0) + 1
  INTO next_num
  FROM retours
  WHERE numero_retour LIKE 'RET-' || date_part || '-%';
  
  NEW.numero_retour := 'RET-' || date_part || '-' || LPAD(next_num::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_numero_retour
  BEFORE INSERT ON retours
  FOR EACH ROW
  WHEN (NEW.numero_retour IS NULL OR NEW.numero_retour = '')
  EXECUTE FUNCTION generate_numero_retour();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE retours IS 'Product returns from validated orders';
COMMENT ON TABLE retour_items IS 'Individual items in a product return';
COMMENT ON FUNCTION generate_numero_retour IS 'Generates sequential return numbers in format RET-YYYYMMDD-NNN';
