-- Migration: Initial Schema for Snack Bar Management System
-- Description: Creates all tables, triggers, and functions for the system

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLES
-- ============================================================================

-- Users table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('serveuse', 'comptoir', 'gerant', 'patron')),
  actif BOOLEAN NOT NULL DEFAULT true,
  date_creation TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  derniere_connexion TIMESTAMPTZ
);

-- Produits table
CREATE TABLE IF NOT EXISTS produits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nom TEXT NOT NULL UNIQUE,
  categorie TEXT NOT NULL CHECK (categorie IN ('boisson', 'nourriture', 'autre')),
  prix_vente INTEGER NOT NULL CHECK (prix_vente > 0),
  seuil_stock_minimum INTEGER NOT NULL DEFAULT 0 CHECK (seuil_stock_minimum >= 0),
  actif BOOLEAN NOT NULL DEFAULT true,
  date_creation TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  date_modification TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Stock table
CREATE TABLE IF NOT EXISTS stock (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  produit_id UUID NOT NULL REFERENCES produits(id) ON DELETE CASCADE UNIQUE,
  quantite_disponible INTEGER NOT NULL DEFAULT 0 CHECK (quantite_disponible >= 0),
  derniere_mise_a_jour TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tables table
CREATE TABLE IF NOT EXISTS tables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero TEXT NOT NULL UNIQUE,
  statut TEXT NOT NULL DEFAULT 'libre' CHECK (statut IN ('libre', 'occupee', 'commande_en_attente')),
  derniere_mise_a_jour TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Commandes table
CREATE TABLE IF NOT EXISTS commandes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero_commande TEXT NOT NULL UNIQUE,
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE RESTRICT,
  serveuse_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  statut TEXT NOT NULL DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'validee', 'annulee')),
  montant_total INTEGER NOT NULL DEFAULT 0 CHECK (montant_total >= 0),
  date_creation TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  date_validation TIMESTAMPTZ,
  validateur_id UUID REFERENCES profiles(id) ON DELETE RESTRICT
);

-- Commande items table
CREATE TABLE IF NOT EXISTS commande_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  commande_id UUID NOT NULL REFERENCES commandes(id) ON DELETE CASCADE,
  produit_id UUID NOT NULL REFERENCES produits(id) ON DELETE RESTRICT,
  nom_produit TEXT NOT NULL,
  prix_unitaire INTEGER NOT NULL CHECK (prix_unitaire > 0),
  quantite INTEGER NOT NULL CHECK (quantite > 0),
  montant_ligne INTEGER NOT NULL CHECK (montant_ligne >= 0)
);

-- Mouvements stock table
CREATE TABLE IF NOT EXISTS mouvements_stock (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  produit_id UUID NOT NULL REFERENCES produits(id) ON DELETE RESTRICT,
  type TEXT NOT NULL CHECK (type IN ('entree', 'sortie')),
  quantite INTEGER NOT NULL CHECK (quantite > 0),
  cout_unitaire INTEGER CHECK (cout_unitaire >= 0),
  reference TEXT NOT NULL,
  type_reference TEXT NOT NULL CHECK (type_reference IN ('commande', 'ravitaillement')),
  utilisateur_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  date_creation TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ravitaillements table
CREATE TABLE IF NOT EXISTS ravitaillements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero_ravitaillement TEXT NOT NULL UNIQUE,
  fournisseur TEXT NOT NULL,
  date_ravitaillement DATE NOT NULL,
  montant_total INTEGER NOT NULL DEFAULT 0 CHECK (montant_total >= 0),
  gerant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  date_creation TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ravitaillement items table
CREATE TABLE IF NOT EXISTS ravitaillement_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ravitaillement_id UUID NOT NULL REFERENCES ravitaillements(id) ON DELETE CASCADE,
  produit_id UUID NOT NULL REFERENCES produits(id) ON DELETE RESTRICT,
  quantite INTEGER NOT NULL CHECK (quantite > 0),
  cout_unitaire INTEGER NOT NULL CHECK (cout_unitaire >= 0),
  montant_ligne INTEGER NOT NULL CHECK (montant_ligne >= 0)
);

-- Factures table
CREATE TABLE IF NOT EXISTS factures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero_facture TEXT NOT NULL UNIQUE,
  commande_id UUID NOT NULL REFERENCES commandes(id) ON DELETE RESTRICT UNIQUE,
  montant_total INTEGER NOT NULL CHECK (montant_total >= 0),
  montant_paye INTEGER NOT NULL DEFAULT 0 CHECK (montant_paye >= 0),
  montant_restant INTEGER NOT NULL CHECK (montant_restant >= 0),
  statut TEXT NOT NULL DEFAULT 'en_attente_paiement' CHECK (statut IN ('en_attente_paiement', 'partiellement_payee', 'payee')),
  date_generation TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  date_paiement_complet TIMESTAMPTZ,
  CONSTRAINT montant_paye_valid CHECK (montant_paye <= montant_total),
  CONSTRAINT montant_restant_valid CHECK (montant_restant = montant_total - montant_paye)
);

