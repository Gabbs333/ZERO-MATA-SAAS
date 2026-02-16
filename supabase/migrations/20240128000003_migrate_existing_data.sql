-- Migration: Migrate existing single-tenant data to multi-tenant structure
-- Description: Creates default establishment and assigns all existing records to it
-- Requirements: 7.1, 7.2, 7.3, 7.4, 7.6

-- This migration is idempotent and can be run multiple times safely

DO $$
DECLARE
  v_default_etablissement_id UUID;
  v_record_count INTEGER;
BEGIN
  -- Check if default establishment already exists
  SELECT id INTO v_default_etablissement_id
  FROM etablissements
  WHERE nom = 'Établissement Principal'
  LIMIT 1;
  
  -- Create default establishment if it doesn't exist
  IF v_default_etablissement_id IS NULL THEN
    INSERT INTO etablissements (
      nom,
      statut_abonnement,
      date_debut,
      date_fin,
      actif
    )
    VALUES (
      'Établissement Principal',
      'actif',
      NOW(),
      NOW() + INTERVAL '12 months',
      true
    )
    RETURNING id INTO v_default_etablissement_id;
    
    RAISE NOTICE 'Created default establishment with ID: %', v_default_etablissement_id;
  ELSE
    RAISE NOTICE 'Default establishment already exists with ID: %', v_default_etablissement_id;
  END IF;
  
  -- Migrate profiles table (excluding admin users who should have NULL etablissement_id)
  UPDATE profiles
  SET etablissement_id = v_default_etablissement_id
  WHERE etablissement_id IS NULL
    AND role != 'admin';
  
  GET DIAGNOSTICS v_record_count = ROW_COUNT;
  RAISE NOTICE 'Updated % profiles with default establishment', v_record_count;
  
  -- Migrate produits table
  UPDATE produits
  SET etablissement_id = v_default_etablissement_id
  WHERE etablissement_id IS NULL;
  
  GET DIAGNOSTICS v_record_count = ROW_COUNT;
  RAISE NOTICE 'Updated % produits with default establishment', v_record_count;
  
  -- Migrate stock table
  UPDATE stock
  SET etablissement_id = v_default_etablissement_id
  WHERE etablissement_id IS NULL;
  
  GET DIAGNOSTICS v_record_count = ROW_COUNT;
  RAISE NOTICE 'Updated % stock records with default establishment', v_record_count;
  
  -- Migrate mouvements_stock table
  UPDATE mouvements_stock
  SET etablissement_id = v_default_etablissement_id
  WHERE etablissement_id IS NULL;
  
  GET DIAGNOSTICS v_record_count = ROW_COUNT;
  RAISE NOTICE 'Updated % mouvements_stock with default establishment', v_record_count;
  
  -- Migrate tables table
  UPDATE tables
  SET etablissement_id = v_default_etablissement_id
  WHERE etablissement_id IS NULL;
  
  GET DIAGNOSTICS v_record_count = ROW_COUNT;
  RAISE NOTICE 'Updated % tables with default establishment', v_record_count;
  
  -- Migrate commandes table
  UPDATE commandes
  SET etablissement_id = v_default_etablissement_id
  WHERE etablissement_id IS NULL;
  
  GET DIAGNOSTICS v_record_count = ROW_COUNT;
  RAISE NOTICE 'Updated % commandes with default establishment', v_record_count;
  
  -- Migrate commande_items table
  UPDATE commande_items
  SET etablissement_id = v_default_etablissement_id
  WHERE etablissement_id IS NULL;
  
  GET DIAGNOSTICS v_record_count = ROW_COUNT;
  RAISE NOTICE 'Updated % commande_items with default establishment', v_record_count;
  
  -- Migrate ravitaillements table
  UPDATE ravitaillements
  SET etablissement_id = v_default_etablissement_id
  WHERE etablissement_id IS NULL;
  
  GET DIAGNOSTICS v_record_count = ROW_COUNT;
  RAISE NOTICE 'Updated % ravitaillements with default establishment', v_record_count;
  
  -- Migrate ravitaillement_items table
  UPDATE ravitaillement_items
  SET etablissement_id = v_default_etablissement_id
  WHERE etablissement_id IS NULL;
  
  GET DIAGNOSTICS v_record_count = ROW_COUNT;
  RAISE NOTICE 'Updated % ravitaillement_items with default establishment', v_record_count;
  
  -- Migrate factures table
  UPDATE factures
  SET etablissement_id = v_default_etablissement_id
  WHERE etablissement_id IS NULL;
  
  GET DIAGNOSTICS v_record_count = ROW_COUNT;
  RAISE NOTICE 'Updated % factures with default establishment', v_record_count;
  
  -- Migrate encaissements table
  UPDATE encaissements
  SET etablissement_id = v_default_etablissement_id
  WHERE etablissement_id IS NULL;
  
  GET DIAGNOSTICS v_record_count = ROW_COUNT;
  RAISE NOTICE 'Updated % encaissements with default establishment', v_record_count;
  
  -- Migrate audit_logs table
  UPDATE audit_logs
  SET etablissement_id = v_default_etablissement_id
  WHERE etablissement_id IS NULL;
  
  GET DIAGNOSTICS v_record_count = ROW_COUNT;
  RAISE NOTICE 'Updated % audit_logs with default establishment', v_record_count;
  
  -- Validate that all non-admin profiles have etablissement_id
  SELECT COUNT(*) INTO v_record_count
  FROM profiles
  WHERE etablissement_id IS NULL
    AND role != 'admin';
  
  IF v_record_count > 0 THEN
    RAISE EXCEPTION 'Migration validation failed: % non-admin profiles still have NULL etablissement_id', v_record_count;
  END IF;
  
  RAISE NOTICE 'Migration validation passed: All non-admin profiles have etablissement_id';
  
  -- Validate the admin constraint before making it active
  ALTER TABLE profiles VALIDATE CONSTRAINT profiles_admin_etablissement_check;
  RAISE NOTICE 'Validated profiles_admin_etablissement_check constraint';
  
