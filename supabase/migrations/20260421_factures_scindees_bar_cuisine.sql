-- Migration: Factures Scindées Bar / Cuisine lors de la validation
-- Description: Sépare automatiquement une commande contenant boissons et nourriture en deux factures distinctes (BAR et CUISINE).

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
  v_item RECORD;
  v_stock RECORD;
  v_produit RECORD;
  v_user_id UUID;
  v_etablissement_id UUID;
  
  -- Totaux séparés
  v_montant_bar INTEGER := 0;
  v_montant_cuisine INTEGER := 0;
  
  -- IDs des factures créées
  v_facture_bar_id UUID;
  v_facture_cuisine_id UUID;
  v_numero_base TEXT;
  v_table_numero TEXT;
BEGIN
  v_user_id := auth.uid();

  -- 1. Récupérer la commande
  SELECT c.*, t.numero as table_numero
  INTO v_commande
  FROM commandes c
  LEFT JOIN tables t ON t.id = c.table_id
  WHERE c.id = p_commande_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Commande introuvable.';
  END IF;

  IF v_commande.statut = 'validee' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Commande déjà validée.');
  END IF;

  v_etablissement_id := v_commande.etablissement_id;
  v_table_numero := COALESCE(v_commande.table_numero, '0');
  v_numero_base := TO_CHAR(NOW(), 'DDMM') || '-T' || v_table_numero || '-' || LPAD(FLOOR(RANDOM() * 1000)::TEXT, 3, '0');

  -- 2. Gérer le stock des boissons (gestion_stock = true)
  FOR v_item IN SELECT ci.*, p.categorie, p.gestion_stock FROM commande_items ci JOIN produits p ON p.id = ci.produit_id WHERE ci.commande_id = p_commande_id
  LOOP
    IF v_item.gestion_stock = true THEN
      SELECT * INTO v_stock FROM stocks WHERE produit_id = v_item.produit_id AND etablissement_id = v_etablissement_id;

      IF v_stock IS NULL THEN
        RAISE EXCEPTION 'Stock introuvable pour le produit %', v_item.nom_produit;
      END IF;

      IF v_stock.quantite_actuelle < v_item.quantite THEN
        RAISE EXCEPTION 'Stock insuffisant pour % : disponible %, demandé %', v_item.nom_produit, v_stock.quantite_actuelle, v_item.quantite;
      END IF;

      -- Décrémenter le stock
      UPDATE stocks
      SET quantite_actuelle = quantite_actuelle - v_item.quantite,
          derniere_mise_a_jour = NOW()
      WHERE produit_id = v_item.produit_id AND etablissement_id = v_etablissement_id;

      -- Enregistrer le mouvement de stock
      INSERT INTO mouvements_stock (
        produit_id, etablissement_id, type, quantite,
        type_reference, reference, utilisateur_id, date_creation
      ) VALUES (
        v_item.produit_id, v_etablissement_id, 'sortie', v_item.quantite,
        'commande', p_commande_id::TEXT, v_user_id, NOW()
      );
    END IF;

    -- Calculer les montants séparés (Bar = boisson/autre, Cuisine = nourriture)
    IF v_item.categorie = 'nourriture' THEN
      v_montant_cuisine := v_montant_cuisine + v_item.montant_ligne;
    ELSE
      v_montant_bar := v_montant_bar + v_item.montant_ligne;
    END IF;
  END LOOP;

  -- 3. Créer les factures scindées
  -- Facture Bar (si articles bar présents)
  IF v_montant_bar > 0 THEN
    INSERT INTO factures (
      numero_facture,
      commande_id,
      montant_total,
      montant_paye,
      montant_restant,
      statut,
      etablissement_id,
      date_generation
    ) VALUES (
      'FAC-' || v_numero_base || '-BAR',
      p_commande_id,
      v_montant_bar,
      0,
      v_montant_bar,
      'en_attente_paiement',
      v_etablissement_id,
      NOW()
    )
    RETURNING id INTO v_facture_bar_id;
  END IF;

  -- Facture Cuisine (si articles cuisine présents)
  IF v_montant_cuisine > 0 THEN
    INSERT INTO factures (
      numero_facture,
      commande_id,
      montant_total,
      montant_paye,
      montant_restant,
      statut,
      etablissement_id,
      date_generation
    ) VALUES (
      'FAC-' || v_numero_base || '-CUI',
      p_commande_id,
      v_montant_cuisine,
      0,
      v_montant_cuisine,
      'en_attente_paiement',
      v_etablissement_id,
      NOW()
    )
    RETURNING id INTO v_facture_cuisine_id;
  END IF;

  -- Si ni l'un ni l'autre (sécurité), créer une facture globale du montant total
  IF v_montant_bar = 0 AND v_montant_cuisine = 0 THEN
    INSERT INTO factures (
      numero_facture,
      commande_id,
      montant_total,
      montant_paye,
      montant_restant,
      statut,
      etablissement_id,
      date_generation
    ) VALUES (
      'FAC-' || v_numero_base,
      p_commande_id,
      v_commande.montant_total,
      0,
      v_commande.montant_total,
      'en_attente_paiement',
      v_etablissement_id,
      NOW()
    );
  END IF;

  -- 4. Mettre à jour le statut de la commande et de la table
  UPDATE commandes
  SET statut = 'validee',
      validateur_id = v_user_id
  WHERE id = p_commande_id;

  UPDATE tables
  SET statut = 'occupee',
      derniere_mise_a_jour = NOW()
  WHERE id = v_commande.table_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Commande validée et factures scindées (Bar / Cuisine) générées avec succès.',
    'facture_bar_id', v_facture_bar_id,
    'facture_cuisine_id', v_facture_cuisine_id
  );
END;
$$;
