-- SCHEMA MIGRATION (Generated)

-- Source: 20240115000000_initial_schema.sql
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


-- Source: 20240116000001_profiles_trigger.sql
-- Migration: Add trigger for automatic profile creation
-- Description: Creates a profile automatically when a user signs up via auth.users

-- ============================================================================
-- TRIGGER FUNCTION FOR AUTOMATIC PROFILE CREATION
-- ============================================================================

-- Function to create profile automatically after user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nom, prenom, role, actif, etablissement_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nom', 'Non renseigné'),
    COALESCE(NEW.raw_user_meta_data->>'prenom', 'Non renseigné'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'serveuse'),
    TRUE,
    (NEW.raw_user_meta_data->>'etablissement_id')::UUID
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- FUNCTION TO UPDATE LAST CONNECTION
-- ============================================================================

-- Function to update derniere_connexion on login
CREATE OR REPLACE FUNCTION public.update_derniere_connexion()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET derniere_connexion = NOW()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: This trigger would need to be on auth.sessions or called from application
-- For now, we'll handle this in the application layer

-- ============================================================================
-- HELPER FUNCTIONS FOR PROFILE MANAGEMENT
-- ============================================================================

-- Function to create a new user with profile (for admin use)
CREATE OR REPLACE FUNCTION public.create_user_with_profile(
  p_email TEXT,
  p_password TEXT,
  p_nom TEXT,
  p_prenom TEXT,
  p_role TEXT
)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Validate role
  IF p_role NOT IN ('serveuse', 'comptoir', 'gerant', 'patron') THEN
    RAISE EXCEPTION 'Invalid role: %', p_role;
  END IF;

  -- This function should be called with service_role key
  -- The actual user creation happens via Supabase Auth API
  -- This is a placeholder for documentation purposes
  
  RAISE EXCEPTION 'This function must be called via Supabase Admin API';
  
  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION public.handle_new_user IS 'Automatically creates a profile when a new user signs up';
COMMENT ON FUNCTION public.update_derniere_connexion IS 'Updates the last connection timestamp for a user';
COMMENT ON FUNCTION public.create_user_with_profile IS 'Helper function documentation for creating users with profiles via Admin API';
-- COMMENT ON TRIGGER on_auth_user_created ON auth.users IS 'Trigger that creates a profile automatically after user signup';


-- Source: 20240116000003_audit_system.sql
-- Migration: Audit System
-- Description: Implements automatic audit logging for critical tables

-- ============================================================================
-- AUDIT TRIGGER FUNCTION
-- ============================================================================

-- Generic audit trigger function that logs INSERT, UPDATE, DELETE operations
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
  audit_row audit_logs;
  excluded_cols TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Set the action based on operation
  IF (TG_OP = 'INSERT') THEN
    audit_row.action := TG_TABLE_NAME || '.created';
    audit_row.details_avant := NULL;
    audit_row.details_apres := to_jsonb(NEW);
    audit_row.entite_id := COALESCE(NEW.id::TEXT, 'unknown');
  ELSIF (TG_OP = 'UPDATE') THEN
    audit_row.action := TG_TABLE_NAME || '.updated';
    audit_row.details_avant := to_jsonb(OLD);
    audit_row.details_apres := to_jsonb(NEW);
    audit_row.entite_id := COALESCE(NEW.id::TEXT, OLD.id::TEXT, 'unknown');
  ELSIF (TG_OP = 'DELETE') THEN
    audit_row.action := TG_TABLE_NAME || '.deleted';
    audit_row.details_avant := to_jsonb(OLD);
    audit_row.details_apres := NULL;
    audit_row.entite_id := COALESCE(OLD.id::TEXT, 'unknown');
  END IF;
  
  -- Set common fields
  audit_row.utilisateur_id := auth.uid();
  audit_row.entite := TG_TABLE_NAME;
  audit_row.adresse_ip := current_setting('request.headers', true)::json->>'x-forwarded-for';
  audit_row.date_creation := NOW();
  
  -- Insert audit log
  INSERT INTO audit_logs (
    utilisateur_id,
    action,
    entite,
    entite_id,
    details_avant,
    details_apres,
    adresse_ip,
    date_creation
  ) VALUES (
    audit_row.utilisateur_id,
    audit_row.action,
    audit_row.entite,
    audit_row.entite_id,
    audit_row.details_avant,
    audit_row.details_apres,
    audit_row.adresse_ip,
    audit_row.date_creation
  );
  
  -- Return the appropriate row
  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- CREATE AUDIT TRIGGERS ON CRITICAL TABLES
-- ============================================================================

-- Audit trigger for profiles table
CREATE TRIGGER audit_profiles_trigger
  AFTER INSERT OR UPDATE OR DELETE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_function();

-- Audit trigger for produits table
CREATE TRIGGER audit_produits_trigger
  AFTER INSERT OR UPDATE OR DELETE ON produits
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_function();

-- Audit trigger for commandes table
CREATE TRIGGER audit_commandes_trigger
  AFTER INSERT OR UPDATE OR DELETE ON commandes
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_function();

-- Audit trigger for ravitaillements table
CREATE TRIGGER audit_ravitaillements_trigger
  AFTER INSERT OR UPDATE OR DELETE ON ravitaillements
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_function();

-- Audit trigger for factures table
CREATE TRIGGER audit_factures_trigger
  AFTER INSERT OR UPDATE OR DELETE ON factures
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_function();

-- Audit trigger for encaissements table
CREATE TRIGGER audit_encaissements_trigger
  AFTER INSERT OR UPDATE OR DELETE ON encaissements
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_function();

-- Audit trigger for stock table (important for tracking stock changes)
CREATE TRIGGER audit_stock_trigger
  AFTER INSERT OR UPDATE OR DELETE ON stock
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_function();

-- Audit trigger for mouvements_stock table
CREATE TRIGGER audit_mouvements_stock_trigger
  AFTER INSERT OR UPDATE OR DELETE ON mouvements_stock
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_function();

-- ============================================================================
-- AUDIT QUERY FUNCTIONS
-- ============================================================================

