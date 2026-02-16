-- Fix stock table column name mismatch and ensure ravitaillement_items schema is correct

-- 1. Rename quantite to quantite_actuelle in stocks table if needed
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stocks' AND column_name = 'quantite') THEN
        ALTER TABLE stocks RENAME COLUMN quantite TO quantite_actuelle;
    END IF;
END $$;

-- 2. Add seuil_alerte if missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stocks' AND column_name = 'seuil_alerte') THEN
        ALTER TABLE stocks ADD COLUMN seuil_alerte INTEGER DEFAULT 10;
    END IF;
END $$;

-- 3. Add derniere_mise_a_jour if missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stocks' AND column_name = 'derniere_mise_a_jour') THEN
        ALTER TABLE stocks ADD COLUMN derniere_mise_a_jour TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- 4. Ensure ravitaillement_items has correct columns
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

    -- Add etablissement_id if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ravitaillement_items' AND column_name = 'etablissement_id') THEN
        ALTER TABLE ravitaillement_items ADD COLUMN etablissement_id UUID REFERENCES etablissements(id);
    END IF;
    
    -- Make montant_ligne nullable (calculated by trigger)
    ALTER TABLE ravitaillement_items ALTER COLUMN montant_ligne DROP NOT NULL;
END $$;

-- 5. Re-apply the trigger for calculate_ravitaillement_item_total
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

-- 6. Re-apply the trigger for update_stock_after_ravitaillement
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
