-- Fix validate_commande RPC and data issues
-- Run this in Supabase SQL Editor

-- 1. Redefine validate_commande with correct table names and invoice creation
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
  -- Get commande details including etablissement_id
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
    -- Get current stock (Table name is 'stock', singular)
    SELECT * INTO v_stock
    FROM stock
    WHERE produit_id = v_item.produit_id;

    -- Check if stock is sufficient
    IF v_stock IS NULL THEN
       RAISE EXCEPTION 'Stock entry not found for product %', v_item.nom_produit;
    END IF;

    IF v_stock.quantite_disponible < v_item.quantite THEN
      RAISE EXCEPTION 'Insufficient stock for product %: available %, requested %',
        v_item.nom_produit, v_stock.quantite_disponible, v_item.quantite;
    END IF;
  END LOOP;

  -- All checks passed, proceed with validation
  
  -- 1. Deduct stock and create movements
  FOR v_item IN 
    SELECT * FROM commande_items WHERE commande_id = p_commande_id
  LOOP
    -- Deduct from stock (Table name is 'stock')
    UPDATE stock
    SET quantite_disponible = quantite_disponible - v_item.quantite,
        derniere_mise_a_jour = NOW()
    WHERE produit_id = v_item.produit_id;

    -- Create stock movement (Table name is 'mouvements_stock')
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
        NULL, -- Cost not tracked for sales
        p_commande_id::TEXT,
        'commande',
        auth.uid(),
        v_commande.etablissement_id
    );
  END LOOP;
  
  -- 2. Create Invoice (Facture)
  INSERT INTO factures (
      commande_id,
      montant_total,
      montant_paye,
      montant_restant,
      statut,
      etablissement_id,
      date_generation
  ) VALUES (
      p_commande_id,
      v_commande.montant_total,
      0,
      v_commande.montant_total,
      'en_attente_paiement',
      v_commande.etablissement_id,
      NOW()
  );

  -- 3. Update commande status
  UPDATE commandes
  SET statut = 'validee',
      date_validation = NOW(),
      validateur_id = auth.uid()
  WHERE id = p_commande_id;

  -- 4. Update table status
  UPDATE tables
  SET statut = 'occupee',
      derniere_mise_a_jour = NOW()
  WHERE id = v_commande.table_id;
  
  -- Return success
  v_result := jsonb_build_object(
    'success', true,
    'commande_id', p_commande_id,
    'message', 'Commande validée et facture créée'
  );
  
  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error validating commande: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Fix stuck tables (Status 'validee' but Table 'commande_en_attente')
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT c.id, c.table_id
    FROM commandes c
    JOIN tables t ON c.table_id = t.id
    WHERE c.statut = 'validee' AND t.statut = 'commande_en_attente'
  LOOP
    UPDATE tables SET statut = 'occupee', derniere_mise_a_jour = NOW() WHERE id = r.table_id;
  END LOOP;
END $$;

-- 3. Create missing invoices for validated commands
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT c.id, c.montant_total, c.etablissement_id, c.date_validation
    FROM commandes c
    LEFT JOIN factures f ON c.id = f.commande_id
    WHERE c.statut = 'validee' AND f.id IS NULL
  LOOP
    INSERT INTO factures (
      commande_id, montant_total, statut, montant_paye, montant_restant, etablissement_id, date_generation
    ) VALUES (
      r.id, r.montant_total, 'en_attente_paiement', 0, r.montant_total, r.etablissement_id, COALESCE(r.date_validation, NOW())
    );
  END LOOP;
END $$;