-- Function to get audit logs for a specific entity
CREATE OR REPLACE FUNCTION get_audit_logs_for_entity(
  p_entite TEXT,
  p_entite_id TEXT,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  utilisateur_id UUID,
  utilisateur_nom TEXT,
  action TEXT,
  details_avant JSONB,
  details_apres JSONB,
  adresse_ip TEXT,
  date_creation TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    al.id,
    al.utilisateur_id,
    COALESCE(p.nom || ' ' || p.prenom, 'Système') as utilisateur_nom,
    al.action,
    al.details_avant,
    al.details_apres,
    al.adresse_ip,
    al.date_creation
  FROM audit_logs al
  LEFT JOIN profiles p ON p.id = al.utilisateur_id
  WHERE al.entite = p_entite
    AND al.entite_id = p_entite_id
  ORDER BY al.date_creation DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get audit logs for a specific user
CREATE OR REPLACE FUNCTION get_audit_logs_for_user(
  p_utilisateur_id UUID,
  p_debut TIMESTAMPTZ DEFAULT NULL,
  p_fin TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  action TEXT,
  entite TEXT,
  entite_id TEXT,
  details_avant JSONB,
  details_apres JSONB,
  adresse_ip TEXT,
  date_creation TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    al.id,
    al.action,
    al.entite,
    al.entite_id,
    al.details_avant,
    al.details_apres,
    al.adresse_ip,
    al.date_creation
  FROM audit_logs al
  WHERE al.utilisateur_id = p_utilisateur_id
    AND (p_debut IS NULL OR al.date_creation >= p_debut)
    AND (p_fin IS NULL OR al.date_creation <= p_fin)
  ORDER BY al.date_creation DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get recent audit logs
CREATE OR REPLACE FUNCTION get_recent_audit_logs(
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  utilisateur_id UUID,
  utilisateur_nom TEXT,
  action TEXT,
  entite TEXT,
  entite_id TEXT,
  adresse_ip TEXT,
  date_creation TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    al.id,
    al.utilisateur_id,
    COALESCE(p.nom || ' ' || p.prenom, 'Système') as utilisateur_nom,
    al.action,
    al.entite,
    al.entite_id,
    al.adresse_ip,
    al.date_creation
  FROM audit_logs al
  LEFT JOIN profiles p ON p.id = al.utilisateur_id
  ORDER BY al.date_creation DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to search audit logs with filters
CREATE OR REPLACE FUNCTION search_audit_logs(
  p_action TEXT DEFAULT NULL,
  p_entite TEXT DEFAULT NULL,
  p_utilisateur_id UUID DEFAULT NULL,
  p_debut TIMESTAMPTZ DEFAULT NULL,
  p_fin TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  utilisateur_id UUID,
  utilisateur_nom TEXT,
  action TEXT,
  entite TEXT,
  entite_id TEXT,
  details_avant JSONB,
  details_apres JSONB,
  adresse_ip TEXT,
  date_creation TIMESTAMPTZ,
  total_count BIGINT
) AS $$
DECLARE
  v_total_count BIGINT;
BEGIN
  -- Get total count
  SELECT COUNT(*) INTO v_total_count
  FROM audit_logs al
  WHERE (p_action IS NULL OR al.action ILIKE '%' || p_action || '%')
    AND (p_entite IS NULL OR al.entite = p_entite)
    AND (p_utilisateur_id IS NULL OR al.utilisateur_id = p_utilisateur_id)
    AND (p_debut IS NULL OR al.date_creation >= p_debut)
    AND (p_fin IS NULL OR al.date_creation <= p_fin);
  
  -- Return paginated results
  RETURN QUERY
  SELECT
    al.id,
    al.utilisateur_id,
    COALESCE(p.nom || ' ' || p.prenom, 'Système') as utilisateur_nom,
    al.action,
    al.entite,
    al.entite_id,
    al.details_avant,
    al.details_apres,
    al.adresse_ip,
    al.date_creation,
    v_total_count
  FROM audit_logs al
  LEFT JOIN profiles p ON p.id = al.utilisateur_id
  WHERE (p_action IS NULL OR al.action ILIKE '%' || p_action || '%')
    AND (p_entite IS NULL OR al.entite = p_entite)
    AND (p_utilisateur_id IS NULL OR al.utilisateur_id = p_utilisateur_id)
    AND (p_debut IS NULL OR al.date_creation >= p_debut)
    AND (p_fin IS NULL OR al.date_creation <= p_fin)
  ORDER BY al.date_creation DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- AUDIT STATISTICS FUNCTIONS
-- ============================================================================

-- Function to get audit statistics by action type
CREATE OR REPLACE FUNCTION get_audit_stats_by_action(
  p_debut TIMESTAMPTZ DEFAULT NULL,
  p_fin TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  action TEXT,
  count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    al.action,
    COUNT(*) as count
  FROM audit_logs al
  WHERE (p_debut IS NULL OR al.date_creation >= p_debut)
    AND (p_fin IS NULL OR al.date_creation <= p_fin)
  GROUP BY al.action
  ORDER BY count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get audit statistics by user
CREATE OR REPLACE FUNCTION get_audit_stats_by_user(
  p_debut TIMESTAMPTZ DEFAULT NULL,
  p_fin TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  utilisateur_id UUID,
  utilisateur_nom TEXT,
  count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    al.utilisateur_id,
    COALESCE(p.nom || ' ' || p.prenom, 'Système') as utilisateur_nom,
    COUNT(*) as count
  FROM audit_logs al
  LEFT JOIN profiles p ON p.id = al.utilisateur_id
  WHERE (p_debut IS NULL OR al.date_creation >= p_debut)
    AND (p_fin IS NULL OR al.date_creation <= p_fin)
  GROUP BY al.utilisateur_id, p.nom, p.prenom
  ORDER BY count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION audit_trigger_function IS 'Generic trigger function that automatically logs INSERT, UPDATE, DELETE operations to audit_logs';
COMMENT ON FUNCTION get_audit_logs_for_entity IS 'Retrieves audit logs for a specific entity (e.g., a specific commande or produit)';
COMMENT ON FUNCTION get_audit_logs_for_user IS 'Retrieves audit logs for a specific user within a time period';
COMMENT ON FUNCTION get_recent_audit_logs IS 'Retrieves the most recent audit logs across all entities';
COMMENT ON FUNCTION search_audit_logs IS 'Searches audit logs with multiple filters and pagination';
COMMENT ON FUNCTION get_audit_stats_by_action IS 'Returns statistics of audit logs grouped by action type';
COMMENT ON FUNCTION get_audit_stats_by_user IS 'Returns statistics of audit logs grouped by user';

COMMENT ON TRIGGER audit_profiles_trigger ON profiles IS 'Requirement 7.5: Audit all profile changes';
COMMENT ON TRIGGER audit_commandes_trigger ON commandes IS 'Requirement 8.1: Audit all commande operations';
COMMENT ON TRIGGER audit_produits_trigger ON produits IS 'Requirement 12.5: Audit all product modifications';


-- Source: 20240118000001_commandes_functions.sql
-- Migration: PostgreSQL Functions for Commandes
-- Description: Implements business logic functions for order management
-- Requirements: 1.1, 1.5, 2.2, 2.3, 2.4

-- ============================================================================
-- FUNCTION: get_produits_disponibles
-- Description: Returns products with stock > 0 and actif = true
-- Requirements: 1.5
-- ============================================================================

CREATE OR REPLACE FUNCTION get_produits_disponibles()
RETURNS TABLE (
  id UUID,
  nom TEXT,
  categorie TEXT,
  prix_vente INTEGER,
  seuil_stock_minimum INTEGER,
  actif BOOLEAN,
  quantite_disponible INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.nom,
    p.categorie,
    p.prix_vente,
    p.seuil_stock_minimum,
    p.actif,
    s.quantite_disponible
  FROM produits p
  INNER JOIN stock s ON s.produit_id = p.id
  WHERE p.actif = true
  AND s.quantite_disponible > 0
  ORDER BY p.categorie, p.nom;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_produits_disponibles() TO authenticated;

-- ============================================================================
-- FUNCTION: create_commande
-- Description: Creates a commande with items and calculates total
-- Requirements: 1.1
-- ============================================================================

CREATE OR REPLACE FUNCTION create_commande(
  p_table_id UUID,
  p_items JSONB
)
RETURNS UUID AS $$
DECLARE
  v_commande_id UUID;
  v_item JSONB;
  v_montant_total INTEGER := 0;
  v_produit RECORD;
BEGIN
  -- Validate that table exists
  IF NOT EXISTS (SELECT 1 FROM tables WHERE id = p_table_id) THEN
    RAISE EXCEPTION 'Table not found';
  END IF;

  -- Validate that items array is not empty
  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Commande must have at least one item';
  END IF;

  -- Create the commande
  INSERT INTO commandes (table_id, serveuse_id, statut)
  VALUES (p_table_id, auth.uid(), 'en_attente')
  RETURNING id INTO v_commande_id;

  -- Insert items and calculate total
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Get product details
    SELECT id, nom, prix_vente, actif
    INTO v_produit
    FROM produits
    WHERE id = (v_item->>'produit_id')::UUID;

    -- Validate product exists and is active
    IF v_produit.id IS NULL THEN
      RAISE EXCEPTION 'Product % not found', v_item->>'produit_id';
    END IF;

    IF NOT v_produit.actif THEN
      RAISE EXCEPTION 'Product % is not active', v_produit.nom;
    END IF;

    -- Validate quantity
    IF (v_item->>'quantite')::INTEGER <= 0 THEN
      RAISE EXCEPTION 'Quantity must be greater than 0';
    END IF;

    -- Calculate line amount
    DECLARE
      v_quantite INTEGER := (v_item->>'quantite')::INTEGER;
      v_montant_ligne INTEGER := v_produit.prix_vente * v_quantite;
    BEGIN
      -- Insert commande item
      INSERT INTO commande_items (
        commande_id,
        produit_id,
        nom_produit,
        prix_unitaire,
        quantite,
        montant_ligne
      ) VALUES (
        v_commande_id,
        v_produit.id,
        v_produit.nom,
        v_produit.prix_vente,
        v_quantite,
        v_montant_ligne
      );

      -- Add to total
      v_montant_total := v_montant_total + v_montant_ligne;
    END;
  END LOOP;

  -- Update commande total (trigger will also do this, but we do it explicitly)
  UPDATE commandes
  SET montant_total = v_montant_total
  WHERE id = v_commande_id;

  -- Update table status
  UPDATE tables
  SET statut = 'commande_en_attente',
      derniere_mise_a_jour = NOW()
  WHERE id = p_table_id;

  RETURN v_commande_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_commande(UUID, JSONB) TO authenticated;

-- ============================================================================
-- FUNCTION: validate_commande
-- Description: Validates a commande (checks stock, deducts, creates movements)
-- Requirements: 2.2, 2.3, 2.4
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_commande(
  p_commande_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_commande RECORD;
  v_item RECORD;
  v_stock RECORD;
  v_result JSONB;
BEGIN
  -- Get commande details
  SELECT * INTO v_commande
  FROM commandes
  WHERE id = p_commande_id;

  -- Validate commande exists
  IF v_commande.id IS NULL THEN
    RAISE EXCEPTION 'Commande not found';
  END IF;

  -- Validate commande is in pending status
  IF v_commande.statut != 'en_attente' THEN
    RAISE EXCEPTION 'Commande is not in pending status';
  END IF;

  -- Check stock availability for all items
  FOR v_item IN 
    SELECT * FROM commande_items WHERE commande_id = p_commande_id
  LOOP
    -- Get current stock
    SELECT * INTO v_stock
    FROM stock
    WHERE produit_id = v_item.produit_id;

    -- Check if stock is sufficient
    IF v_stock.quantite_disponible < v_item.quantite THEN
      RAISE EXCEPTION 'Insufficient stock for product %: available %, requested %',
        v_item.nom_produit, v_stock.quantite_disponible, v_item.quantite;
    END IF;
  END LOOP;

  -- All checks passed, proceed with validation
  -- Deduct stock and create movements
  FOR v_item IN 
    SELECT * FROM commande_items WHERE commande_id = p_commande_id
  LOOP
    -- Deduct from stock
    UPDATE stock
    SET quantite_disponible = quantite_disponible - v_item.quantite,
        derniere_mise_a_jour = NOW()
    WHERE produit_id = v_item.produit_id;

    -- Create stock movement
    INSERT INTO mouvements_stock (
      produit_id,
      type,
      quantite,
      cout_unitaire,
      reference,
      type_reference,
      utilisateur_id
    ) VALUES (
      v_item.produit_id,
      'sortie',
      v_item.quantite,
      NULL, -- Cost is not tracked for sales
      p_commande_id::TEXT,
      'commande',
      auth.uid()
    );
  END LOOP;

  -- Update commande status
  UPDATE commandes
  SET statut = 'validee',
      date_validation = NOW(),
      validateur_id = auth.uid()
  WHERE id = p_commande_id;

  -- Update table status
  UPDATE tables
  SET statut = 'occupee',
      derniere_mise_a_jour = NOW()
  WHERE id = v_commande.table_id;

  -- Return success result
  v_result := jsonb_build_object(
    'success', true,
    'commande_id', p_commande_id,
    'message', 'Commande validated successfully'
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    -- Return error result
    v_result := jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION validate_commande(UUID) TO authenticated;


-- Source: 20240119000001_ravitaillements_functions.sql
-- Migration: Functions and Triggers for Ravitaillements
-- Description: Creates functions for ravitaillement management and automatic stock updates
-- Requirements: 4.1, 4.2, 4.3, 4.5

-- ============================================================================
-- FUNCTION: create_ravitaillement
-- ============================================================================

-- Function to create a ravitaillement with automatic stock updates
-- Requirement: 4.1, 4.2, 4.3 - Create ravitaillement with stock update
CREATE OR REPLACE FUNCTION create_ravitaillement(
  p_fournisseur TEXT,
  p_date_ravitaillement DATE,
  p_items JSONB
)
RETURNS TABLE(
  ravitaillement_id UUID,
  numero_ravitaillement TEXT,
  montant_total INTEGER
) AS $$
DECLARE
  v_ravitaillement_id UUID;
  v_numero_ravitaillement TEXT;
  v_montant_total INTEGER := 0;
  v_item JSONB;
  v_produit_id UUID;
  v_quantite INTEGER;
  v_cout_unitaire INTEGER;
  v_montant_ligne INTEGER;
  v_gerant_id UUID;
BEGIN
  -- Get current user ID
  v_gerant_id := auth.uid();
  
  -- Verify user has gerant or patron role
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = v_gerant_id
    AND role IN ('gerant', 'patron')
    AND actif = true
  ) THEN
    RAISE EXCEPTION 'Only gerant or patron can create ravitaillements';
  END IF;
  
  -- Validate input
  IF p_fournisseur IS NULL OR p_fournisseur = '' THEN
    RAISE EXCEPTION 'Fournisseur is required';
  END IF;
  
  IF p_date_ravitaillement IS NULL THEN
    RAISE EXCEPTION 'Date ravitaillement is required';
  END IF;
  
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one item is required';
  END IF;
  
  -- Create ravitaillement
  INSERT INTO ravitaillements (
    fournisseur,
    date_ravitaillement,
    gerant_id
  )
  VALUES (
    p_fournisseur,
    p_date_ravitaillement,
    v_gerant_id
  )
  RETURNING id, numero_ravitaillement INTO v_ravitaillement_id, v_numero_ravitaillement;
  
  -- Process each item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Extract item data
    v_produit_id := (v_item->>'produit_id')::UUID;
    v_quantite := (v_item->>'quantite')::INTEGER;
    v_cout_unitaire := (v_item->>'cout_unitaire')::INTEGER;
    
    -- Validate item data
    IF v_produit_id IS NULL THEN
      RAISE EXCEPTION 'Product ID is required for all items';
    END IF;
    
    IF v_quantite IS NULL OR v_quantite <= 0 THEN
      RAISE EXCEPTION 'Quantity must be positive for all items';
    END IF;
    
    IF v_cout_unitaire IS NULL OR v_cout_unitaire < 0 THEN
      RAISE EXCEPTION 'Unit cost must be non-negative for all items';
    END IF;
    
    -- Verify product exists
    IF NOT EXISTS (SELECT 1 FROM produits WHERE id = v_produit_id) THEN
      RAISE EXCEPTION 'Product % does not exist', v_produit_id;
    END IF;
    
    -- Calculate line amount
    v_montant_ligne := v_quantite * v_cout_unitaire;
    v_montant_total := v_montant_total + v_montant_ligne;
    
    -- Create ravitaillement item
    INSERT INTO ravitaillement_items (
      ravitaillement_id,
      produit_id,
      quantite,
      cout_unitaire,
      montant_ligne
    )
    VALUES (
      v_ravitaillement_id,
      v_produit_id,
      v_quantite,
      v_cout_unitaire,
      v_montant_ligne
    );
    
    -- Create stock movement (entree)
    INSERT INTO mouvements_stock (
      produit_id,
      type,
      quantite,
      cout_unitaire,
      reference,
      type_reference,
      utilisateur_id
    )
    VALUES (
      v_produit_id,
      'entree',
      v_quantite,
      v_cout_unitaire,
      v_numero_ravitaillement,
      'ravitaillement',
      v_gerant_id
    );
    
    -- Update stock
    -- If stock doesn't exist for this product, create it
    INSERT INTO stock (produit_id, quantite_disponible)
    VALUES (v_produit_id, v_quantite)
    ON CONFLICT (produit_id)
    DO UPDATE SET
      quantite_disponible = stock.quantite_disponible + v_quantite,
      derniere_mise_a_jour = NOW();
  END LOOP;
  
  -- Update ravitaillement total amount
  UPDATE ravitaillements
  SET montant_total = v_montant_total
  WHERE id = v_ravitaillement_id;
  
  -- Return ravitaillement info
  RETURN QUERY
  SELECT v_ravitaillement_id, v_numero_ravitaillement, v_montant_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION: get_ravitaillements_by_period
-- ============================================================================

-- Function to filter ravitaillements by period
-- Requirement: 4.5 - Filter ravitaillements by date range
CREATE OR REPLACE FUNCTION get_ravitaillements_by_period(
  p_date_debut DATE,
  p_date_fin DATE
)
RETURNS TABLE(
  id UUID,
  numero_ravitaillement TEXT,
  fournisseur TEXT,
  date_ravitaillement DATE,
  montant_total INTEGER,
  gerant_id UUID,
  gerant_nom TEXT,
  gerant_prenom TEXT,
  date_creation TIMESTAMPTZ,
  items_count INTEGER
) AS $$
BEGIN
  -- Validate dates
  IF p_date_debut IS NULL OR p_date_fin IS NULL THEN
    RAISE EXCEPTION 'Start and end dates are required';
  END IF;
  
  IF p_date_debut > p_date_fin THEN
    RAISE EXCEPTION 'Start date must be before or equal to end date';
  END IF;
  
  -- Return ravitaillements in the period
  RETURN QUERY
  SELECT
    r.id,
    r.numero_ravitaillement,
    r.fournisseur,
    r.date_ravitaillement,
    r.montant_total,
    r.gerant_id,
    p.nom AS gerant_nom,
    p.prenom AS gerant_prenom,
    r.date_creation,
    (SELECT COUNT(*)::INTEGER FROM ravitaillement_items WHERE ravitaillement_id = r.id) AS items_count
  FROM ravitaillements r
  JOIN profiles p ON r.gerant_id = p.id
  WHERE r.date_ravitaillement >= p_date_debut
    AND r.date_ravitaillement <= p_date_fin
  ORDER BY r.date_ravitaillement DESC, r.date_creation DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION: get_ravitaillement_details
-- ============================================================================

-- Function to get complete ravitaillement details with items
CREATE OR REPLACE FUNCTION get_ravitaillement_details(
  p_ravitaillement_id UUID
)
RETURNS TABLE(
  id UUID,
  numero_ravitaillement TEXT,
  fournisseur TEXT,
  date_ravitaillement DATE,
  montant_total INTEGER,
  gerant_id UUID,
  gerant_nom TEXT,
  gerant_prenom TEXT,
  date_creation TIMESTAMPTZ,
  items JSONB
) AS $$
BEGIN
  -- Validate input
  IF p_ravitaillement_id IS NULL THEN
    RAISE EXCEPTION 'Ravitaillement ID is required';
  END IF;
  
  -- Return ravitaillement with items
  RETURN QUERY
  SELECT
    r.id,
    r.numero_ravitaillement,
    r.fournisseur,
    r.date_ravitaillement,
    r.montant_total,
    r.gerant_id,
    p.nom AS gerant_nom,
    p.prenom AS gerant_prenom,
    r.date_creation,
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', ri.id,
          'produit_id', ri.produit_id,
          'produit_nom', prod.nom,
          'quantite', ri.quantite,
          'cout_unitaire', ri.cout_unitaire,
          'montant_ligne', ri.montant_ligne
        )
      )
      FROM ravitaillement_items ri
      JOIN produits prod ON ri.produit_id = prod.id
      WHERE ri.ravitaillement_id = r.id
    ) AS items
  FROM ravitaillements r
  JOIN profiles p ON r.gerant_id = p.id
  WHERE r.id = p_ravitaillement_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGER: Update stock after ravitaillement item creation
-- ============================================================================

-- This trigger is already handled in the create_ravitaillement function
-- But we add it here for direct inserts (if any)
CREATE OR REPLACE FUNCTION trigger_update_stock_on_ravitaillement()
RETURNS TRIGGER AS $$
BEGIN
  -- Update stock when a ravitaillement item is created
  INSERT INTO stock (produit_id, quantite_disponible)
  VALUES (NEW.produit_id, NEW.quantite)
  ON CONFLICT (produit_id)
  DO UPDATE SET
    quantite_disponible = stock.quantite_disponible + NEW.quantite,
    derniere_mise_a_jour = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: We don't create this trigger because stock updates are handled
-- in the create_ravitaillement function to maintain transaction integrity
-- CREATE TRIGGER trigger_ravitaillement_update_stock
--   AFTER INSERT ON ravitaillement_items
--   FOR EACH ROW
--   EXECUTE FUNCTION trigger_update_stock_on_ravitaillement();

-- ============================================================================
-- FUNCTION: Calculate ravitaillement total
-- ============================================================================

-- Function to calculate and update ravitaillement total
CREATE OR REPLACE FUNCTION calculate_ravitaillement_total()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE ravitaillements
  SET montant_total = (
    SELECT COALESCE(SUM(montant_ligne), 0)
    FROM ravitaillement_items
    WHERE ravitaillement_id = NEW.ravitaillement_id
  )
  WHERE id = NEW.ravitaillement_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for calculating ravitaillement total
CREATE TRIGGER trigger_calculate_ravitaillement_total
  AFTER INSERT OR UPDATE OR DELETE ON ravitaillement_items
  FOR EACH ROW
  EXECUTE FUNCTION calculate_ravitaillement_total();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION create_ravitaillement IS 
  'Creates a ravitaillement with items and automatically updates stock (Requirements 4.1, 4.2, 4.3)';

COMMENT ON FUNCTION get_ravitaillements_by_period IS 
  'Filters ravitaillements by date range (Requirement 4.5)';

COMMENT ON FUNCTION get_ravitaillement_details IS 
  'Returns complete ravitaillement details with all items';

COMMENT ON FUNCTION trigger_update_stock_on_ravitaillement IS 
  'Updates stock when ravitaillement items are created (Requirement 4.3)';

COMMENT ON FUNCTION calculate_ravitaillement_total IS 
  'Calculates and updates ravitaillement total amount (Requirement 4.4)';


-- Source: 20240120000000_stock_alerts.sql
-- Migration: Stock Alerts System
-- Description: Creates function and view for stock alerts when quantity <= threshold

-- ============================================================================
-- FUNCTION: check_stock_alerts()
-- ============================================================================
-- Returns products with stock quantity at or below their minimum threshold
-- This function is used to identify products that need restocking

CREATE OR REPLACE FUNCTION check_stock_alerts()
RETURNS TABLE (
  produit_id UUID,
  nom_produit TEXT,
  categorie TEXT,
  quantite_disponible INTEGER,
  seuil_stock_minimum INTEGER,
  difference INTEGER,
  derniere_mise_a_jour TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id AS produit_id,
    p.nom AS nom_produit,
    p.categorie,
    s.quantite_disponible,
    p.seuil_stock_minimum,
    (s.quantite_disponible - p.seuil_stock_minimum) AS difference,
    s.derniere_mise_a_jour
  FROM produits p
  INNER JOIN stock s ON p.id = s.produit_id
  WHERE p.actif = true
    AND s.quantite_disponible <= p.seuil_stock_minimum
  ORDER BY (s.quantite_disponible - p.seuil_stock_minimum) ASC, p.nom ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Add comment to function
COMMENT ON FUNCTION check_stock_alerts() IS 
'Returns all active products where current stock is at or below the minimum threshold. Results are ordered by urgency (lowest stock first).';

-- ============================================================================
-- VIEW: stock_alerts
-- ============================================================================
-- Materialized view for easy querying of stock alerts
-- This view provides a convenient way to check stock alerts without calling the function

CREATE OR REPLACE VIEW stock_alerts AS
SELECT 
  p.id AS produit_id,
  p.nom AS nom_produit,
  p.categorie,
  s.quantite_disponible,
  p.seuil_stock_minimum,
  (s.quantite_disponible - p.seuil_stock_minimum) AS difference,
  s.derniere_mise_a_jour,
  CASE 
    WHEN s.quantite_disponible = 0 THEN 'critique'
    WHEN s.quantite_disponible <= (p.seuil_stock_minimum * 0.5) THEN 'urgent'
    ELSE 'attention'
  END AS niveau_alerte
FROM produits p
INNER JOIN stock s ON p.id = s.produit_id
WHERE p.actif = true
  AND s.quantite_disponible <= p.seuil_stock_minimum
ORDER BY s.quantite_disponible ASC, p.nom ASC;

-- Add comment to view
COMMENT ON VIEW stock_alerts IS 
'View of all active products with stock at or below minimum threshold. Includes alert level (critique/urgent/attention) based on stock severity.';


-- Source: 20240121000001_factures_functions.sql
-- Migration: Factures Functions and Views
-- Description: Creates functions and views for factures management

-- ============================================================================
-- FUNCTION: Get factures impayees
-- ============================================================================

CREATE OR REPLACE FUNCTION get_factures_impayees()
RETURNS TABLE (
  id UUID,
  numero_facture TEXT,
  commande_id UUID,
  montant_total INTEGER,
  montant_paye INTEGER,
  montant_restant INTEGER,
  statut TEXT,
  date_generation TIMESTAMPTZ,
  date_paiement_complet TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    f.id,
    f.numero_facture,
    f.commande_id,
    f.montant_total,
    f.montant_paye,
    f.montant_restant,
    f.statut,
    f.date_generation,
    f.date_paiement_complet
  FROM factures f
  WHERE f.statut != 'payee'
  ORDER BY f.date_generation DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION: Get factures by status
-- ============================================================================

CREATE OR REPLACE FUNCTION get_factures_by_status(p_statut TEXT)
RETURNS TABLE (
  id UUID,
  numero_facture TEXT,
  commande_id UUID,
  montant_total INTEGER,
  montant_paye INTEGER,
  montant_restant INTEGER,
  statut TEXT,
  date_generation TIMESTAMPTZ,
  date_paiement_complet TIMESTAMPTZ
) AS $$
BEGIN
  -- Validate status parameter
  IF p_statut NOT IN ('en_attente_paiement', 'partiellement_payee', 'payee') THEN
    RAISE EXCEPTION 'Invalid status: %. Must be one of: en_attente_paiement, partiellement_payee, payee', p_statut;
  END IF;

  RETURN QUERY
  SELECT 
    f.id,
    f.numero_facture,
    f.commande_id,
    f.montant_total,
    f.montant_paye,
    f.montant_restant,
    f.statut,
    f.date_generation,
    f.date_paiement_complet
  FROM factures f
  WHERE f.statut = p_statut
  ORDER BY f.date_generation DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- VIEW: Factures with age (ancienneté)
-- ============================================================================

CREATE OR REPLACE VIEW factures_with_age AS
SELECT 
  f.id,
  f.numero_facture,
  f.commande_id,
  f.montant_total,
  f.montant_paye,
  f.montant_restant,
  f.statut,
  f.date_generation,
  f.date_paiement_complet,
  -- Calculate age in hours
  EXTRACT(EPOCH FROM (NOW() - f.date_generation)) / 3600 AS age_heures,
  -- Calculate age in days
  EXTRACT(EPOCH FROM (NOW() - f.date_generation)) / 86400 AS age_jours,
  -- Flag for overdue (> 24 hours)
  CASE 
    WHEN f.statut != 'payee' AND EXTRACT(EPOCH FROM (NOW() - f.date_generation)) / 3600 > 24 
    THEN true 
    ELSE false 
  END AS est_en_retard
FROM factures f;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant execute on functions to authenticated users
GRANT EXECUTE ON FUNCTION get_factures_impayees() TO authenticated;
GRANT EXECUTE ON FUNCTION get_factures_by_status(TEXT) TO authenticated;

-- Grant select on view to authenticated users
GRANT SELECT ON factures_with_age TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION get_factures_impayees() IS 'Returns all factures with status != payee';
COMMENT ON FUNCTION get_factures_by_status(TEXT) IS 'Returns factures filtered by status (en_attente_paiement, partiellement_payee, payee)';
COMMENT ON VIEW factures_with_age IS 'View of factures with calculated age in hours and days, and overdue flag';



-- Source: 20240121000003_encaissements_functions.sql
-- Migration: Encaissements Functions and Views
-- Description: Creates functions and views for encaissements management

-- ============================================================================
-- FUNCTION: Create encaissement
-- ============================================================================

CREATE OR REPLACE FUNCTION create_encaissement(
  p_facture_id UUID,
  p_montant INTEGER,
  p_mode_paiement TEXT,
  p_reference TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  facture_id UUID,
  montant INTEGER,
  mode_paiement TEXT,
  reference TEXT,
  utilisateur_id UUID,
  date_encaissement TIMESTAMPTZ
) AS $$
DECLARE
  v_facture_montant_restant INTEGER;
  v_encaissement_id UUID;
BEGIN
  -- Validate mode_paiement
  IF p_mode_paiement NOT IN ('especes', 'mobile_money', 'carte_bancaire') THEN
    RAISE EXCEPTION 'Invalid mode_paiement: %. Must be one of: especes, mobile_money, carte_bancaire', p_mode_paiement;
  END IF;
  
  -- Validate montant > 0
  IF p_montant <= 0 THEN
    RAISE EXCEPTION 'Montant must be greater than 0';
  END IF;
  
  -- Check if facture exists and get montant_restant
  SELECT montant_restant INTO v_facture_montant_restant
  FROM factures
  WHERE factures.id = p_facture_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Facture not found: %', p_facture_id;
  END IF;
  
  -- Check if montant doesn't exceed montant_restant
  IF p_montant > v_facture_montant_restant THEN
    RAISE EXCEPTION 'Montant (%) exceeds montant_restant (%) for facture %', 
      p_montant, v_facture_montant_restant, p_facture_id;
  END IF;
  
  -- Insert encaissement
  INSERT INTO encaissements (
    facture_id,
    montant,
    mode_paiement,
    reference,
    utilisateur_id
  ) VALUES (
    p_facture_id,
    p_montant,
    p_mode_paiement,
    p_reference,
    auth.uid()
  )
  RETURNING 
    encaissements.id,
    encaissements.facture_id,
    encaissements.montant,
    encaissements.mode_paiement,
    encaissements.reference,
    encaissements.utilisateur_id,
    encaissements.date_encaissement
  INTO 
    v_encaissement_id,
    p_facture_id,
    p_montant,
    p_mode_paiement,
    p_reference,
    id,
    date_encaissement;
  
  -- Return the created encaissement
  RETURN QUERY
  SELECT 
    v_encaissement_id,
    p_facture_id,
    p_montant,
    p_mode_paiement,
    p_reference,
    auth.uid(),
    NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION: Get encaissements stats by period and mode
-- ============================================================================

CREATE OR REPLACE FUNCTION get_encaissements_stats(
  p_date_debut TIMESTAMPTZ,
  p_date_fin TIMESTAMPTZ
)
RETURNS TABLE (
  mode_paiement TEXT,
  nombre_encaissements BIGINT,
  montant_total BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.mode_paiement,
    COUNT(*)::BIGINT as nombre_encaissements,
    SUM(e.montant)::BIGINT as montant_total
  FROM encaissements e
  WHERE e.date_encaissement >= p_date_debut
    AND e.date_encaissement <= p_date_fin
  GROUP BY e.mode_paiement
  ORDER BY montant_total DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- VIEW: Encaissements summary
-- ============================================================================

CREATE OR REPLACE VIEW encaissements_summary AS
SELECT 
  DATE(e.date_encaissement) as date,
  e.mode_paiement,
  COUNT(*) as nombre_encaissements,
  SUM(e.montant) as montant_total,
  AVG(e.montant) as montant_moyen,
  MIN(e.montant) as montant_min,
  MAX(e.montant) as montant_max
FROM encaissements e
GROUP BY DATE(e.date_encaissement), e.mode_paiement
ORDER BY date DESC, montant_total DESC;

-- ============================================================================
-- VIEW: Encaissements with facture details
-- ============================================================================

CREATE OR REPLACE VIEW encaissements_with_facture AS
SELECT 
  e.id as encaissement_id,
  e.facture_id,
  e.montant as montant_encaisse,
  e.mode_paiement,
  e.reference,
  e.utilisateur_id,
  e.date_encaissement,
  f.numero_facture,
  f.commande_id,
  f.montant_total as facture_montant_total,
  f.montant_paye as facture_montant_paye,
  f.montant_restant as facture_montant_restant,
  f.statut as facture_statut,
  f.date_generation as facture_date_generation,
  p.nom as utilisateur_nom,
  p.prenom as utilisateur_prenom,
  p.role as utilisateur_role
FROM encaissements e
JOIN factures f ON e.facture_id = f.id
JOIN profiles p ON e.utilisateur_id = p.id
ORDER BY e.date_encaissement DESC;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant execute on functions to authenticated users
GRANT EXECUTE ON FUNCTION create_encaissement(UUID, INTEGER, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_encaissements_stats(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- Grant select on views to authenticated users
GRANT SELECT ON encaissements_summary TO authenticated;
GRANT SELECT ON encaissements_with_facture TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION create_encaissement(UUID, INTEGER, TEXT, TEXT) IS 
  'Creates an encaissement and automatically updates the facture status. Validates montant and mode_paiement.';

COMMENT ON FUNCTION get_encaissements_stats(TIMESTAMPTZ, TIMESTAMPTZ) IS 
  'Returns encaissement statistics by mode_paiement for a given period';

COMMENT ON VIEW encaissements_summary IS 
  'Daily summary of encaissements by mode_paiement';

COMMENT ON VIEW encaissements_with_facture IS 
  'Encaissements with complete facture and user details';



-- Source: 20240122000000_analytics_ca_encaissements.sql
-- Migration: Analytics CA and Encaissements Views
-- Description: Creates views and functions for CA vs Encaissements analytics

-- ============================================================================
-- VIEW: Analytics CA vs Encaissements by period
-- ============================================================================

CREATE OR REPLACE VIEW analytics_ca_encaissements AS
WITH daily_ca AS (
  SELECT 
    DATE(c.date_validation) as date,
    COALESCE(SUM(c.montant_total), 0) as chiffre_affaires,
    COUNT(c.id) as nombre_commandes,
    COUNT(DISTINCT f.id) as nombre_factures
  FROM commandes c
  LEFT JOIN factures f ON c.id = f.commande_id
  WHERE c.statut = 'validee'
    AND c.date_validation IS NOT NULL
  GROUP BY DATE(c.date_validation)
),
daily_encaissements AS (
  SELECT 
    DATE(e.date_encaissement) as date,
    COALESCE(SUM(e.montant), 0) as encaissements
  FROM encaissements e
  GROUP BY DATE(e.date_encaissement)
)
SELECT 
  COALESCE(ca.date, enc.date) as date,
  COALESCE(ca.chiffre_affaires, 0) as chiffre_affaires,
  COALESCE(enc.encaissements, 0) as encaissements,
  COALESCE(ca.nombre_commandes, 0) as nombre_commandes,
  COALESCE(ca.nombre_factures, 0) as nombre_factures
FROM daily_ca ca
FULL OUTER JOIN daily_encaissements enc ON ca.date = enc.date
ORDER BY COALESCE(ca.date, enc.date) DESC;

-- ============================================================================
-- VIEW: Analytics Créances (CA - Encaissements)
-- ============================================================================

CREATE OR REPLACE VIEW analytics_creances AS
SELECT 
  -- Total CA (all validated commandes)
  COALESCE(SUM(c.montant_total), 0) as chiffre_affaires_total,
  -- Total Encaissements (all payments received)
  COALESCE(
    (SELECT SUM(e.montant) FROM encaissements e), 0
  ) as encaissements_total,
  -- Créances = CA - Encaissements
  COALESCE(SUM(c.montant_total), 0) - COALESCE(
    (SELECT SUM(e.montant) FROM encaissements e), 0
  ) as creances_total,
  -- Number of unpaid factures
  (SELECT COUNT(*) FROM factures WHERE statut != 'payee') as nombre_factures_impayees,
  -- Total amount of unpaid factures
  (SELECT COALESCE(SUM(montant_restant), 0) FROM factures WHERE statut != 'payee') as montant_factures_impayees
FROM commandes c
WHERE c.statut = 'validee';

-- ============================================================================
-- VIEW: Analytics by Payment Mode
-- ============================================================================

CREATE OR REPLACE VIEW analytics_by_payment_mode AS
SELECT 
  e.mode_paiement,
  COUNT(*) as nombre_encaissements,
  SUM(e.montant) as montant_total,
  AVG(e.montant) as montant_moyen,
  MIN(e.montant) as montant_min,
  MAX(e.montant) as montant_max,
  -- Percentage of total encaissements
  ROUND(
    (SUM(e.montant)::NUMERIC / NULLIF((SELECT SUM(montant) FROM encaissements), 0)) * 100, 
    2
  ) as pourcentage_total
FROM encaissements e
GROUP BY e.mode_paiement
ORDER BY montant_total DESC;

-- ============================================================================
-- FUNCTION: Get KPIs for a period
-- ============================================================================

CREATE OR REPLACE FUNCTION get_kpis(
  p_date_debut TIMESTAMPTZ,
  p_date_fin TIMESTAMPTZ
)
RETURNS TABLE (
  chiffre_affaires BIGINT,
  encaissements BIGINT,
  creances BIGINT,
  benefice BIGINT,
  nombre_commandes BIGINT,
  panier_moyen NUMERIC,
  nombre_factures_impayees BIGINT,
  taux_encaissement NUMERIC
) AS $$
DECLARE
  v_ca BIGINT;
  v_encaissements BIGINT;
  v_creances BIGINT;
  v_benefice BIGINT;
  v_nombre_commandes BIGINT;
  v_panier_moyen NUMERIC;
  v_nombre_factures_impayees BIGINT;
  v_taux_encaissement NUMERIC;
  v_cout_total BIGINT;
BEGIN
  -- Calculate Chiffre d'Affaires (CA)
  SELECT COALESCE(SUM(c.montant_total), 0)
  INTO v_ca
  FROM commandes c
  WHERE c.statut = 'validee'
    AND c.date_validation >= p_date_debut
    AND c.date_validation <= p_date_fin;
  
  -- Calculate Encaissements
  SELECT COALESCE(SUM(e.montant), 0)
  INTO v_encaissements
  FROM encaissements e
  WHERE e.date_encaissement >= p_date_debut
    AND e.date_encaissement <= p_date_fin;
  
  -- Calculate Créances (CA - Encaissements)
  v_creances := v_ca - v_encaissements;
  
  -- Calculate Bénéfice (CA - Coût d'achat des produits vendus)
  -- Get total cost of products sold in the period
  SELECT COALESCE(SUM(ci.quantite * COALESCE(
    (SELECT ms.cout_unitaire 
     FROM mouvements_stock ms 
     WHERE ms.produit_id = ci.produit_id 
       AND ms.type = 'entree' 
       AND ms.cout_unitaire IS NOT NULL
     ORDER BY ms.date_creation DESC 
     LIMIT 1
    ), 0
  )), 0)
  INTO v_cout_total
  FROM commande_items ci
  JOIN commandes c ON ci.commande_id = c.id
  WHERE c.statut = 'validee'
    AND c.date_validation >= p_date_debut
    AND c.date_validation <= p_date_fin;
  
  v_benefice := v_ca - v_cout_total;
  
  -- Calculate Nombre de Commandes
  SELECT COUNT(*)
  INTO v_nombre_commandes
  FROM commandes c
  WHERE c.statut = 'validee'
    AND c.date_validation >= p_date_debut
    AND c.date_validation <= p_date_fin;
  
  -- Calculate Panier Moyen
  IF v_nombre_commandes > 0 THEN
    v_panier_moyen := v_ca::NUMERIC / v_nombre_commandes;
  ELSE
    v_panier_moyen := 0;
  END IF;
  
  -- Calculate Nombre de Factures Impayées in the period
  SELECT COUNT(*)
  INTO v_nombre_factures_impayees
  FROM factures f
  WHERE f.statut != 'payee'
    AND f.date_generation >= p_date_debut
    AND f.date_generation <= p_date_fin;
  
  -- Calculate Taux d'Encaissement (Encaissements / CA * 100)
  IF v_ca > 0 THEN
    v_taux_encaissement := (v_encaissements::NUMERIC / v_ca) * 100;
  ELSE
    v_taux_encaissement := 0;
  END IF;
  
  -- Return results
  RETURN QUERY
  SELECT 
    v_ca,
    v_encaissements,
    v_creances,
    v_benefice,
    v_nombre_commandes,
    ROUND(v_panier_moyen, 2),
    v_nombre_factures_impayees,
    ROUND(v_taux_encaissement, 2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant select on views to authenticated users
GRANT SELECT ON analytics_ca_encaissements TO authenticated;
GRANT SELECT ON analytics_creances TO authenticated;
GRANT SELECT ON analytics_by_payment_mode TO authenticated;

-- Grant execute on function to authenticated users
GRANT EXECUTE ON FUNCTION get_kpis(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON VIEW analytics_ca_encaissements IS 
  'Daily analytics showing CA (validated commandes) vs Encaissements (payments received)';

COMMENT ON VIEW analytics_creances IS 
  'Global view of créances (receivables): CA - Encaissements';

COMMENT ON VIEW analytics_by_payment_mode IS 
  'Statistics of encaissements grouped by payment mode (especes, mobile_money, carte_bancaire)';

COMMENT ON FUNCTION get_kpis(TIMESTAMPTZ, TIMESTAMPTZ) IS 
  'Returns all KPIs for a given period: CA, encaissements, créances, bénéfice, nombre commandes, panier moyen, factures impayées, taux encaissement';


-- Source: 20240123000000_factures_impayees_alerts.sql
-- Migration: Factures Impayées Alerts
-- Description: Creates function and view for unpaid invoice alerts (> 24 hours)

-- ============================================================================
-- FUNCTION: Get factures impayees alerts (> 24 hours)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_factures_impayees_alerts()
RETURNS TABLE (
  id UUID,
  numero_facture TEXT,
  commande_id UUID,
  montant_total NUMERIC,
  montant_paye NUMERIC,
  montant_restant NUMERIC,
  statut TEXT,
  date_generation TIMESTAMPTZ,
  age_heures NUMERIC,
  age_jours NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    f.id,
    f.numero_facture,
    f.commande_id,
    f.montant_total,
    f.montant_paye,
    f.montant_restant,
    f.statut,
    f.date_generation,
    -- Calculate age in hours
    EXTRACT(EPOCH FROM (NOW() - f.date_generation)) / 3600 AS age_heures,
    -- Calculate age in days
    EXTRACT(EPOCH FROM (NOW() - f.date_generation)) / 86400 AS age_jours
  FROM factures f
  WHERE f.statut != 'payee'
    AND EXTRACT(EPOCH FROM (NOW() - f.date_generation)) / 3600 > 24
  ORDER BY f.date_generation ASC; -- Oldest first
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- VIEW: Factures overdue (en retard)
-- ============================================================================

CREATE OR REPLACE VIEW factures_overdue AS
SELECT 
  f.id,
  f.numero_facture,
  f.commande_id,
  f.montant_total,
  f.montant_paye,
  f.montant_restant,
  f.statut,
  f.date_generation,
  f.date_paiement_complet,
  -- Calculate age in hours
  EXTRACT(EPOCH FROM (NOW() - f.date_generation)) / 3600 AS age_heures,
  -- Calculate age in days
  EXTRACT(EPOCH FROM (NOW() - f.date_generation)) / 86400 AS age_jours,
  -- Calculate age in weeks
  EXTRACT(EPOCH FROM (NOW() - f.date_generation)) / 604800 AS age_semaines,
  -- Severity level based on age
  CASE 
    WHEN EXTRACT(EPOCH FROM (NOW() - f.date_generation)) / 3600 > 168 THEN 'critique' -- > 7 days
    WHEN EXTRACT(EPOCH FROM (NOW() - f.date_generation)) / 3600 > 72 THEN 'eleve'     -- > 3 days
    WHEN EXTRACT(EPOCH FROM (NOW() - f.date_generation)) / 3600 > 24 THEN 'moyen'     -- > 1 day
    ELSE 'faible'
  END AS niveau_alerte
FROM factures f
WHERE f.statut != 'payee'
  AND EXTRACT(EPOCH FROM (NOW() - f.date_generation)) / 3600 > 24;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant execute on function to authenticated users
GRANT EXECUTE ON FUNCTION get_factures_impayees_alerts() TO authenticated;

-- Grant select on view to authenticated users
GRANT SELECT ON factures_overdue TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION get_factures_impayees_alerts() IS 'Returns unpaid factures older than 24 hours with age calculation';
COMMENT ON VIEW factures_overdue IS 'View of overdue factures (> 24h) with age in hours/days/weeks and severity level';


-- Source: 20240125000000_analytics_views.sql
-- Migration: Analytics Views and Functions
-- Description: Creates views and functions for analytics and reporting
-- Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 8.5

-- ============================================================================
-- ANALYTICS VIEWS
-- ============================================================================

-- Vue: analytics_kpis
-- Description: KPIs principaux (CA, bénéfice, nombre commandes, panier moyen)
-- Calcule les indicateurs clés de performance pour une période donnée
CREATE OR REPLACE VIEW analytics_kpis AS
SELECT
  -- Chiffre d'affaires (somme des commandes validées)
  COALESCE(SUM(CASE WHEN c.statut = 'validee' THEN c.montant_total ELSE 0 END), 0) AS chiffre_affaires,
  
  -- Bénéfice (CA - coûts d'achat)
  COALESCE(SUM(CASE WHEN c.statut = 'validee' THEN c.montant_total ELSE 0 END), 0) - 
  COALESCE(SUM(
    CASE 
      WHEN c.statut = 'validee' THEN (
        SELECT COALESCE(SUM(ci.quantite * COALESCE(ms.cout_unitaire, 0)), 0)
        FROM commande_items ci
        LEFT JOIN LATERAL (
          SELECT cout_unitaire
          FROM mouvements_stock
          WHERE produit_id = ci.produit_id
            AND type = 'entree'
            AND cout_unitaire IS NOT NULL
          ORDER BY date_creation DESC
          LIMIT 1
        ) ms ON true
        WHERE ci.commande_id = c.id
      )
      ELSE 0
    END
  ), 0) AS benefice,
  
  -- Nombre de commandes validées
  COUNT(CASE WHEN c.statut = 'validee' THEN 1 END) AS nombre_commandes,
  
  -- Panier moyen (CA / nombre de commandes)
  CASE 
    WHEN COUNT(CASE WHEN c.statut = 'validee' THEN 1 END) > 0 
    THEN COALESCE(SUM(CASE WHEN c.statut = 'validee' THEN c.montant_total ELSE 0 END), 0) / 
         COUNT(CASE WHEN c.statut = 'validee' THEN 1 END)
    ELSE 0
  END AS panier_moyen,
  
  -- Nombre total de produits vendus
  COALESCE(SUM(
    CASE 
      WHEN c.statut = 'validee' THEN (
        SELECT COALESCE(SUM(quantite), 0)
        FROM commande_items
        WHERE commande_id = c.id
      )
      ELSE 0
    END
  ), 0) AS produits_vendus
FROM commandes c;

-- Vue: analytics_ventes_produits
-- Description: Agrégation des ventes par produit
-- Affiche les statistiques de vente pour chaque produit
CREATE OR REPLACE VIEW analytics_ventes_produits AS
SELECT
  p.id AS produit_id,
  p.nom AS produit_nom,
  p.categorie,
  COALESCE(SUM(ci.quantite), 0) AS quantite_vendue,
  COALESCE(SUM(ci.montant_ligne), 0) AS revenu_total,
  COUNT(DISTINCT c.id) AS nombre_commandes,
  CASE 
    WHEN SUM(ci.quantite) > 0 
    THEN SUM(ci.montant_ligne) / SUM(ci.quantite)
    ELSE 0
  END AS prix_moyen
FROM produits p
LEFT JOIN commande_items ci ON ci.produit_id = p.id
LEFT JOIN commandes c ON c.id = ci.commande_id AND c.statut = 'validee'
GROUP BY p.id, p.nom, p.categorie;

-- Vue: analytics_evolution_ca
-- Description: Évolution temporelle du CA par jour
-- Permet de visualiser l'évolution du chiffre d'affaires dans le temps
CREATE OR REPLACE VIEW analytics_evolution_ca AS
SELECT
  DATE(c.date_validation) AS date,
  COALESCE(SUM(c.montant_total), 0) AS chiffre_affaires,
  COUNT(*) AS nombre_commandes,
  CASE 
    WHEN COUNT(*) > 0 
    THEN COALESCE(SUM(c.montant_total), 0) / COUNT(*)
    ELSE 0
  END AS panier_moyen
FROM commandes c
WHERE c.statut = 'validee'
  AND c.date_validation IS NOT NULL
GROUP BY DATE(c.date_validation)
ORDER BY DATE(c.date_validation) DESC;

-- ============================================================================
-- ANALYTICS FUNCTIONS
-- ============================================================================

-- Fonction: get_analytics
-- Description: Retourne toutes les analytics pour une période donnée avec granularité
-- Parameters:
--   - p_debut: Date de début de la période
--   - p_fin: Date de fin de la période
--   - p_granularite: 'heure', 'jour', 'semaine', 'mois'
-- Returns: JSON avec tous les KPIs et statistiques
CREATE OR REPLACE FUNCTION get_analytics(
  p_debut TIMESTAMPTZ,
  p_fin TIMESTAMPTZ,
  p_granularite TEXT DEFAULT 'jour'
)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
  v_kpis JSON;
  v_ventes_produits JSON;
  v_evolution JSON;
BEGIN
  -- Valider la granularité
  IF p_granularite NOT IN ('heure', 'jour', 'semaine', 'mois') THEN
    RAISE EXCEPTION 'Granularité invalide. Valeurs acceptées: heure, jour, semaine, mois';
  END IF;

  -- Calculer les KPIs pour la période
  SELECT json_build_object(
    'chiffre_affaires', COALESCE(SUM(CASE WHEN c.statut = 'validee' THEN c.montant_total ELSE 0 END), 0),
    'benefice', COALESCE(SUM(CASE WHEN c.statut = 'validee' THEN c.montant_total ELSE 0 END), 0) - 
      COALESCE(SUM(
        CASE 
          WHEN c.statut = 'validee' THEN (
            SELECT COALESCE(SUM(ci.quantite * COALESCE(ms.cout_unitaire, 0)), 0)
            FROM commande_items ci
            LEFT JOIN LATERAL (
              SELECT cout_unitaire
              FROM mouvements_stock
              WHERE produit_id = ci.produit_id
                AND type = 'entree'
                AND cout_unitaire IS NOT NULL
              ORDER BY date_creation DESC
              LIMIT 1
            ) ms ON true
            WHERE ci.commande_id = c.id
          )
          ELSE 0
        END
      ), 0),
    'nombre_commandes', COUNT(CASE WHEN c.statut = 'validee' THEN 1 END),
    'panier_moyen', CASE 
      WHEN COUNT(CASE WHEN c.statut = 'validee' THEN 1 END) > 0 
      THEN COALESCE(SUM(CASE WHEN c.statut = 'validee' THEN c.montant_total ELSE 0 END), 0) / 
           COUNT(CASE WHEN c.statut = 'validee' THEN 1 END)
      ELSE 0
    END,
    'produits_vendus', COALESCE(SUM(
      CASE 
        WHEN c.statut = 'validee' THEN (
          SELECT COALESCE(SUM(quantite), 0)
          FROM commande_items
          WHERE commande_id = c.id
        )
        ELSE 0
      END
    ), 0)
  )
  INTO v_kpis
  FROM commandes c
  WHERE (c.date_validation >= p_debut AND c.date_validation <= p_fin)
    OR (c.date_validation IS NULL AND c.created_at >= p_debut AND c.created_at <= p_fin);

  -- Calculer les ventes par produit pour la période
  SELECT json_agg(ventes)
  INTO v_ventes_produits
  FROM (
    SELECT json_build_object(
      'produit_id', p.id,
      'produit_nom', p.nom,
      'categorie', p.categorie,
      'quantite_vendue', COALESCE(SUM(ci.quantite), 0),
      'revenu_total', COALESCE(SUM(ci.montant_ligne), 0),
      'nombre_commandes', COUNT(DISTINCT c.id),
      'prix_moyen', CASE 
        WHEN SUM(ci.quantite) > 0 
        THEN SUM(ci.montant_ligne) / SUM(ci.quantite)
        ELSE 0
      END
    ) AS ventes
    FROM produits p
    LEFT JOIN commande_items ci ON ci.produit_id = p.id
    LEFT JOIN commandes c ON c.id = ci.commande_id 
      AND c.statut = 'validee'
      AND c.date_validation >= p_debut
      AND c.date_validation <= p_fin
    GROUP BY p.id, p.nom, p.categorie
  ) AS ventes_data;

  -- Calculer l'évolution selon la granularité
  IF p_granularite = 'heure' THEN
    SELECT json_agg(evolution ORDER BY periode)
    INTO v_evolution
    FROM (
      SELECT 
        DATE_TRUNC('hour', c.date_validation) AS periode,
        json_build_object(
          'periode', DATE_TRUNC('hour', c.date_validation),
          'chiffre_affaires', COALESCE(SUM(c.montant_total), 0),
          'nombre_commandes', COUNT(*),
          'panier_moyen', CASE 
            WHEN COUNT(*) > 0 
            THEN COALESCE(SUM(c.montant_total), 0) / COUNT(*)
            ELSE 0
          END
        ) AS evolution
      FROM commandes c
      WHERE c.statut = 'validee'
        AND c.date_validation >= p_debut
        AND c.date_validation <= p_fin
      GROUP BY DATE_TRUNC('hour', c.date_validation)
    ) AS evolution_data;
  ELSIF p_granularite = 'jour' THEN
    SELECT json_agg(evolution ORDER BY periode)
    INTO v_evolution
    FROM (
      SELECT 
        DATE(c.date_validation) AS periode,
        json_build_object(
          'periode', DATE(c.date_validation),
          'chiffre_affaires', COALESCE(SUM(c.montant_total), 0),
          'nombre_commandes', COUNT(*),
          'panier_moyen', CASE 
            WHEN COUNT(*) > 0 
            THEN COALESCE(SUM(c.montant_total), 0) / COUNT(*)
            ELSE 0
          END
        ) AS evolution
      FROM commandes c
      WHERE c.statut = 'validee'
        AND c.date_validation >= p_debut
        AND c.date_validation <= p_fin
      GROUP BY DATE(c.date_validation)
    ) AS evolution_data;
  ELSIF p_granularite = 'semaine' THEN
    SELECT json_agg(evolution ORDER BY periode)
    INTO v_evolution
    FROM (
      SELECT 
        DATE_TRUNC('week', c.date_validation) AS periode,
        json_build_object(
          'periode', DATE_TRUNC('week', c.date_validation),
          'chiffre_affaires', COALESCE(SUM(c.montant_total), 0),
          'nombre_commandes', COUNT(*),
          'panier_moyen', CASE 
            WHEN COUNT(*) > 0 
            THEN COALESCE(SUM(c.montant_total), 0) / COUNT(*)
            ELSE 0
          END
        ) AS evolution
      FROM commandes c
      WHERE c.statut = 'validee'
        AND c.date_validation >= p_debut
        AND c.date_validation <= p_fin
      GROUP BY DATE_TRUNC('week', c.date_validation)
    ) AS evolution_data;
  ELSE -- mois
    SELECT json_agg(evolution ORDER BY periode)
    INTO v_evolution
    FROM (
      SELECT 
        DATE_TRUNC('month', c.date_validation) AS periode,
        json_build_object(
          'periode', DATE_TRUNC('month', c.date_validation),
          'chiffre_affaires', COALESCE(SUM(c.montant_total), 0),
          'nombre_commandes', COUNT(*),
          'panier_moyen', CASE 
            WHEN COUNT(*) > 0 
            THEN COALESCE(SUM(c.montant_total), 0) / COUNT(*)
            ELSE 0
          END
        ) AS evolution
      FROM commandes c
      WHERE c.statut = 'validee'
        AND c.date_validation >= p_debut
        AND c.date_validation <= p_fin
      GROUP BY DATE_TRUNC('month', c.date_validation)
    ) AS evolution_data;
  END IF;

  -- Construire le résultat final
  v_result := json_build_object(
    'periode', json_build_object(
      'debut', p_debut,
      'fin', p_fin,
      'granularite', p_granularite
    ),
    'kpis', v_kpis,
    'ventes_produits', COALESCE(v_ventes_produits, '[]'::json),
    'evolution', COALESCE(v_evolution, '[]'::json)
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRANSACTION SEARCH FUNCTION
-- ============================================================================

-- Fonction: search_transactions
-- Description: Recherche de transactions avec filtres multiples et pagination
-- Parameters:
--   - p_date_debut: Date de début (optionnel)
--   - p_date_fin: Date de fin (optionnel)
--   - p_serveuse_id: ID de la serveuse (optionnel)
--   - p_table_id: ID de la table (optionnel)
--   - p_produit_id: ID du produit (optionnel)
--   - p_page: Numéro de page (défaut: 1)
--   - p_limit: Nombre de résultats par page (défaut: 50)
-- Returns: JSON avec les transactions et métadonnées de pagination
CREATE OR REPLACE FUNCTION search_transactions(
  p_date_debut TIMESTAMPTZ DEFAULT NULL,
  p_date_fin TIMESTAMPTZ DEFAULT NULL,
  p_serveuse_id UUID DEFAULT NULL,
  p_table_id UUID DEFAULT NULL,
  p_produit_id UUID DEFAULT NULL,
  p_page INTEGER DEFAULT 1,
  p_limit INTEGER DEFAULT 50
)
RETURNS JSON AS $$
DECLARE
  v_offset INTEGER;
  v_total INTEGER;
  v_transactions JSON;
  v_result JSON;
BEGIN
  -- Valider les paramètres
  IF p_page < 1 THEN
    RAISE EXCEPTION 'Le numéro de page doit être >= 1';
  END IF;
  
  IF p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION 'La limite doit être entre 1 et 100';
  END IF;

  -- Calculer l'offset
  v_offset := (p_page - 1) * p_limit;

  -- Compter le nombre total de résultats
  SELECT COUNT(DISTINCT c.id)
  INTO v_total
  FROM commandes c
  LEFT JOIN commande_items ci ON ci.commande_id = c.id
  WHERE c.statut = 'validee'
    AND (p_date_debut IS NULL OR c.date_validation >= p_date_debut)
    AND (p_date_fin IS NULL OR c.date_validation <= p_date_fin)
    AND (p_serveuse_id IS NULL OR c.serveuse_id = p_serveuse_id)
    AND (p_table_id IS NULL OR c.table_id = p_table_id)
    AND (p_produit_id IS NULL OR ci.produit_id = p_produit_id);

  -- Récupérer les transactions avec pagination
  SELECT json_agg(transaction_data)
  INTO v_transactions
  FROM (
    SELECT json_build_object(
      'id', c.id,
      'numero_commande', c.numero_commande,
      'table', json_build_object(
        'id', t.id,
        'numero', t.numero
      ),
      'serveuse', json_build_object(
        'id', s.id,
        'nom', s.nom,
        'prenom', s.prenom
      ),
      'validateur', json_build_object(
        'id', v.id,
        'nom', v.nom,
        'prenom', v.prenom
      ),
      'montant_total', c.montant_total,
      'created_at', c.created_at,
      'date_validation', c.date_validation,
      'items', (
        SELECT json_agg(json_build_object(
          'produit_id', ci.produit_id,
          'nom_produit', ci.nom_produit,
          'quantite', ci.quantite,
          'prix_unitaire', ci.prix_unitaire,
          'montant_ligne', ci.montant_ligne
        ))
        FROM commande_items ci
        WHERE ci.commande_id = c.id
      ),
      'facture', (
        SELECT json_build_object(
          'id', f.id,
          'numero_facture', f.numero_facture,
          'statut', f.statut,
          'montant_paye', f.montant_paye,
          'montant_restant', f.montant_restant
        )
        FROM factures f
        WHERE f.commande_id = c.id
      )
    ) AS transaction_data
    FROM commandes c
    INNER JOIN tables t ON t.id = c.table_id
    INNER JOIN profiles s ON s.id = c.serveuse_id
    LEFT JOIN profiles v ON v.id = c.validateur_id
    LEFT JOIN commande_items ci ON ci.commande_id = c.id
    WHERE c.statut = 'validee'
      AND (p_date_debut IS NULL OR c.date_validation >= p_date_debut)
      AND (p_date_fin IS NULL OR c.date_validation <= p_date_fin)
      AND (p_serveuse_id IS NULL OR c.serveuse_id = p_serveuse_id)
      AND (p_table_id IS NULL OR c.table_id = p_table_id)
      AND (p_produit_id IS NULL OR ci.produit_id = p_produit_id)
    GROUP BY c.id, t.id, t.numero, s.id, s.nom, s.prenom, v.id, v.nom, v.prenom
    ORDER BY c.date_validation DESC
    LIMIT p_limit
    OFFSET v_offset
  ) AS transactions;

  -- Construire le résultat avec métadonnées de pagination
  v_result := json_build_object(
    'transactions', COALESCE(v_transactions, '[]'::json),
    'pagination', json_build_object(
      'page', p_page,
      'limit', p_limit,
      'total', v_total,
      'total_pages', CEIL(v_total::NUMERIC / p_limit)
    ),
    'filters', json_build_object(
      'date_debut', p_date_debut,
      'date_fin', p_date_fin,
      'serveuse_id', p_serveuse_id,
      'table_id', p_table_id,
      'produit_id', p_produit_id
    )
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON VIEW analytics_kpis IS 'Vue des KPIs principaux: CA, bénéfice, nombre commandes, panier moyen';
COMMENT ON VIEW analytics_ventes_produits IS 'Vue des ventes agrégées par produit';
COMMENT ON VIEW analytics_evolution_ca IS 'Vue de l''évolution temporelle du CA par jour';
COMMENT ON FUNCTION get_analytics IS 'Fonction pour récupérer toutes les analytics pour une période avec granularité configurable';
COMMENT ON FUNCTION search_transactions IS 'Fonction de recherche de transactions avec filtres multiples et pagination';


-- Source: 20240126000000_storage_exports_bucket.sql
-- ============================================================================
-- Migration: Storage Exports Bucket Configuration
-- Description: Creates storage bucket for exports with RLS policies
-- Requirements: 11.1, 11.2, 11.3
-- ============================================================================

-- Create the exports bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'exports',
  'exports',
  false, -- Private bucket
  52428800, -- 50 MB in bytes
  ARRAY['text/csv', 'application/pdf', 'application/vnd.ms-excel']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['text/csv', 'application/pdf', 'application/vnd.ms-excel'];

-- ============================================================================
-- RLS Policies for Storage Bucket
-- ============================================================================

-- Note: RLS is already enabled on storage.objects by Supabase

-- Drop existing policies if they exist (for idempotency)

-- Policy: Only patron/gerant can upload files to exports bucket

-- Policy: Only patron/gerant can read files from exports bucket

-- Policy: Only patron/gerant can update files in exports bucket

-- Policy: Only patron/gerant can delete files from exports bucket

-- ============================================================================
-- Automatic Cleanup Function (30 days retention)
-- ============================================================================

-- Function to delete old export files
CREATE OR REPLACE FUNCTION cleanup_old_exports()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM storage.objects
  WHERE bucket_id = 'exports'
  AND created_at < NOW() - INTERVAL '30 days';
END;
$$;

-- Note: The cleanup function should be called periodically via a cron job
-- or scheduled task. In Supabase, this can be done using pg_cron extension
-- or via an Edge Function triggered by a scheduled webhook.

COMMENT ON FUNCTION cleanup_old_exports() IS 'Deletes export files older than 30 days from the exports bucket';


-- ============================================================================
-- Automatic Cleanup Function (30 days retention)
-- ============================================================================

-- Function to delete old export files
CREATE OR REPLACE FUNCTION cleanup_old_exports()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM storage.objects
  WHERE bucket_id = 'exports'
  AND created_at < NOW() - INTERVAL '30 days';
END;
$$;

COMMENT ON FUNCTION cleanup_old_exports() IS 'Deletes export files older than 30 days from the exports bucket';

-- Note: The cleanup function should be called periodically via a cron job
-- or scheduled task. In Supabase, this can be done using pg_cron extension
-- or via an Edge Function triggered by a scheduled webhook.


-- Source: 20240127000000_enable_realtime.sql
-- ============================================================================
-- Migration: Enable Realtime on Critical Tables
-- Description: Configures Realtime publications for real-time synchronization
-- Requirements: 6.1, 6.2, 6.3, 1.2, 2.5
-- ============================================================================

-- Note: Supabase Realtime uses PostgreSQL's logical replication feature.
-- By default, Supabase creates a publication called "supabase_realtime" that
-- includes all tables. We need to ensure our critical tables are included.

-- ============================================================================
-- Enable Realtime for Critical Tables
-- ============================================================================

-- The following tables need real-time synchronization:
-- 1. commandes - For order creation and validation notifications
-- 2. stock - For inventory updates
-- 3. factures - For invoice generation notifications
-- 4. encaissements - For payment notifications
-- 5. tables - For table status updates
-- 6. ravitaillements - For supply notifications

-- Check if publication exists, if not create it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

-- Add tables to the publication
-- Note: In Supabase, you typically enable Realtime via the Dashboard,
-- but this ensures the publication includes our tables

DO $$
DECLARE
  t text;
  tables text[] := ARRAY['commandes', 'stock', 'factures', 'encaissements', 'tables', 'ravitaillements', 'commande_items', 'ravitaillement_items', 'mouvements_stock'];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
      AND tablename = t
    ) THEN
      BEGIN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not add table % to publication: %', t, SQLERRM;
      END;
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- Configure Replica Identity for Realtime
-- ============================================================================

-- Set REPLICA IDENTITY to FULL for tables that need complete row data in updates
-- This allows Realtime to send the full row data (old and new values) on UPDATE

ALTER TABLE commandes REPLICA IDENTITY FULL;
ALTER TABLE stock REPLICA IDENTITY FULL;
ALTER TABLE factures REPLICA IDENTITY FULL;
ALTER TABLE encaissements REPLICA IDENTITY FULL;
ALTER TABLE tables REPLICA IDENTITY FULL;
ALTER TABLE ravitaillements REPLICA IDENTITY FULL;
ALTER TABLE commande_items REPLICA IDENTITY FULL;
ALTER TABLE ravitaillement_items REPLICA IDENTITY FULL;
ALTER TABLE mouvements_stock REPLICA IDENTITY FULL;

-- ============================================================================
-- Comments and Documentation
-- ============================================================================

-- COMMENT ON PUBLICATION supabase_realtime IS 'Publication for Supabase Realtime synchronization of critical tables';

-- ============================================================================
-- Verification Query
-- ============================================================================

-- To verify which tables are in the publication, run:
-- SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

-- To verify replica identity settings, run:
-- SELECT schemaname, tablename, relreplident 
-- FROM pg_class c 
-- JOIN pg_namespace n ON n.oid = c.relnamespace 
-- WHERE relkind = 'r' AND nspname = 'public';
-- (relreplident: 'd' = default, 'f' = full, 'i' = index, 'n' = nothing)


-- Source: 20240128000000_create_etablissements.sql
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

-- Add comment to table
COMMENT ON TABLE etablissements IS 'Stores establishment (client) information for multi-tenant SaaS platform';
COMMENT ON COLUMN etablissements.statut_abonnement IS 'Subscription status: actif, expire, or suspendu';
COMMENT ON COLUMN etablissements.date_debut IS 'Subscription start date';
COMMENT ON COLUMN etablissements.date_fin IS 'Subscription end date (automatically set to 12 months from start)';
COMMENT ON COLUMN etablissements.actif IS 'Whether the establishment is active and can access the system';
COMMENT ON COLUMN etablissements.dernier_paiement_date IS 'Date of last payment confirmation';
COMMENT ON COLUMN etablissements.dernier_paiement_confirme_par IS 'Admin user who confirmed the last payment';


-- Source: 20240128000001_add_etablissement_id.sql
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


-- Source: 20240128000002_admin_role_support.sql
-- Migration: Add admin role support to profiles table
-- This migration modifies the profiles table to support admin users who can manage all establishments

-- Drop existing role CHECK constraint
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Add new role CHECK constraint including 'admin'
ALTER TABLE profiles
ADD CONSTRAINT profiles_role_check CHECK (role IN ('serveuse', 'comptoir', 'gerant', 'patron', 'admin'));

-- Add CHECK constraint: admin users must have NULL etablissement_id, others must have non-NULL
-- Note: This constraint will be enforced after data migration
-- For now, we create it as NOT VALID to allow migration
ALTER TABLE profiles
ADD CONSTRAINT profiles_admin_etablissement_check 
CHECK (
  (role = 'admin' AND etablissement_id IS NULL) OR
  (role != 'admin' AND etablissement_id IS NOT NULL)
) NOT VALID;

-- The constraint will be validated after data migration in 20240128000003_migrate_existing_data.sql

COMMENT ON CONSTRAINT profiles_admin_etablissement_check ON profiles IS 
'Ensures admin users have NULL etablissement_id and non-admin users have non-NULL etablissement_id';


-- Source: 20240128000004_subscription_functions.sql
-- Migration: Subscription Management Functions
-- Description: Functions for payment confirmation, suspension, and reactivation
-- Requirements: 3.4, 3.5, 3.6, 12.3, 12.4, 12.5

-- Function: Confirm payment and extend subscription by 12 months
CREATE OR REPLACE FUNCTION public.confirm_payment_and_extend_subscription(
  p_etablissement_id UUID,
  p_admin_user_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_current_date_fin TIMESTAMPTZ;
  v_new_date_fin TIMESTAMPTZ;
BEGIN
  -- Verify caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = p_admin_user_id 
    AND role = 'admin'
    AND actif = true
  ) THEN
    RAISE EXCEPTION 'Only active admin users can confirm payments';
  END IF;
  
  -- Verify establishment exists
  IF NOT EXISTS (
    SELECT 1 FROM public.etablissements
    WHERE id = p_etablissement_id
  ) THEN
    RAISE EXCEPTION 'Establishment not found';
  END IF;
  
  -- Get current end date
  SELECT date_fin INTO v_current_date_fin
  FROM public.etablissements
  WHERE id = p_etablissement_id;
  
  -- Calculate new end date: extend by 12 months from current end date
  v_new_date_fin := v_current_date_fin + INTERVAL '12 months';
  
  -- Update establishment: extend subscription, reactivate if needed
  UPDATE public.etablissements
  SET 
    date_fin = v_new_date_fin,
    statut_abonnement = 'actif',
    actif = true,
    dernier_paiement_date = NOW(),
    dernier_paiement_confirme_par = p_admin_user_id,
    date_modification = NOW()
  WHERE id = p_etablissement_id;
  
  -- Log the payment confirmation action
  INSERT INTO public.audit_logs (
    user_id, 
    action, 
    table_name, 
    record_id, 
    details,
    etablissement_id
  )
  VALUES (
    p_admin_user_id,
    'PAYMENT_CONFIRMED',
    'etablissements',
    p_etablissement_id,
    jsonb_build_object(
      'previous_date_fin', v_current_date_fin,
      'new_date_fin', v_new_date_fin,
      'payment_date', NOW()
    ),
    p_etablissement_id
  );
END;
$$;

COMMENT ON FUNCTION public.confirm_payment_and_extend_subscription IS 
'Admin function to confirm manual payment and extend establishment subscription by 12 months';

-- Function: Suspend establishment
CREATE OR REPLACE FUNCTION public.suspend_etablissement(
  p_etablissement_id UUID,
  p_admin_user_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Verify caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = p_admin_user_id 
    AND role = 'admin'
    AND actif = true
  ) THEN
    RAISE EXCEPTION 'Only active admin users can suspend establishments';
  END IF;
  
  -- Verify establishment exists
  IF NOT EXISTS (
    SELECT 1 FROM public.etablissements
    WHERE id = p_etablissement_id
  ) THEN
    RAISE EXCEPTION 'Establishment not found';
  END IF;
  
  -- Update establishment status to suspended
  UPDATE public.etablissements
  SET 
    statut_abonnement = 'suspendu',
    actif = false,
    date_modification = NOW()
  WHERE id = p_etablissement_id;
  
  -- Log the suspension action
  INSERT INTO public.audit_logs (
    user_id, 
    action, 
    table_name, 
    record_id, 
    details,
    etablissement_id
  )
  VALUES (
    p_admin_user_id,
    'ESTABLISHMENT_SUSPENDED',
    'etablissements',
    p_etablissement_id,
    jsonb_build_object(
      'reason', COALESCE(p_reason, 'No reason provided'),
      'suspended_at', NOW()
    ),
    p_etablissement_id
  );
END;
$$;

COMMENT ON FUNCTION public.suspend_etablissement IS 
'Admin function to suspend an establishment and prevent user access';

-- Function: Reactivate establishment
CREATE OR REPLACE FUNCTION public.reactivate_etablissement(
  p_etablissement_id UUID,
  p_admin_user_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_date_fin TIMESTAMPTZ;
BEGIN
  -- Verify caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = p_admin_user_id 
    AND role = 'admin'
    AND actif = true
  ) THEN
    RAISE EXCEPTION 'Only active admin users can reactivate establishments';
  END IF;
  
  -- Verify establishment exists and get date_fin
  SELECT date_fin INTO v_date_fin
  FROM public.etablissements
  WHERE id = p_etablissement_id;
  
  IF v_date_fin IS NULL THEN
    RAISE EXCEPTION 'Establishment not found';
  END IF;
  
  -- Check if subscription has expired
  IF v_date_fin < NOW() THEN
    RAISE EXCEPTION 'Cannot reactivate expired establishment. Please confirm payment first to extend subscription.';
  END IF;
  
  -- Update establishment status to active
  UPDATE public.etablissements
  SET 
    statut_abonnement = 'actif',
    actif = true,
    date_modification = NOW()
  WHERE id = p_etablissement_id;
  
  -- Log the reactivation action
  INSERT INTO public.audit_logs (
    user_id, 
    action, 
    table_name, 
    record_id, 
    details,
    etablissement_id
  )
  VALUES (
    p_admin_user_id,
    'ESTABLISHMENT_REACTIVATED',
    'etablissements',
    p_etablissement_id,
    jsonb_build_object(
      'reactivated_at', NOW(),
      'date_fin', v_date_fin
    ),
    p_etablissement_id
  );
END;
$$;

COMMENT ON FUNCTION public.reactivate_etablissement IS 
'Admin function to reactivate a suspended establishment (only if subscription has not expired)';


-- Source: 20240128000007_configure_expiration_cron.sql
-- Migration: Configure Expiration Cron Job
-- Description: Documentation for setting up automatic subscription expiration
-- 
-- IMPORTANT: pg_cron is NOT available on Supabase hosted projects.
-- This migration provides documentation for configuring an external cron service.
--
-- Requirements: 4.1, 4.6, 13.2

-- ============================================================================
-- EXTERNAL CRON CONFIGURATION (RECOMMENDED FOR SUPABASE HOSTED)
-- ============================================================================

-- Since pg_cron is not available on Supabase hosted, use an external service:
-- 
-- Option 1: cron-job.org (Free tier available)
-- Option 2: GitHub Actions (Free for public repos)
-- Option 3: Any other HTTP cron service
--
-- Configuration Steps:
--
-- 1. Set the EXPIRATION_SECRET_KEY environment variable in Supabase:
--    - Go to Project Settings > Edge Functions
--    - Add secret: EXPIRATION_SECRET_KEY=<generate-a-strong-random-key>
--
-- 2. Configure external cron service to call the Edge Function:
--    URL: https://wgzbpgauajgxkxoezlqw.supabase.co/functions/v1/expire-subscriptions
--    Method: POST
--    Headers:
--      - Authorization: Bearer <EXPIRATION_SECRET_KEY>
--      - Content-Type: application/json
--    Schedule: Daily at 01:00 UTC (0 1 * * *)
--
-- 3. Test the cron job manually first:
--    curl -X POST \
--      https://wgzbpgauajgxkxoezlqw.supabase.co/functions/v1/expire-subscriptions \
--      -H "Authorization: Bearer <EXPIRATION_SECRET_KEY>" \
--      -H "Content-Type: application/json"

-- ============================================================================
-- EXAMPLE: GITHUB ACTIONS WORKFLOW
-- ============================================================================

-- Create .github/workflows/expire-subscriptions.yml:
--
-- name: Expire Subscriptions
-- 
-- on:
--   schedule:
--     - cron: '0 1 * * *'  # Daily at 01:00 UTC
--   workflow_dispatch:  # Allow manual trigger
-- 
-- jobs:
--   expire-subscriptions:
--     runs-on: ubuntu-latest
--     steps:
--       - name: Call Expiration Function
--         run: |
--           curl -X POST \
--             https://wgzbpgauajgxkxoezlqw.supabase.co/functions/v1/expire-subscriptions \
--             -H "Authorization: Bearer ${{ secrets.EXPIRATION_SECRET_KEY }}" \
--             -H "Content-Type: application/json" \
--             -f || exit 1
--
-- Then add EXPIRATION_SECRET_KEY to GitHub repository secrets.

-- ============================================================================
-- EXAMPLE: CRON-JOB.ORG CONFIGURATION
-- ============================================================================

-- 1. Create account at https://cron-job.org
-- 2. Create new cron job with:
--    - Title: Expire Subscriptions
--    - URL: https://wgzbpgauajgxkxoezlqw.supabase.co/functions/v1/expire-subscriptions
--    - Schedule: Every day at 01:00 UTC
--    - Request Method: POST
--    - Custom Headers:
--      * Authorization: Bearer <EXPIRATION_SECRET_KEY>
--      * Content-Type: application/json
--    - Notifications: Enable email on failure

-- ============================================================================
-- MONITORING AND ALERTS
-- ============================================================================

-- Monitor expiration execution via audit_logs:
-- 
-- SELECT 
--   date_creation,
--   action,
--   details->>'nom' as etablissement_nom,
--   details->>'date_fin' as date_fin
-- FROM audit_logs
-- WHERE action IN ('SUBSCRIPTION_EXPIRED', 'EXPIRATION_ERROR')
-- ORDER BY date_creation DESC
-- LIMIT 50;

-- Check for establishments that should have expired but didn't:
--
-- SELECT 
--   id,
--   nom,
--   date_fin,
--   statut_abonnement,
--   actif
-- FROM etablissements
-- WHERE date_fin < NOW()
--   AND statut_abonnement = 'actif'
-- ORDER BY date_fin;

-- ============================================================================
-- ALTERNATIVE: PG_CRON (ONLY FOR SELF-HOSTED SUPABASE)
-- ============================================================================

-- If you are using a self-hosted Supabase instance with pg_cron enabled,
-- you can use the following SQL to schedule the cron job:
--
-- -- Enable pg_cron extension
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
--
-- -- Schedule daily expiration check at 01:00 UTC
-- SELECT cron.schedule(
--   'expire-subscriptions-daily',
--   '0 1 * * *',
--   $$
--   SELECT net.http_post(
--     url := 'https://wgzbpgauajgxkxoezlqw.supabase.co/functions/v1/expire-subscriptions',
--     headers := jsonb_build_object(
--       'Authorization', 'Bearer ' || current_setting('app.settings.expiration_secret_key'),
--       'Content-Type', 'application/json'
--     )
--   );
--   $$
-- );
--
-- -- View scheduled jobs
-- SELECT * FROM cron.job;
--
-- -- Unschedule if needed
-- -- SELECT cron.unschedule('expire-subscriptions-daily');

-- ============================================================================
-- DEPLOYMENT CHECKLIST
-- ============================================================================

-- [ ] 1. Generate strong random secret key for EXPIRATION_SECRET_KEY
-- [ ] 2. Add EXPIRATION_SECRET_KEY to Supabase Edge Functions secrets
-- [ ] 3. Deploy expire-subscriptions Edge Function (already done)
-- [ ] 4. Test Edge Function manually with curl
-- [ ] 5. Configure external cron service (cron-job.org or GitHub Actions)
-- [ ] 6. Test cron job execution
-- [ ] 7. Set up monitoring/alerts for failures
-- [ ] 8. Document cron configuration in project README

-- This migration is idempotent (no actual database changes)
-- It serves as documentation for the cron configuration process


-- Source: 20240128000008_multi_tenant_audit_logging.sql
-- Migration: Multi-Tenant Audit Logging Enhancements
-- Description: Enhance audit logging to properly track multi-tenant operations
-- Requirements: 6.5, 10.1, 10.2, 10.3, 10.4, 10.6, 10.7

-- ============================================================================
-- HELPER FUNCTION: GET CURRENT USER'S ETABLISSEMENT_ID
-- ============================================================================

CREATE OR REPLACE FUNCTION get_current_user_etablissement_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT etablissement_id 
    FROM profiles 
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION get_current_user_etablissement_id() IS 
'Returns the etablissement_id of the currently authenticated user. Returns NULL for admin users.';

-- ============================================================================
-- HELPER FUNCTION: CHECK IF CURRENT USER IS ADMIN
-- ============================================================================

CREATE OR REPLACE FUNCTION is_current_user_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION is_current_user_admin() IS 
'Returns true if the currently authenticated user has the admin role.';

-- ============================================================================
-- AUDIT LOGGING FUNCTION WITH MULTI-TENANCY SUPPORT
-- ============================================================================

CREATE OR REPLACE FUNCTION log_audit_action(
  p_action TEXT,
  p_entite TEXT,
  p_entite_id UUID,
  p_details JSONB DEFAULT NULL,
  p_etablissement_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_etablissement_id UUID;
  v_utilisateur_id UUID;
BEGIN
  -- Get current user ID
  v_utilisateur_id := auth.uid();
  
  -- Determine etablissement_id
  IF p_etablissement_id IS NOT NULL THEN
    -- Use provided etablissement_id (for admin actions on specific establishments)
    v_etablissement_id := p_etablissement_id;
  ELSIF v_utilisateur_id IS NOT NULL THEN
    -- Get from user's profile (for regular user actions)
    v_etablissement_id := get_current_user_etablissement_id();
  ELSE
    -- System action (no user), use NULL
    v_etablissement_id := NULL;
  END IF;
  
  -- Insert audit log entry
  INSERT INTO audit_logs (
    utilisateur_id,
    action,
    entite,
    entite_id,
    etablissement_id,
    details_apres
  ) VALUES (
    v_utilisateur_id,
    p_action,
    p_entite,
    p_entite_id::TEXT,
    v_etablissement_id,
    p_details
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION log_audit_action IS 
'Logs an audit action with proper multi-tenancy support. Automatically determines etablissement_id from user context or accepts explicit value for admin actions.';

-- ============================================================================
-- UPDATE SUBSCRIPTION MANAGEMENT FUNCTIONS TO LOG PROPERLY
-- ============================================================================

-- Drop existing functions to allow parameter changes
DROP FUNCTION IF EXISTS confirm_payment_and_extend_subscription(UUID, UUID);
DROP FUNCTION IF EXISTS suspend_etablissement(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS reactivate_etablissement(UUID, UUID);

-- Update confirm_payment_and_extend_subscription to use new logging
CREATE OR REPLACE FUNCTION confirm_payment_and_extend_subscription(
  p_etablissement_id UUID,
  p_admin_utilisateur_id UUID
)
RETURNS void AS $$
DECLARE
  v_current_date_fin TIMESTAMPTZ;
  v_new_date_fin TIMESTAMPTZ;
BEGIN
  -- Verify caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = p_admin_utilisateur_id 
    AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can confirm payments';
  END IF;
  
  -- Get current end date
  SELECT date_fin INTO v_current_date_fin
  FROM etablissements
  WHERE id = p_etablissement_id;
  
  IF v_current_date_fin IS NULL THEN
    RAISE EXCEPTION 'Establishment not found';
  END IF;
  
  -- Calculate new end date (extend by 12 months from current end date)
  v_new_date_fin := v_current_date_fin + INTERVAL '12 months';
  
  -- Update establishment
  UPDATE etablissements
  SET 
    date_fin = v_new_date_fin,
    statut_abonnement = 'actif',
    actif = true,
    dernier_paiement_date = NOW(),
    dernier_paiement_confirme_par = p_admin_utilisateur_id,
    date_modification = NOW()
  WHERE id = p_etablissement_id;
  
  -- Log the action using new logging function
  PERFORM log_audit_action(
    'PAYMENT_CONFIRMED',
    'etablissements',
    p_etablissement_id,
    jsonb_build_object(
      'previous_date_fin', v_current_date_fin,
      'new_date_fin', v_new_date_fin,
      'payment_date', NOW(),
      'admin_utilisateur_id', p_admin_utilisateur_id
    ),
    p_etablissement_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update suspend_etablissement to use new logging
CREATE OR REPLACE FUNCTION suspend_etablissement(
  p_etablissement_id UUID,
  p_admin_utilisateur_id UUID,
  p_reason TEXT
)
RETURNS void AS $$
BEGIN
  -- Verify caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = p_admin_utilisateur_id 
    AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can suspend establishments';
  END IF;
  
  -- Update establishment
  UPDATE etablissements
  SET 
    statut_abonnement = 'suspendu',
    actif = false,
    date_modification = NOW()
  WHERE id = p_etablissement_id;
  
  -- Log the action using new logging function
  PERFORM log_audit_action(
    'ESTABLISHMENT_SUSPENDED',
    'etablissements',
    p_etablissement_id,
    jsonb_build_object(
      'reason', p_reason,
      'admin_utilisateur_id', p_admin_utilisateur_id,
      'suspended_at', NOW()
    ),
    p_etablissement_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update reactivate_etablissement to use new logging
CREATE OR REPLACE FUNCTION reactivate_etablissement(
  p_etablissement_id UUID,
  p_admin_utilisateur_id UUID
)
RETURNS void AS $$
BEGIN
  -- Verify caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = p_admin_utilisateur_id 
    AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can reactivate establishments';
  END IF;
  
  -- Update establishment
  UPDATE etablissements
  SET 
    statut_abonnement = 'actif',
    actif = true,
    date_modification = NOW()
  WHERE id = p_etablissement_id;
  
  -- Log the action using new logging function
  PERFORM log_audit_action(
    'ESTABLISHMENT_REACTIVATED',
    'etablissements',
    p_etablissement_id,
    jsonb_build_object(
      'admin_utilisateur_id', p_admin_utilisateur_id,
      'reactivated_at', NOW()
    ),
    p_etablissement_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGER: AUTO-LOG ESTABLISHMENT CREATION
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_log_etablissement_creation()
RETURNS TRIGGER AS $$
BEGIN
  -- Log establishment creation
  PERFORM log_audit_action(
    'ESTABLISHMENT_CREATED',
    'etablissements',
    NEW.id,
    jsonb_build_object(
      'nom', NEW.nom,
      'date_debut', NEW.date_debut,
      'date_fin', NEW.date_fin,
      'statut_abonnement', NEW.statut_abonnement
    ),
    NEW.id
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_log_etablissement_creation ON etablissements;
CREATE TRIGGER trigger_log_etablissement_creation
  AFTER INSERT ON etablissements
  FOR EACH ROW
  EXECUTE FUNCTION trigger_log_etablissement_creation();

-- ============================================================================
-- VIEW: ADMIN ACTIONS LOG
-- ============================================================================

CREATE OR REPLACE VIEW admin_actions_log AS
SELECT 
  al.id,
  al.date_creation,
  al.action,
  al.entite,
  al.entite_id,
  al.etablissement_id,
  al.details_apres,
  au.email as admin_email,
  p.nom as admin_nom,
  p.prenom as admin_prenom,
  e.nom as etablissement_nom
FROM audit_logs al
LEFT JOIN profiles p ON al.utilisateur_id = p.id
LEFT JOIN auth.users au ON p.id = au.id
LEFT JOIN etablissements e ON al.etablissement_id = e.id
WHERE p.role = 'admin' OR al.utilisateur_id IS NULL
ORDER BY al.date_creation DESC;

COMMENT ON VIEW admin_actions_log IS 
'View of all admin actions and system actions for monitoring and auditing purposes.';

-- ============================================================================
-- VIEW: SYSTEM ACTIONS LOG
-- ============================================================================

CREATE OR REPLACE VIEW system_actions_log AS
SELECT 
  al.id,
  al.date_creation,
  al.action,
  al.entite,
  al.entite_id,
  al.etablissement_id,
  al.details_apres,
  e.nom as etablissement_nom
FROM audit_logs al
LEFT JOIN etablissements e ON al.etablissement_id = e.id
WHERE al.utilisateur_id IS NULL
ORDER BY al.date_creation DESC;

COMMENT ON VIEW system_actions_log IS 
'View of all system-initiated actions (no utilisateur_id) such as automatic subscription expirations.';

-- ============================================================================
-- VIEW: ESTABLISHMENT AUDIT LOG
-- ============================================================================

CREATE OR REPLACE VIEW establishment_audit_log AS
SELECT 
  al.id,
  al.date_creation,
  al.action,
  al.entite,
  al.entite_id,
  al.etablissement_id,
  al.details_apres,
  al.utilisateur_id,
  au.email as user_email,
  p.nom as user_nom,
  p.prenom as user_prenom,
  p.role as user_role,
  e.nom as etablissement_nom,
  CASE 
    WHEN al.utilisateur_id IS NULL THEN 'SYSTEM'
    WHEN p.role = 'admin' THEN 'ADMIN'
    ELSE 'USER'
  END as actor_type
FROM audit_logs al
LEFT JOIN profiles p ON al.utilisateur_id = p.id
LEFT JOIN auth.users au ON p.id = au.id
LEFT JOIN etablissements e ON al.etablissement_id = e.id
ORDER BY al.date_creation DESC;

COMMENT ON VIEW establishment_audit_log IS 
'Comprehensive audit log view with actor type distinction (SYSTEM, ADMIN, USER) for all establishment-related actions.';

-- ============================================================================
-- RLS POLICIES FOR AUDIT LOG VIEWS
-- ============================================================================

-- Admin actions log: Only admins can view
ALTER VIEW admin_actions_log SET (security_invoker = on);

-- System actions log: Only admins can view
ALTER VIEW system_actions_log SET (security_invoker = on);

-- Establishment audit log: Users see their establishment, admins see all
ALTER VIEW establishment_audit_log SET (security_invoker = on);

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant access to helper functions
GRANT EXECUTE ON FUNCTION get_current_user_etablissement_id() TO authenticated;
GRANT EXECUTE ON FUNCTION is_current_user_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION log_audit_action TO authenticated;

-- Grant access to views
GRANT SELECT ON admin_actions_log TO authenticated;
GRANT SELECT ON system_actions_log TO authenticated;
GRANT SELECT ON establishment_audit_log TO authenticated;


-- Source: 20260208000000_dashboard_rpc_updates.sql
-- Migration: Dashboard RPC Updates
-- Description: Adds missing RPC functions and ensures parameter consistency for Dashboard
-- Date: 2026-02-08

-- ============================================================================
-- FUNCTION: get_analytics_ca_encaissements
-- Description: Returns daily CA vs Encaissements for a given period
-- ============================================================================

CREATE OR REPLACE FUNCTION get_analytics_ca_encaissements(
  p_debut TIMESTAMPTZ,
  p_fin TIMESTAMPTZ
)
RETURNS TABLE (
  date DATE,
  chiffre_affaires BIGINT,
  encaissements BIGINT,
  nombre_commandes BIGINT,
  nombre_factures BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    v.date,
    v.chiffre_affaires,
    v.encaissements,
    v.nombre_commandes,
    v.nombre_factures
  FROM analytics_ca_encaissements v
  WHERE v.date >= p_debut::DATE
    AND v.date <= p_fin::DATE
  ORDER BY v.date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_analytics_ca_encaissements(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- ============================================================================
-- FUNCTION: get_dashboard_kpis (Unified version of get_kpis)
-- Description: Returns KPIs for the dashboard as a single JSON object
-- ============================================================================

CREATE OR REPLACE FUNCTION get_dashboard_kpis(
  p_debut TIMESTAMPTZ,
  p_fin TIMESTAMPTZ
)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'chiffre_affaires', chiffre_affaires,
    'encaissements', encaissements,
    'creances', creances,
    'benefice', benefice,
    'commandes_count', nombre_commandes,
    'panier_moyen', panier_moyen,
    'factures_impayees', nombre_factures_impayees,
    'taux_encaissement', taux_encaissement
  )
  INTO v_result
  FROM get_kpis(p_debut, p_fin);
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_dashboard_kpis(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- ============================================================================
-- FUNCTION: get_payment_modes_stats
-- Description: Returns encaissements grouped by payment mode for a given period
-- ============================================================================

CREATE OR REPLACE FUNCTION get_payment_modes_stats(
  p_debut TIMESTAMPTZ,
  p_fin TIMESTAMPTZ
)
RETURNS TABLE (
  mode_paiement TEXT,
  montant_total BIGINT,
  nombre_transactions BIGINT,
  pourcentage_total NUMERIC
) AS $$
DECLARE
  v_total_periode BIGINT;
BEGIN
  -- Get total encaissements for the period to calculate percentages
  SELECT COALESCE(SUM(montant), 0) INTO v_total_periode
  FROM encaissements
  WHERE date_encaissement >= p_debut AND date_encaissement <= p_fin;

  RETURN QUERY
  SELECT 
    e.mode_paiement,
    SUM(e.montant)::BIGINT as montant_total,
    COUNT(*)::BIGINT as nombre_transactions,
    CASE 
      WHEN v_total_periode > 0 THEN ROUND((SUM(e.montant)::NUMERIC / v_total_periode) * 100, 2)
      ELSE 0
    END as pourcentage_total
  FROM encaissements e
  WHERE e.date_encaissement >= p_debut AND e.date_encaissement <= p_fin
  GROUP BY e.mode_paiement
  ORDER BY montant_total DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_payment_modes_stats(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- Grant missing permissions for existing analytics functions
GRANT EXECUTE ON FUNCTION get_analytics(TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION search_transactions(TIMESTAMPTZ, TIMESTAMPTZ, UUID, UUID, UUID, INTEGER, INTEGER) TO authenticated;

COMMENT ON FUNCTION get_analytics_ca_encaissements IS 'Returns daily CA and Encaissements data for chart visualization within a date range.';
COMMENT ON FUNCTION get_dashboard_kpis IS 'Returns a single JSON object containing all dashboard KPIs for a given period.';
COMMENT ON FUNCTION get_payment_modes_stats IS 'Returns payment mode statistics for a given period.';


