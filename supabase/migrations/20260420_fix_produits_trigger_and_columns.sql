-- Migration: Ensure product columns exist and make set_gestion_stock trigger 100% safe
-- Description: Prevents any errors when creating or updating products in the Patron app.

-- ============================================================================
-- 1. ENSURE COLUMNS EXIST ON PRODUITS TABLE
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'produits' AND column_name = 'gestion_stock') THEN
    ALTER TABLE produits ADD COLUMN gestion_stock BOOLEAN NOT NULL DEFAULT true;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'produits' AND column_name = 'prix_achat') THEN
    ALTER TABLE produits ADD COLUMN prix_achat INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'produits' AND column_name = 'cout_moyen_pourcentage') THEN
    ALTER TABLE produits ADD COLUMN cout_moyen_pourcentage INTEGER;
  END IF;
END $$;

-- ============================================================================
-- 2. SAFE & DEFENSIVE TRIGGER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION set_gestion_stock_from_categorie()
RETURNS TRIGGER AS $$
DECLARE
  v_pourcentage_effectif INTEGER;
BEGIN
  BEGIN
    IF NEW.categorie = 'nourriture' THEN
      NEW.gestion_stock := false;

      -- Calculer le pourcentage effectif avec protections contre les NULLs
      v_pourcentage_effectif := COALESCE(
        NEW.cout_moyen_pourcentage,
        (SELECT cout_moyen_pourcentage FROM etablissements WHERE id = NEW.etablissement_id),
        30
      );

      IF NEW.prix_vente IS NOT NULL THEN
        NEW.prix_achat := ROUND(NEW.prix_vente * v_pourcentage_effectif / 100.0);
      END IF;
    ELSE
      IF NEW.gestion_stock IS NULL THEN
        NEW.gestion_stock := true;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- En cas d'erreur dans le trigger, on ne bloque jamais la création/modification du produit
    RAISE WARNING 'set_gestion_stock_from_categorie warning: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Réappliquer le trigger proprement
DROP TRIGGER IF EXISTS trigger_set_gestion_stock_from_categorie ON produits;
CREATE TRIGGER trigger_set_gestion_stock_from_categorie
  BEFORE INSERT OR UPDATE ON produits
  FOR EACH ROW
  EXECUTE FUNCTION set_gestion_stock_from_categorie();
