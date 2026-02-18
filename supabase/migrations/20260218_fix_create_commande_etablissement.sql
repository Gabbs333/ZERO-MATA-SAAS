-- Migration: Fix etablissement_id in create_commande and validate_commande
-- Description: Ensures etablissement_id is correctly set when creating commands and stock movements.
--              Also backfills missing etablissement_id in commandes and mouvements_stock.

-- 1. Update create_commande to set etablissement_id
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
  v_etablissement_id UUID;
BEGIN
  -- Validate that table exists and get etablissement_id
  SELECT etablissement_id INTO v_etablissement_id
  FROM tables
  WHERE id = p_table_id;

  IF v_etablissement_id IS NULL THEN
    RAISE EXCEPTION 'Table not found or has no etablissement_id';
  END IF;

  -- Validate that items array is not empty
  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Commande must have at least one item';
  END IF;

  -- Create the commande with etablissement_id
  INSERT INTO commandes (table_id, serveuse_id, statut, etablissement_id)
  VALUES (p_table_id, auth.uid(), 'en_attente', v_etablissement_id)
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

  -- Update commande total
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


-- 2. Update validate_commande to set etablissement_id in mouvements_stock
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
      utilisateur_id,
      etablissement_id
    ) VALUES (
      v_item.produit_id,
      'sortie',
      v_item.quantite,
      NULL, -- Cost is not tracked for sales
      p_commande_id::TEXT,
      'commande',
      auth.uid(),
      v_commande.etablissement_id
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

-- 3. Backfill missing etablissement_id in commandes
UPDATE commandes c
SET etablissement_id = t.etablissement_id
FROM tables t
WHERE c.table_id = t.id
AND c.etablissement_id IS NULL;

-- 4. Backfill missing etablissement_id in mouvements_stock
-- For movements linked to a commande
UPDATE mouvements_stock m
SET etablissement_id = c.etablissement_id
FROM commandes c
WHERE m.reference = c.id::TEXT
AND m.type_reference = 'commande'
AND m.etablissement_id IS NULL;