-- Encaissements table
CREATE TABLE IF NOT EXISTS encaissements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  facture_id UUID NOT NULL REFERENCES factures(id) ON DELETE RESTRICT,
  montant INTEGER NOT NULL CHECK (montant > 0),
  mode_paiement TEXT NOT NULL CHECK (mode_paiement IN ('especes', 'mobile_money', 'carte_bancaire')),
  reference TEXT,
  utilisateur_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  date_encaissement TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  utilisateur_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entite TEXT NOT NULL,
  entite_id TEXT NOT NULL,
  details_avant JSONB,
  details_apres JSONB NOT NULL,
  adresse_ip TEXT,
  date_creation TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_commandes_serveuse ON commandes(serveuse_id);
CREATE INDEX IF NOT EXISTS idx_commandes_date_creation ON commandes(date_creation);
CREATE INDEX IF NOT EXISTS idx_commandes_statut ON commandes(statut);
CREATE INDEX IF NOT EXISTS idx_mouvements_stock_produit ON mouvements_stock(produit_id);
CREATE INDEX IF NOT EXISTS idx_mouvements_stock_date ON mouvements_stock(date_creation);
CREATE INDEX IF NOT EXISTS idx_audit_logs_utilisateur ON audit_logs(utilisateur_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_date ON audit_logs(date_creation);
CREATE INDEX IF NOT EXISTS idx_factures_commande ON factures(commande_id);
CREATE INDEX IF NOT EXISTS idx_factures_statut ON factures(statut);
CREATE INDEX IF NOT EXISTS idx_factures_date ON factures(date_generation);
CREATE INDEX IF NOT EXISTS idx_encaissements_facture ON encaissements(facture_id);
CREATE INDEX IF NOT EXISTS idx_encaissements_date ON encaissements(date_encaissement);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to generate sequential numbers
CREATE OR REPLACE FUNCTION generate_numero_commande()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
  date_part TEXT;
BEGIN
  date_part := TO_CHAR(NOW(), 'YYYYMMDD');
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(numero_commande FROM 13) AS INTEGER)), 0) + 1
  INTO next_num
  FROM commandes
  WHERE numero_commande LIKE 'CMD-' || date_part || '-%';
  
  NEW.numero_commande := 'CMD-' || date_part || '-' || LPAD(next_num::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_numero_ravitaillement()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
  date_part TEXT;
BEGIN
  date_part := TO_CHAR(NOW(), 'YYYYMMDD');
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(numero_ravitaillement FROM 13) AS INTEGER)), 0) + 1
  INTO next_num
  FROM ravitaillements
  WHERE numero_ravitaillement LIKE 'RAV-' || date_part || '-%';
  
  NEW.numero_ravitaillement := 'RAV-' || date_part || '-' || LPAD(next_num::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_numero_facture()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
  date_part TEXT;
BEGIN
  date_part := TO_CHAR(NOW(), 'YYYYMMDD');
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(numero_facture FROM 14) AS INTEGER)), 0) + 1
  INTO next_num
  FROM factures
  WHERE numero_facture LIKE 'FACT-' || date_part || '-%';
  
  NEW.numero_facture := 'FACT-' || date_part || '-' || LPAD(next_num::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate commande total
CREATE OR REPLACE FUNCTION calculate_commande_total()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE commandes
  SET montant_total = (
    SELECT COALESCE(SUM(montant_ligne), 0)
    FROM commande_items
    WHERE commande_id = NEW.commande_id
  )
  WHERE id = NEW.commande_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger for generating commande numbers
CREATE TRIGGER trigger_generate_numero_commande
  BEFORE INSERT ON commandes
  FOR EACH ROW
  WHEN (NEW.numero_commande IS NULL OR NEW.numero_commande = '')
  EXECUTE FUNCTION generate_numero_commande();

-- Trigger for generating ravitaillement numbers
CREATE TRIGGER trigger_generate_numero_ravitaillement
  BEFORE INSERT ON ravitaillements
  FOR EACH ROW
  WHEN (NEW.numero_ravitaillement IS NULL OR NEW.numero_ravitaillement = '')
  EXECUTE FUNCTION generate_numero_ravitaillement();

-- Trigger for generating facture numbers
CREATE TRIGGER trigger_generate_numero_facture
  BEFORE INSERT ON factures
  FOR EACH ROW
  WHEN (NEW.numero_facture IS NULL OR NEW.numero_facture = '')
  EXECUTE FUNCTION generate_numero_facture();

-- Trigger for calculating commande total
CREATE TRIGGER trigger_calculate_commande_total
  AFTER INSERT OR UPDATE OR DELETE ON commande_items
  FOR EACH ROW
  EXECUTE FUNCTION calculate_commande_total();

-- Trigger to update product modification date
CREATE OR REPLACE FUNCTION update_produit_date_modification()
RETURNS TRIGGER AS $$
BEGIN
  NEW.date_modification := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_produit_date
  BEFORE UPDATE ON produits
  FOR EACH ROW
  EXECUTE FUNCTION update_produit_date_modification();
