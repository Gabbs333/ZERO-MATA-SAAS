
-- 1. Fix ravitaillement_items schema
DO $$
BEGIN
    -- Rename cout_unitaire to prix_unitaire if needed
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ravitaillement_items' AND column_name = 'cout_unitaire') THEN
        ALTER TABLE ravitaillement_items RENAME COLUMN cout_unitaire TO prix_unitaire;
    END IF;

    -- Add nom_produit if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ravitaillement_items' AND column_name = 'nom_produit') THEN
        ALTER TABLE ravitaillement_items ADD COLUMN nom_produit TEXT;
    END IF;

    -- Add etablissement_id to ravitaillement_items if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ravitaillement_items' AND column_name = 'etablissement_id') THEN
        ALTER TABLE ravitaillement_items ADD COLUMN etablissement_id UUID REFERENCES etablissements(id);
    END IF;

    -- Remove montant_ligne if app doesn't calculate/send it (or make it nullable/default 0)
    -- App code doesn't send montant_ligne, so we should make it nullable or generated
    ALTER TABLE ravitaillement_items ALTER COLUMN montant_ligne DROP NOT NULL;
    
    -- Or create a trigger to calculate it if it's strictly required
    -- For now, let's make it nullable to avoid blocking inserts
END $$;

-- 2. Fix ravitaillements schema
DO $$
BEGIN
    -- Add etablissement_id if missing (should be done but just in case)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ravitaillements' AND column_name = 'etablissement_id') THEN
        ALTER TABLE ravitaillements ADD COLUMN etablissement_id UUID REFERENCES etablissements(id);
    END IF;

    -- Make gerant_id nullable if app doesn't send it properly or if it's optional
    -- App sends gerant_id: profile?.id, so it should be fine if logged in.
    -- But let's check if there are other constraints.
END $$;

-- 3. Create Trigger to calculate montant_ligne automatically if missing
CREATE OR REPLACE FUNCTION calculate_ravitaillement_item_total()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.montant_ligne IS NULL THEN
     NEW.montant_ligne := NEW.quantite * NEW.prix_unitaire;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calculate_ravitaillement_item_total ON ravitaillement_items;
CREATE TRIGGER trigger_calculate_ravitaillement_item_total
  BEFORE INSERT OR UPDATE ON ravitaillement_items
  FOR EACH ROW
  EXECUTE FUNCTION calculate_ravitaillement_item_total();

-- 4. Create Trigger to update Stock after Ravitaillement
-- (App code comment says: "assuming backend trigger handles it")
CREATE OR REPLACE FUNCTION update_stock_after_ravitaillement()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert or Update stock for the product
  INSERT INTO stocks (produit_id, etablissement_id, quantite_actuelle, seuil_alerte)
  VALUES (NEW.produit_id, NEW.etablissement_id, NEW.quantite, 10) -- Default alert threshold 10
  ON CONFLICT (produit_id) 
  DO UPDATE SET 
    quantite_actuelle = stocks.quantite_actuelle + EXCLUDED.quantite_actuelle,
    derniere_mise_a_jour = NOW();
    
  -- Log movement
  INSERT INTO mouvements_stock (
    produit_id, 
    etablissement_id, 
    quantite, 
    type_mouvement, 
    reference_type, 
    reference_id, 
    date_mouvement
  )
  VALUES (
    NEW.produit_id, 
    NEW.etablissement_id, 
    NEW.quantite, 
    'ENTREE', 
    'RAVITAILLEMENT', 
    NEW.ravitaillement_id::TEXT, 
    NOW()
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_stock_after_ravitaillement ON ravitaillement_items;
CREATE TRIGGER trigger_update_stock_after_ravitaillement
  AFTER INSERT ON ravitaillement_items
  FOR EACH ROW
  EXECUTE FUNCTION update_stock_after_ravitaillement();
