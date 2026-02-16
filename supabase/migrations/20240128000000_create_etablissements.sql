-- Migration: Create etablissements table and multi-tenancy infrastructure
-- Description: Creates the etablissements table to support multi-tenant SaaS architecture
-- Requirements: 2.1, 2.2, 2.3, 2.4, 2.5

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create etablissements table
CREATE TABLE IF NOT EXISTS etablissements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nom TEXT NOT NULL,
  adresse TEXT,
  telephone TEXT,
  email TEXT,
  
  -- Subscription management
  statut_abonnement TEXT NOT NULL CHECK (statut_abonnement IN ('actif', 'expire', 'suspendu')) DEFAULT 'actif',
  date_debut TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  date_fin TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '12 months'),
  actif BOOLEAN NOT NULL DEFAULT true,
  
  -- Payment tracking
  dernier_paiement_date TIMESTAMPTZ,
  dernier_paiement_confirme_par UUID REFERENCES auth.users(id),
  
  -- Metadata
  date_creation TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  date_modification TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for query performance
CREATE INDEX IF NOT EXISTS idx_etablissements_statut ON etablissements(statut_abonnement);
CREATE INDEX IF NOT EXISTS idx_etablissements_date_fin ON etablissements(date_fin);
CREATE INDEX IF NOT EXISTS idx_etablissements_actif ON etablissements(actif);

-- Enable Row Level Security
ALTER TABLE etablissements ENABLE ROW LEVEL SECURITY;

-- Add comment to table
COMMENT ON TABLE etablissements IS 'Stores establishment (client) information for multi-tenant SaaS platform';
COMMENT ON COLUMN etablissements.statut_abonnement IS 'Subscription status: actif, expire, or suspendu';
COMMENT ON COLUMN etablissements.date_debut IS 'Subscription start date';
COMMENT ON COLUMN etablissements.date_fin IS 'Subscription end date (automatically set to 12 months from start)';
COMMENT ON COLUMN etablissements.actif IS 'Whether the establishment is active and can access the system';
COMMENT ON COLUMN etablissements.dernier_paiement_date IS 'Date of last payment confirmation';
COMMENT ON COLUMN etablissements.dernier_paiement_confirme_par IS 'Admin user who confirmed the last payment';
