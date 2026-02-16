-- Migration: Stock Decrement on Commande Validation
-- Description: Moves stock decrement logic to a Trigger.
-- This ensures stock is updated even when bypassing the RPC.

-- 1. Function to handle stock updates when a command is validated
CREATE OR REPLACE FUNCTION handle_commande_validation()
RETURNS TRIGGER AS $$
DECLARE
  v_item RECORD;
  v_stock RECORD;
  v_user_id UUID;
BEGIN
  -- Only proceed if status changed to 'validee'
  IF NEW.statut = 'validee' AND (OLD.statut IS NULL OR OLD.statut != 'validee') THEN
    
    -- Determine user for audit (validateur_id or serveuse_id as fallback)
    v_user_id := COALESCE(NEW.validateur_id, NEW.serveuse_id);

    -- Loop through items in the command
    FOR v_item IN 
      SELECT * FROM commande_items WHERE commande_id = NEW.id
    LOOP
      -- Get current stock
      SELECT * INTO v_stock
      FROM stocks
      WHERE produit_id = v_item.produit_id;

      -- Check if stock record exists
      IF v_stock IS NULL THEN
        RAISE EXCEPTION 'Stock record not found for product %', v_item.nom_produit;
      END IF;

      -- Check if stock is sufficient
      IF v_stock.quantite_actuelle < v_item.quantite THEN
        RAISE EXCEPTION 'Stock insuffisant pour le produit %: disponible %, demandé %',
          v_item.nom_produit, v_stock.quantite_actuelle, v_item.quantite;
      END IF;

      -- Deduct from stock
      UPDATE stocks
      SET quantite_actuelle = quantite_actuelle - v_item.quantite,
          derniere_mise_a_jour = NOW()
      WHERE produit_id = v_item.produit_id;

      -- Create stock movement
      -- Note: Schema confirmed via fix_trigger_mouvements.sql
      -- Columns: type (not type_mouvement), type_reference (not reference_type), reference (not reference_id), date_creation (not date_mouvement)
      -- Values must be lowercase: 'sortie', 'commande'
      INSERT INTO mouvements_stock (
        produit_id,
        etablissement_id,
        type,
        quantite,
        type_reference,
        reference,
        utilisateur_id,
        date_creation
      ) VALUES (
        v_item.produit_id,
        NEW.etablissement_id,
        'sortie',
        v_item.quantite,
        'commande',
        NEW.id::TEXT,
        v_user_id,
        NOW()
      );
    END LOOP;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create Trigger
DROP TRIGGER IF EXISTS trigger_handle_commande_validation ON commandes;

CREATE TRIGGER trigger_handle_commande_validation
  BEFORE UPDATE ON commandes
  FOR EACH ROW
  EXECUTE FUNCTION handle_commande_validation();

-- 3. Update validate_commande RPC to REMOVE stock logic (to avoid double decrement)
CREATE OR REPLACE FUNCTION validate_commande(
  p_commande_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_commande RECORD;
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

  -- Note: Stock checks are now handled by the trigger handle_commande_validation
  -- when the status is updated below.

  -- Update commande status (This will fire the trigger)
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
