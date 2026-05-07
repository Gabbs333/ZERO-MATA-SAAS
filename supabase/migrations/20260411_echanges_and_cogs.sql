-- Migration: Échanges, Coût moyen %, et modification du stock initial
-- Description: Implements item exchanges, default COGS percentage, and stock editing from products screen
-- Created: 2026-04-11

-- ============================================================================
-- PARTIE 1 : TABLES POUR LES ÉCHANGES
-- ============================================================================

-- Table principale des échanges
CREATE TABLE IF NOT EXISTS echanges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero_echange TEXT NOT NULL UNIQUE,
  facture_id UUID NOT NULL REFERENCES factures(id),
  commande_id UUID NOT NULL REFERENCES commandes(id),
  montant_retourne INTEGER NOT NULL DEFAULT 0 CHECK (montant_retourne >= 0),
  montant_ajoute INTEGER NOT NULL DEFAULT 0 CHECK (montant_ajoute >= 0),
  difference_montant INTEGER NOT NULL DEFAULT 0,
  motif TEXT,
  utilisateur_id UUID NOT NULL REFERENCES profiles(id),
  date_echange TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  etablissement_id UUID NOT NULL REFERENCES etablissements(id)
);

-- Items retournés dans l'échange (ce que le client rend)
CREATE TABLE IF NOT EXISTS echange_items_sortants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  echange_id UUID NOT NULL REFERENCES echanges(id) ON DELETE CASCADE,
  commande_item_id UUID NOT NULL REFERENCES commande_items(id),
  produit_id UUID NOT NULL REFERENCES produits(id),
  nom_produit TEXT NOT NULL,
  quantite_retournee INTEGER NOT NULL CHECK (quantite_retournee > 0),
  prix_unitaire INTEGER NOT NULL CHECK (prix_unitaire >= 0),
  montant_ligne INTEGER NOT NULL CHECK (montant_ligne >= 0)
);

-- Items ajoutés dans l'échange (ce que le client reçoit en remplacement)
CREATE TABLE IF NOT EXISTS echange_items_entrants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  echange_id UUID NOT NULL REFERENCES echanges(id) ON DELETE CASCADE,
  produit_id UUID NOT NULL REFERENCES produits(id),
  nom_produit TEXT NOT NULL,
  quantite_ajoutee INTEGER NOT NULL CHECK (quantite_ajoutee > 0),
  prix_unitaire INTEGER NOT NULL CHECK (prix_unitaire >= 0),
  montant_ligne INTEGER NOT NULL CHECK (montant_ligne >= 0),
  -- Référence vers le nouveau commande_item créé
  nouveau_commande_item_id UUID REFERENCES commande_items(id)
);

-- ============================================================================
-- INDEXES POUR LES ÉCHANGES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_echanges_facture ON echanges(facture_id);
CREATE INDEX IF NOT EXISTS idx_echanges_commande ON echanges(commande_id);
CREATE INDEX IF NOT EXISTS idx_echanges_utilisateur ON echanges(utilisateur_id);
CREATE INDEX IF NOT EXISTS idx_echanges_date ON echanges(date_echange);
CREATE INDEX IF NOT EXISTS idx_echanges_etablissement ON echanges(etablissement_id);
CREATE INDEX IF NOT EXISTS idx_echange_items_sortants_echange ON echange_items_sortants(echange_id);
CREATE INDEX IF NOT EXISTS idx_echange_items_entrants_echange ON echange_items_entrants(echange_id);

-- ============================================================================
-- TRIGGER POUR GÉNÉRER LE NUMÉRO D'ÉCHANGE
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_numero_echange()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
  date_part TEXT;
