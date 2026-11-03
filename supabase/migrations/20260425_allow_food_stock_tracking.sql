-- Migration: Permettre la gestion de stock optionnelle et modifiable pour la nourriture
-- Description: Le Patron peut activer le suivi de stock (unités préparées) pour des plats précis.
-- Le trigger ne force plus gestion_stock = false pour la nourriture ; il respecte le choix explicite.

-- 1. S'assurer que la colonne gestion_stock existe
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'produits' AND column_name = 'gestion_stock') THEN
    ALTER TABLE produits ADD COLUMN gestion_stock BOOLEAN NOT NULL DEFAULT true;
  END IF;
END $$;

-- 2. Trigger mis à jour : ne force plus la désactivation pour la nourriture
CREATE OR REPLACE FUNCTION set_gestion_stock_from_categorie()
RETURNS TRIGGER AS $$
DECLARE
  v_pourcentage_effectif INTEGER;
BEGIN
  BEGIN
    -- Valeur par défaut si non fournie explicitement :
    -- nourriture => false (préparé à la commande), sinon => true (suivi de stock)
    IF NEW.gestion_stock IS NULL THEN
      NEW.gestion_stock := (NEW.categorie <> 'nourriture');
    END IF;

    -- Pour la nourriture, calculer le prix d'achat depuis le pourcentage effectif
    IF NEW.categorie = 'nourriture' THEN
      v_pourcentage_effectif := COALESCE(
        NEW.cout_moyen_pourcentage,
        (SELECT cout_moyen_pourcentage FROM etablissements WHERE id = NEW.etablissement_id),
        30
      );

      IF NEW.prix_vente IS NOT NULL AND (NEW.prix_achat IS NULL OR NEW.prix_achat = 0) THEN
        NEW.prix_achat := ROUND(NEW.prix_vente * v_pourcentage_effectif / 100.0);
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'set_gestion_stock_from_categorie warning: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Recréer le trigger
DROP TRIGGER IF EXISTS trigger_set_gestion_stock_from_categorie ON produits;
CREATE TRIGGER trigger_set_gestion_stock_from_categorie
  BEFORE INSERT OR UPDATE ON produits
  FOR EACH ROW
  EXECUTE FUNCTION set_gestion_stock_from_categorie();

-- 4. S'assurer que la validation de commande décrémente le stock pour tout produit
--    ayant gestion_stock = true (boissons comme plats suivis en unités).
CREATE OR REPLACE FUNCTION handle_commande_validation()
RETURNS TRIGGER AS $$
DECLARE
  v_item RECORD;
  v_stock RECORD;
  v_produit RECORD;
  v_user_id UUID;
BEGIN
  IF NEW.statut = 'validee' AND (OLD.statut IS NULL OR OLD.statut != 'validee') THEN

    v_user_id := COALESCE(NEW.validateur_id, NEW.serveuse_id);

    FOR v_item IN SELECT * FROM commande_items WHERE commande_id = NEW.id
    LOOP
      SELECT * INTO v_produit FROM produits WHERE id = v_item.produit_id;

      IF v_produit.gestion_stock = true THEN
        -- Vérification et déduction du stock
        SELECT * INTO v_stock FROM stocks WHERE produit_id = v_item.produit_id AND etablissement_id = NEW.etablissement_id;

        IF v_stock IS NULL THEN
          RAISE EXCEPTION 'Stock record not found for product %', v_item.nom_produit;
        END IF;

        IF v_stock.quantite_actuelle < v_item.quantite THEN
          RAISE EXCEPTION 'Stock insuffisant pour le produit %: disponible %, demandé %',
            v_item.nom_produit, v_stock.quantite_actuelle, v_item.quantite;
        END IF;

        UPDATE stocks
        SET quantite_actuelle = quantite_actuelle - v_item.quantite,
            derniere_mise_a_jour = NOW()
        WHERE produit_id = v_item.produit_id AND etablissement_id = NEW.etablissement_id;

        INSERT INTO mouvements_stock (
          produit_id, etablissement_id, type, quantite,
          type_reference, reference, utilisateur_id, date_creation
        )
        VALUES (
          v_item.produit_id, NEW.etablissement_id, 'sortie', v_item.quantite,
          'commande', NEW.id::TEXT, v_user_id, NOW()
        );
      -- ELSE : produit sans gestion de stock (nourriture à la commande) → aucune action stock
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_handle_commande_validation ON commandes;
CREATE TRIGGER trigger_handle_commande_validation
  AFTER UPDATE ON commandes
  FOR EACH ROW
  EXECUTE FUNCTION handle_commande_validation();
