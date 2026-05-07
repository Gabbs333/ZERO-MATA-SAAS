-- Migration: Fix validate_commande - remove duplicate logic
-- Description: Stock deduction is handled by handle_commande_validation trigger.
-- Facture creation is handled by trigger_generate_facture_after_validation and
-- trigger_create_invoice_on_validation. The RPC should only validate and update status.
-- Created: 2026-04-13

-- ============================================================================
-- CORRECTION : validate_commande() — délégation aux triggers
-- ============================================================================

-- NOTE: La vérification et déduction du stock est gérée par le trigger
-- handle_commande_validation (BEFORE UPDATE ON commandes).
-- La création de la facture est gérée par les triggers
-- trigger_generate_facture_after_validation et trigger_create_invoice_on_validation.
-- Le RPC se contente de vérifier l'état et de mettre à jour le statut.

CREATE OR REPLACE FUNCTION validate_commande(
  p_commande_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_commande RECORD;
  v_result JSONB;
BEGIN
  -- Vérifier que la commande existe et est en attente
  SELECT * INTO v_commande FROM commandes WHERE id = p_commande_id;

  IF v_commande.id IS NULL THEN
    RAISE EXCEPTION 'Commande non trouvée.';
  END IF;

  IF v_commande.statut != 'en_attente' THEN
    RAISE EXCEPTION 'La commande n''est pas en attente de validation.';
  END IF;

  -- Mettre à jour le statut de la commande
  -- Cette mise à jour déclenche :
  --   1. trigger_handle_commande_validation → vérifie et déduit le stock (sauf nourriture)
  --   2. trigger_generate_facture_after_validation → crée la facture
  --   3. trigger_create_invoice_on_validation → crée la facture (ON CONFLICT DO NOTHING)
  UPDATE commandes
  SET statut = 'validee',
      date_validation = NOW(),
      validateur_id = auth.uid()
  WHERE id = p_commande_id;

  -- Mettre à jour la table (reste occupée)
  UPDATE tables
  SET statut = 'occupee', derniere_mise_a_jour = NOW()
  WHERE id = v_commande.table_id;

  v_result := jsonb_build_object(
    'success', true,
    'commande_id', p_commande_id,
    'message', 'Commande validée avec succès.'
  );

  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    v_result := jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
    RETURN v_result;
END;
$$;

-- ============================================================================
-- SÉCURITÉ : S'assurer que le trigger handle_commande_validation existe
-- et gère correctement le cas nourriture (gestion_stock = false)
-- ============================================================================

-- Le trigger ci-dessous est déjà créé par 20260412_nourriture_gestion_stock.sql
-- On le recrée ici pour garantir sa présence avec la bonne version

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
      -- Vérifier si le produit nécessite une gestion de stock
      SELECT * INTO v_produit FROM produits WHERE id = v_item.produit_id;

      IF v_produit.gestion_stock = true THEN
        -- Vérification et déduction du stock
        SELECT * INTO v_stock FROM stocks WHERE produit_id = v_item.produit_id;

        IF v_stock IS NULL THEN
          RAISE EXCEPTION 'Fiche de stock introuvable pour le produit %. Veuillez d''abord initialiser le stock.', v_item.nom_produit;
        END IF;

        IF v_stock.quantite_actuelle < v_item.quantite THEN
          RAISE EXCEPTION 'Stock insuffisant pour le produit %: disponible %, demandé %',
            v_item.nom_produit, v_stock.quantite_actuelle, v_item.quantite;
        END IF;

        UPDATE stocks
        SET quantite_actuelle = quantite_actuelle - v_item.quantite,
            derniere_mise_a_jour = NOW()
        WHERE produit_id = v_item.produit_id;

        INSERT INTO mouvements_stock (
          produit_id, etablissement_id, type, quantite,
          type_reference, reference, utilisateur_id, date_creation
        )
        VALUES (
          v_item.produit_id, NEW.etablissement_id, 'sortie', v_item.quantite,
          'commande', NEW.id::TEXT, v_user_id, NOW()
        );
      -- ELSE : produit sans gestion de stock (nourriture) → aucune vérification, aucun mouvement
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recréer le trigger (DROP + CREATE pour éviter les doublons)
DROP TRIGGER IF EXISTS trigger_handle_commande_validation ON commandes;

CREATE TRIGGER trigger_handle_commande_validation
  BEFORE UPDATE ON commandes
  FOR EACH ROW
  EXECUTE FUNCTION handle_commande_validation();

-- ============================================================================
-- PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION validate_commande(UUID) TO authenticated;

-- ============================================================================
-- COMMENTAIRES
-- ============================================================================

COMMENT ON FUNCTION validate_commande(UUID) IS
  'Valide une commande : vérifie l''état, met à jour le statut. Le stock (sauf nourriture) et la facture sont gérés par les triggers.';

COMMENT ON FUNCTION handle_commande_validation IS
  'Trigger BEFORE UPDATE : vérifie et déduit le stock uniquement pour les produits avec gestion_stock = true (ignore la nourriture).';
