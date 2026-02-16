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
) AS $
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
$ LANGUAGE plpgsql SECURITY DEFINER;

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
) AS $
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
$ LANGUAGE plpgsql SECURITY DEFINER;

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
) AS $
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
$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGER: Update stock after ravitaillement item creation
-- ============================================================================

-- This trigger is already handled in the create_ravitaillement function
-- But we add it here for direct inserts (if any)
CREATE OR REPLACE FUNCTION trigger_update_stock_on_ravitaillement()
RETURNS TRIGGER AS $
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
$ LANGUAGE plpgsql;

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
RETURNS TRIGGER AS $
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
$ LANGUAGE plpgsql;

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