END $$;

-- Make etablissement_id NOT NULL for all tables except profiles
-- (profiles allows NULL for admin users)

ALTER TABLE produits
  ALTER COLUMN etablissement_id SET NOT NULL;

ALTER TABLE stock
  ALTER COLUMN etablissement_id SET NOT NULL;

ALTER TABLE mouvements_stock
  ALTER COLUMN etablissement_id SET NOT NULL;

ALTER TABLE tables
  ALTER COLUMN etablissement_id SET NOT NULL;

ALTER TABLE commandes
  ALTER COLUMN etablissement_id SET NOT NULL;

ALTER TABLE commande_items
  ALTER COLUMN etablissement_id SET NOT NULL;

ALTER TABLE ravitaillements
  ALTER COLUMN etablissement_id SET NOT NULL;

ALTER TABLE ravitaillement_items
  ALTER COLUMN etablissement_id SET NOT NULL;

ALTER TABLE factures
  ALTER COLUMN etablissement_id SET NOT NULL;

ALTER TABLE encaissements
  ALTER COLUMN etablissement_id SET NOT NULL;

ALTER TABLE audit_logs
  ALTER COLUMN etablissement_id SET NOT NULL;

-- Add comments
COMMENT ON COLUMN profiles.etablissement_id IS 'Establishment ID (NULL for admin users, required for all other roles)';
COMMENT ON COLUMN produits.etablissement_id IS 'Establishment ID (required for multi-tenancy)';
COMMENT ON COLUMN stock.etablissement_id IS 'Establishment ID (required for multi-tenancy)';
COMMENT ON COLUMN mouvements_stock.etablissement_id IS 'Establishment ID (required for multi-tenancy)';
COMMENT ON COLUMN tables.etablissement_id IS 'Establishment ID (required for multi-tenancy)';
COMMENT ON COLUMN commandes.etablissement_id IS 'Establishment ID (required for multi-tenancy)';
COMMENT ON COLUMN commande_items.etablissement_id IS 'Establishment ID (required for multi-tenancy)';
COMMENT ON COLUMN ravitaillements.etablissement_id IS 'Establishment ID (required for multi-tenancy)';
COMMENT ON COLUMN ravitaillement_items.etablissement_id IS 'Establishment ID (required for multi-tenancy)';
COMMENT ON COLUMN factures.etablissement_id IS 'Establishment ID (required for multi-tenancy)';
COMMENT ON COLUMN encaissements.etablissement_id IS 'Establishment ID (required for multi-tenancy)';
COMMENT ON COLUMN audit_logs.etablissement_id IS 'Establishment ID (required for multi-tenancy)';
