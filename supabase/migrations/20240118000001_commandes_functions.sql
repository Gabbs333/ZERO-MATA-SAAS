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
) AS $
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
$ LANGUAGE plpgsql SECURITY DEFINER;

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
RETURNS UUID AS $
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
$ LANGUAGE plpgsql SECURITY DEFINER;

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
RETURNS JSONB AS $
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
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION validate_commande(UUID) TO authenticated;
