-- Migration: Add etablissement_id to all existing tables
-- This migration adds the etablissement_id column to all tables for multi-tenancy support
-- The column is nullable initially to allow for data migration

-- Add etablissement_id to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS etablissement_id UUID REFERENCES etablissements(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_profiles_etablissement_id ON profiles(etablissement_id);

-- Add etablissement_id to produits table
ALTER TABLE produits
ADD COLUMN IF NOT EXISTS etablissement_id UUID REFERENCES etablissements(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_produits_etablissement_id ON produits(etablissement_id);

-- Add etablissement_id to stock table
ALTER TABLE stock
ADD COLUMN IF NOT EXISTS etablissement_id UUID REFERENCES etablissements(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_stock_etablissement_id ON stock(etablissement_id);

-- Add etablissement_id to mouvements_stock table
ALTER TABLE mouvements_stock
ADD COLUMN IF NOT EXISTS etablissement_id UUID REFERENCES etablissements(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_mouvements_stock_etablissement_id ON mouvements_stock(etablissement_id);

-- Add etablissement_id to tables table
ALTER TABLE tables
ADD COLUMN IF NOT EXISTS etablissement_id UUID REFERENCES etablissements(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_tables_etablissement_id ON tables(etablissement_id);

-- Add etablissement_id to commandes table
ALTER TABLE commandes
ADD COLUMN IF NOT EXISTS etablissement_id UUID REFERENCES etablissements(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_commandes_etablissement_id ON commandes(etablissement_id);

-- Add etablissement_id to commande_items table
ALTER TABLE commande_items
ADD COLUMN IF NOT EXISTS etablissement_id UUID REFERENCES etablissements(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_commande_items_etablissement_id ON commande_items(etablissement_id);

-- Add etablissement_id to ravitaillements table
ALTER TABLE ravitaillements
ADD COLUMN IF NOT EXISTS etablissement_id UUID REFERENCES etablissements(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_ravitaillements_etablissement_id ON ravitaillements(etablissement_id);

-- Add etablissement_id to ravitaillement_items table
ALTER TABLE ravitaillement_items
ADD COLUMN IF NOT EXISTS etablissement_id UUID REFERENCES etablissements(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_ravitaillement_items_etablissement_id ON ravitaillement_items(etablissement_id);

-- Add etablissement_id to factures table
ALTER TABLE factures
ADD COLUMN IF NOT EXISTS etablissement_id UUID REFERENCES etablissements(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_factures_etablissement_id ON factures(etablissement_id);

-- Add etablissement_id to encaissements table
ALTER TABLE encaissements
ADD COLUMN IF NOT EXISTS etablissement_id UUID REFERENCES etablissements(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_encaissements_etablissement_id ON encaissements(etablissement_id);

-- Add etablissement_id to audit_logs table
ALTER TABLE audit_logs
ADD COLUMN IF NOT EXISTS etablissement_id UUID REFERENCES etablissements(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_audit_logs_etablissement_id ON audit_logs(etablissement_id);

-- Note: Columns are nullable for now to allow data migration
-- They will be made NOT NULL (except profiles) in migration 20240128000003_migrate_existing_data.sql