BEGIN
  date_part := TO_CHAR(NOW(), 'YYYYMMDD');

  SELECT COALESCE(MAX(CAST(SUBSTRING(numero_echange FROM 13) AS INTEGER)), 0) + 1
  INTO next_num
  FROM echanges
  WHERE numero_echange LIKE 'ECH-' || date_part || '-%';

  NEW.numero_echange := 'ECH-' || date_part || '-' || LPAD(next_num::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_numero_echange
  BEFORE INSERT ON echanges
  FOR EACH ROW
  WHEN (NEW.numero_echange IS NULL OR NEW.numero_echange = '')
  EXECUTE FUNCTION generate_numero_echange();

-- ============================================================================
-- PARTIE 2 : FONCTION process_echange
-- ============================================================================

CREATE OR REPLACE FUNCTION process_echange(
  p_facture_id UUID,
  p_commande_id UUID,
  p_items_retournes JSONB,  -- [{commande_item_id, produit_id, quantite_retournee, prix_unitaire, nom_produit}]
  p_items_ajoutes JSONB,    -- [{produit_id, quantite, prix_unitaire, nom_produit}]
  p_motif TEXT,
  p_etablissement_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_profile RECORD;
  v_echange_id UUID;
  v_item JSONB;
  v_commande_item RECORD;
  v_total_retourne INTEGER := 0;
  v_total_ajoute INTEGER := 0;
  v_difference INTEGER := 0;
  v_facture RECORD;
  v_new_montant_total INTEGER;
  v_new_montant_paye INTEGER;
  v_new_montant_restant INTEGER;
  v_new_statut TEXT;
  v_decaissement_id UUID;
  v_nouveau_ci_id UUID;
  v_montant_a_rembourser INTEGER := 0;
BEGIN
  -- Authentification
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Vous devez être connecté pour effectuer un échange.';
  END IF;

  SELECT * INTO v_caller_profile FROM profiles WHERE id = v_caller_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profil non trouvé.';
  END IF;

  -- Vérification du rôle (comptoir, gerant, ou patron)
  IF v_caller_profile.role NOT IN ('comptoir', 'gerant', 'patron') THEN
    RAISE EXCEPTION 'Accès refusé.';
  END IF;

  IF v_caller_profile.actif <> true THEN
    RAISE EXCEPTION 'Votre compte est désactivé.';
  END IF;

  -- Récupération de la facture
  SELECT * INTO v_facture FROM factures WHERE id = p_facture_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Facture non trouvée.';
  END IF;

  IF v_facture.etablissement_id <> p_etablissement_id THEN
    RAISE EXCEPTION 'Établissement non correspondant.';
  END IF;

  -- =========================================================================
  -- 1. TRAITEMENT DES ARTICLES RETOURNÉS
  -- =========================================================================

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items_retournes)
  LOOP
    -- Validation de l'article de commande
    SELECT * INTO v_commande_item
    FROM commande_items
    WHERE id = (v_item->>'commande_item_id')::UUID;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Article de commande non trouvé: %', v_item->>'commande_item_id';
    END IF;

    -- Vérification de la quantité
    IF (v_item->>'quantite_retournee')::INTEGER > v_commande_item.quantite THEN
      RAISE EXCEPTION 'Quantité retournée dépasse la quantité commandée pour %', v_commande_item.nom_produit;
    END IF;

    v_total_retourne := v_total_retourne +
      (v_item->>'quantite_retournee')::INTEGER * (v_item->>'prix_unitaire')::INTEGER;

    -- Mise à jour du commande_item (réduction de la quantité)
    UPDATE commande_items
    SET quantite = quantite - (v_item->>'quantite_retournee')::INTEGER,
        montant_ligne = (quantite - (v_item->>'quantite_retournee')::INTEGER) * prix_unitaire
    WHERE id = (v_item->>'commande_item_id')::UUID;

    -- Supprimer le commande_item si la quantité tombe à 0
    DELETE FROM commande_items
    WHERE id = (v_item->>'commande_item_id')::UUID AND quantite <= 0;

    -- Incrémenter le stock
    INSERT INTO mouvements_stock (
      produit_id, type, quantite, reference, type_reference,
      utilisateur_id, etablissement_id
    )
    VALUES (
      (v_item->>'produit_id')::UUID,
      'entree',
      (v_item->>'quantite_retournee')::INTEGER,
      'ECH-' || COALESCE(v_echange_id::TEXT, 'pending'),
      'echange',
      v_caller_id,
      p_etablissement_id
    );

    UPDATE stocks
    SET quantite_actuelle = quantite_actuelle + (v_item->>'quantite_retournee')::INTEGER,
        derniere_mise_a_jour = NOW()
    WHERE produit_id = (v_item->>'produit_id')::UUID;
  END LOOP;

  -- =========================================================================
  -- 2. TRAITEMENT DES ARTICLES AJOUTÉS
  -- =========================================================================

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items_ajoutes)
  LOOP
    v_total_ajoute := v_total_ajoute +
      (v_item->>'quantite')::INTEGER * (v_item->>'prix_unitaire')::INTEGER;

    -- Vérifier le stock disponible
    -- (on laisse passer même si stock insuffisant, le gérant sera alerté)

    -- Créer un nouveau commande_item
    INSERT INTO commande_items (
      commande_id, produit_id, nom_produit, quantite,
      prix_unitaire, montant_ligne
    )
    VALUES (
      p_commande_id,
      (v_item->>'produit_id')::UUID,
      (v_item->>'nom_produit')::TEXT,
      (v_item->>'quantite')::INTEGER,
      (v_item->>'prix_unitaire')::INTEGER,
      (v_item->>'quantite')::INTEGER * (v_item->>'prix_unitaire')::INTEGER
    )
    RETURNING id INTO v_nouveau_ci_id;

    -- Décrémenter le stock
    INSERT INTO mouvements_stock (
      produit_id, type, quantite, reference, type_reference,
      utilisateur_id, etablissement_id
    )
    VALUES (
      (v_item->>'produit_id')::UUID,
      'sortie',
      (v_item->>'quantite')::INTEGER,
      'ECH-' || COALESCE(v_echange_id::TEXT, 'pending'),
      'echange',
      v_caller_id,
      p_etablissement_id
    );

    UPDATE stocks
    SET quantite_actuelle = GREATEST(0, quantite_actuelle - (v_item->>'quantite')::INTEGER),
        derniere_mise_a_jour = NOW()
    WHERE produit_id = (v_item->>'produit_id')::UUID;
  END LOOP;

  -- =========================================================================
  -- 3. CALCUL DE LA DIFFÉRENCE
  -- =========================================================================

  v_difference := v_total_ajoute - v_total_retourne;

  -- Créer l'enregistrement d'échange
  INSERT INTO echanges (
    facture_id, commande_id,
    montant_retourne, montant_ajoute, difference_montant,
    motif, utilisateur_id, etablissement_id
  )
  VALUES (
    p_facture_id, p_commande_id,
    v_total_retourne, v_total_ajoute, v_difference,
    p_motif, v_caller_id, p_etablissement_id
  )
  RETURNING id INTO v_echange_id;

  -- Mettre à jour la référence dans les mouvements_stock
  UPDATE mouvements_stock
  SET reference = 'ECH-' || v_echange_id::TEXT
  WHERE reference LIKE 'ECH-pending%'
    AND etablissement_id = p_etablissement_id
    AND date_creation >= NOW() - INTERVAL '5 seconds';

  -- Insérer les items sortants
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items_retournes)
  LOOP
    INSERT INTO echange_items_sortants (
      echange_id, commande_item_id, produit_id, nom_produit,
      quantite_retournee, prix_unitaire, montant_ligne
    )
    VALUES (
      v_echange_id,
      (v_item->>'commande_item_id')::UUID,
      (v_item->>'produit_id')::UUID,
      (v_item->>'nom_produit')::TEXT,
      (v_item->>'quantite_retournee')::INTEGER,
      (v_item->>'prix_unitaire')::INTEGER,
      (v_item->>'quantite_retournee')::INTEGER * (v_item->>'prix_unitaire')::INTEGER
    );
  END LOOP;

  -- Insérer les items entrants
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items_ajoutes)
  LOOP
    INSERT INTO echange_items_entrants (
      echange_id, produit_id, nom_produit,
      quantite_ajoutee, prix_unitaire, montant_ligne
    )
    VALUES (
      v_echange_id,
      (v_item->>'produit_id')::UUID,
      (v_item->>'nom_produit')::TEXT,
      (v_item->>'quantite')::INTEGER,
      (v_item->>'prix_unitaire')::INTEGER,
      (v_item->>'quantite')::INTEGER * (v_item->>'prix_unitaire')::INTEGER
    );
  END LOOP;

  -- =========================================================================
  -- 4. AJUSTEMENT DE LA FACTURE
  -- =========================================================================

  -- Recalculer le montant total de la commande
  UPDATE commandes
  SET montant_total = (
    SELECT COALESCE(SUM(montant_ligne), 0)
    FROM commande_items
    WHERE commande_id = p_commande_id
  )
  WHERE id = p_commande_id;

  -- Récupérer le nouveau montant total de la commande
  v_new_montant_total := (
    SELECT COALESCE(SUM(montant_ligne), 0)
    FROM commande_items
    WHERE commande_id = p_commande_id
  );

  -- Ajuster la facture
  IF v_facture.montant_paye > v_new_montant_total THEN
    v_montant_a_rembourser := v_facture.montant_paye - v_new_montant_total;
    v_new_montant_paye := v_new_montant_total;
  ELSE
    v_new_montant_paye := v_facture.montant_paye;
  END IF;

  v_new_montant_restant := v_new_montant_total - v_new_montant_paye;

  -- Déterminer le statut
  IF v_new_montant_total = 0 THEN
    v_new_statut := 'payee';
  ELSIF v_new_montant_restant <= 0 THEN
    v_new_statut := 'payee';
    v_new_montant_restant := 0;
  ELSIF v_new_montant_paye = 0 THEN
    v_new_statut := 'en_attente_paiement';
  ELSE
    v_new_statut := 'partiellement_payee';
  END IF;

  UPDATE factures SET
    montant_total = v_new_montant_total,
    montant_paye = v_new_montant_paye,
    montant_restant = v_new_montant_restant,
    statut = v_new_statut
  WHERE id = p_facture_id;

  -- Créer un décaissement si remboursement nécessaire
  IF v_montant_a_rembourser > 0 THEN
    INSERT INTO encaissements (
      facture_id, montant, mode_paiement, reference,
      utilisateur_id, date_encaissement, etablissement_id
    )
    VALUES (
      p_facture_id,
      -v_montant_a_rembourser,
      'especes',
      'DECAIS-ECH-' || v_echange_id::TEXT,
      v_caller_id,
      NOW(),
      p_etablissement_id
    )
    RETURNING id INTO v_decaissement_id;
  END IF;

  -- =========================================================================
  -- 5. RÉPONSE
  -- =========================================================================

  RETURN json_build_object(
    'success', true,
    'echange_id', v_echange_id,
    'montant_retourne', v_total_retourne,
    'montant_ajoute', v_total_ajoute,
    'difference', v_difference,
    'montant_a_payer', GREATEST(0, -v_difference),
    'montant_a_rembourser', v_montant_a_rembourser,
    'decaissement_id', v_decaissement_id
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erreur lors du traitement de l''échange: %', SQLERRM;
END;
$$;

-- ============================================================================
-- PARTIE 3 : COÛT MOYEN PAR DÉFAUT
-- ============================================================================

-- Ajouter la colonne de pourcentage par défaut sur les établissements
ALTER TABLE etablissements
ADD COLUMN IF NOT EXISTS cout_moyen_pourcentage INTEGER
CHECK (cout_moyen_pourcentage >= 0 AND cout_moyen_pourcentage <= 100);

-- Ajouter la colonne de pourcentage sur les produits (override individuel)
ALTER TABLE produits
ADD COLUMN IF NOT EXISTS cout_moyen_pourcentage INTEGER
CHECK (cout_moyen_pourcentage >= 0 AND cout_moyen_pourcentage <= 100);

-- Ajouter la colonne prix_achat si elle n'existe pas déjà
ALTER TABLE produits
ADD COLUMN IF NOT EXISTS prix_achat INTEGER DEFAULT 0 CHECK (prix_achat >= 0);

-- Commentaires
COMMENT ON COLUMN etablissements.cout_moyen_pourcentage IS 'Pourcentage du prix de vente représentant le coût moyen par défaut (0-100). Ex: 30 signifie que le coût = 30% du prix de vente.';
COMMENT ON COLUMN produits.cout_moyen_pourcentage IS 'Pourcentage individuel du coût pour ce produit. Si NULL, utilise le pourcentage de l''établissement.';
COMMENT ON COLUMN produits.prix_achat IS 'Prix d''achat unitaire du produit (coût de revient).';

-- ============================================================================
-- PARTIE 4 : AJOUT DE 'echange' AUX TYPES DE RÉFÉRENCE DE MOUVEMENTS_STOCK
-- ============================================================================

ALTER TABLE mouvements_stock DROP CONSTRAINT IF EXISTS mouvements_stock_type_reference_check;

ALTER TABLE mouvements_stock
  ADD CONSTRAINT mouvements_stock_type_reference_check
  CHECK (type_reference IN ('commande', 'ravitaillement', 'ajustement', 'retour', 'echange'));

-- ============================================================================
-- PARTIE 5 : FONCTION POUR MODIFIER LE STOCK DEPUIS L'ÉCRAN PRODUITS
-- ============================================================================

CREATE OR REPLACE FUNCTION adjust_stock_from_product(
  p_produit_id UUID,
  p_nouvelle_quantite INTEGER,
  p_motif TEXT DEFAULT 'Ajustement manuel'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_profile RECORD;
  v_stock RECORD;
  v_ancienne_quantite INTEGER;
  v_difference INTEGER;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Vous devez être connecté.';
  END IF;

  SELECT * INTO v_caller_profile FROM profiles WHERE id = v_caller_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profil non trouvé.';
  END IF;

  IF v_caller_profile.role NOT IN ('gerant', 'patron') THEN
    RAISE EXCEPTION 'Accès refusé. Seul le gérant ou le patron peut ajuster le stock.';
  END IF;

  IF p_nouvelle_quantite < 0 THEN
    RAISE EXCEPTION 'La quantité ne peut pas être négative.';
  END IF;

  -- Récupérer le stock actuel
  SELECT * INTO v_stock
  FROM stocks
  WHERE produit_id = p_produit_id
    AND etablissement_id = v_caller_profile.etablissement_id;

  IF NOT FOUND THEN
    -- Créer une entrée de stock si elle n'existe pas
    INSERT INTO stocks (produit_id, quantite_actuelle, etablissement_id)
    VALUES (p_produit_id, p_nouvelle_quantite, v_caller_profile.etablissement_id)
    RETURNING * INTO v_stock;

    v_ancienne_quantite := 0;
    v_difference := p_nouvelle_quantite;
  ELSE
    v_ancienne_quantite := v_stock.quantite_actuelle;
    v_difference := p_nouvelle_quantite - v_ancienne_quantite;

    UPDATE stocks
    SET quantite_actuelle = p_nouvelle_quantite,
        derniere_mise_a_jour = NOW()
    WHERE produit_id = p_produit_id
      AND etablissement_id = v_caller_profile.etablissement_id;
  END IF;

  -- Créer un mouvement de stock si la quantité a changé
  IF v_difference != 0 THEN
    INSERT INTO mouvements_stock (
      produit_id, type, quantite, reference, type_reference,
      utilisateur_id, etablissement_id
    )
    VALUES (
      p_produit_id,
      CASE WHEN v_difference > 0 THEN 'entree' ELSE 'sortie' END,
      ABS(v_difference),
      'ADJ-' || TO_CHAR(NOW(), 'YYYYMMDDHH24MISS'),
      'ajustement',
      v_caller_id,
      v_caller_profile.etablissement_id
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'ancienne_quantite', v_ancienne_quantite,
    'nouvelle_quantite', p_nouvelle_quantite,
    'difference', v_difference
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erreur lors de l''ajustement du stock: %', SQLERRM;
END;
$$;

-- ============================================================================
-- PARTIE 6 : RLS POUR LES TABLES D'ÉCHANGES
-- ============================================================================

ALTER TABLE echanges ENABLE ROW LEVEL SECURITY;
ALTER TABLE echange_items_sortants ENABLE ROW LEVEL SECURITY;
ALTER TABLE echange_items_entrants ENABLE ROW LEVEL SECURITY;

-- Lecture : tous les utilisateurs authentifiés de l'établissement
CREATE POLICY "users_read_establishment_echanges"
  ON echanges FOR SELECT
  TO authenticated
  USING (
    etablissement_id = (SELECT public.get_user_etablissement_id())
  );

CREATE POLICY "users_read_establishment_echange_items_sortants"
  ON echange_items_sortants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM echanges e
      WHERE e.id = echange_id
      AND e.etablissement_id = (SELECT public.get_user_etablissement_id())
    )
  );

CREATE POLICY "users_read_establishment_echange_items_entrants"
  ON echange_items_entrants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM echanges e
      WHERE e.id = echange_id
      AND e.etablissement_id = (SELECT public.get_user_etablissement_id())
    )
  );

-- Insertion : gerant, patron, comptoir
CREATE POLICY "staff_insert_echanges"
  ON echanges FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('gerant', 'patron', 'comptoir')
      AND p.actif = true
      AND p.etablissement_id = etablissement_id
    )
  );

-- Pas de modification ni suppression (immutable)

-- ============================================================================
-- PARTIE 7 : PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION process_echange(UUID, UUID, JSONB, JSONB, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION adjust_stock_from_product(UUID, INTEGER, TEXT) TO authenticated;

-- ============================================================================
-- PARTIE 8 : COMMENTAIRES
-- ============================================================================

COMMENT ON TABLE echanges IS 'Échanges d''articles dans une commande validée (retour + ajout simultané)';
COMMENT ON TABLE echange_items_sortants IS 'Articles retournés lors d''un échange';
COMMENT ON TABLE echange_items_entrants IS 'Articles ajoutés lors d''un échange en remplacement';
COMMENT ON FUNCTION process_echange IS 'Traite un échange : retourne des articles, en ajoute de nouveaux, ajuste stock et facture.';
COMMENT ON FUNCTION adjust_stock_from_product IS 'Ajuste le stock d''un produit depuis l''écran produits. Crée un mouvement de type ajustement.';
