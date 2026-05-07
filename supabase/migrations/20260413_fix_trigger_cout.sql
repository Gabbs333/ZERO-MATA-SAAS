-- Migration: Fix set_gestion_stock trigger to not force cout_moyen_pourcentage
-- Description: Instead of setting cout_moyen_pourcentage on the product, just calculate
-- prix_achat from the effective percentage (établissement global, or 30% fallback).
-- This allows products to dynamically inherit the global percentage.
-- Created: 2026-04-13

CREATE OR REPLACE FUNCTION set_gestion_stock_from_categorie()
RETURNS TRIGGER AS $$
DECLARE
  v_pourcentage_effectif INTEGER;
BEGIN
  IF NEW.categorie = 'nourriture' THEN
    NEW.gestion_stock := false;

    -- Calculer le pourcentage effectif : override produit → global établissement → 30% fallback
    v_pourcentage_effectif := COALESCE(
      NEW.cout_moyen_pourcentage,
      (SELECT cout_moyen_pourcentage FROM etablissements WHERE id = NEW.etablissement_id),
      30
    );

    -- Calculer le prix d'achat sans modifier cout_moyen_pourcentage
    -- (pour que le produit hérite dynamiquement du global s'il n'a pas d'override)
    NEW.prix_achat := ROUND(NEW.prix_vente * v_pourcentage_effectif / 100.0);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION set_gestion_stock_from_categorie IS
  'Désactive la gestion de stock pour nourriture. Calcule prix_achat à partir du % effectif (override produit → global établissement → 30%). Ne force pas cout_moyen_pourcentage sur le produit.';
