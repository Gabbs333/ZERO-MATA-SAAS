-- ============================================================================
-- FIX TRIGGER MOUVEMENTS STOCK
-- Corriges les noms de colonnes incorrects dans le trigger update_stock_after_ravitaillement
-- et assure que la table mouvements_stock a les bonnes colonnes.
-- ============================================================================

-- 1. Assurer que etablissement_id existe dans mouvements_stock
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mouvements_stock' AND column_name = 'etablissement_id') THEN
        ALTER TABLE mouvements_stock ADD COLUMN etablissement_id UUID REFERENCES etablissements(id);
    END IF;
END $$;

-- 2. Redéfinir la fonction trigger avec les bons noms de colonnes et valeurs
CREATE OR REPLACE FUNCTION update_stock_after_ravitaillement()
RETURNS TRIGGER AS $$
DECLARE
  v_utilisateur_id UUID;
BEGIN
  -- Récupérer l'ID de l'utilisateur (gérant) depuis le ravitaillement parent
  SELECT gerant_id INTO v_utilisateur_id
  FROM ravitaillements
  WHERE id = NEW.ravitaillement_id;

  -- Si non trouvé, essayer auth.uid()
  IF v_utilisateur_id IS NULL THEN
    v_utilisateur_id := auth.uid();
  END IF;

  -- Insert or Update stock for the product
  -- Note: On utilise quantite_actuelle comme défini dans les scripts précédents
  INSERT INTO stocks (produit_id, etablissement_id, quantite_actuelle, seuil_alerte)
  VALUES (NEW.produit_id, NEW.etablissement_id, NEW.quantite, 10) 
  ON CONFLICT (produit_id) 
  DO UPDATE SET 
    quantite_actuelle = stocks.quantite_actuelle + EXCLUDED.quantite_actuelle,
    derniere_mise_a_jour = NOW();
    
  -- Log movement
  -- Correction des noms de colonnes:
  -- type_mouvement -> type
  -- reference_type -> type_reference
  -- reference_id -> reference
  -- date_mouvement -> date_creation
  -- Ajout de utilisateur_id (requis)
  INSERT INTO mouvements_stock (
    produit_id, 
    etablissement_id, 
    quantite, 
    type,               -- 'type' au lieu de 'type_mouvement'
    type_reference,     -- 'type_reference' au lieu de 'reference_type'
    reference,          -- 'reference' au lieu de 'reference_id'
    date_creation,      -- 'date_creation' au lieu de 'date_mouvement'
    utilisateur_id      -- Requis par le schéma
  )
  VALUES (
    NEW.produit_id, 
    NEW.etablissement_id, 
    NEW.quantite, 
    'entree',           -- Minuscule pour matcher le CHECK constraint ('entree', 'sortie')
    'ravitaillement',   -- Minuscule pour matcher le CHECK constraint ('commande', 'ravitaillement')
    NEW.ravitaillement_id::TEXT, 
    NOW(),
    v_utilisateur_id
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Réappliquer le trigger (au cas où)
DROP TRIGGER IF EXISTS trigger_update_stock_after_ravitaillement ON ravitaillement_items;
CREATE TRIGGER trigger_update_stock_after_ravitaillement
  AFTER INSERT ON ravitaillement_items
  FOR EACH ROW
  EXECUTE FUNCTION update_stock_after_ravitaillement();
