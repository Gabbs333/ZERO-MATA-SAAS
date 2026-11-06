-- Migration: Prise de commande au comptoir + correctifs de validation/facturation
-- Description:
--   * table_id devient optionnel (ventes comptoir / à emporter)
--   * ajout de canal ('salle' | 'comptoir') et type_service ('sur_place' | 'emporter')
--   * RLS autorisant comptoir/gerant/patron à prendre des commandes
--   * create_commande v3 (prix dynamiques, table optionnelle, canal, service, client)
--   * create_commande_comptoir (création + validation optionnelle atomique)
--   * validate_commande robuste (table optionnelle, numérotation déterministe, pas de double décrément)
--   * correction de la contrainte UNIQUE factures.commande_id (facturation scindée BAR/CUI)

-- ============================================================================
-- 1. SCHÉMA COMMANDES
-- ============================================================================

ALTER TABLE commandes ALTER COLUMN table_id DROP NOT NULL;

ALTER TABLE commandes
  ADD COLUMN IF NOT EXISTS canal TEXT NOT NULL DEFAULT 'salle';
ALTER TABLE commandes
  ADD COLUMN IF NOT EXISTS type_service TEXT NOT NULL DEFAULT 'sur_place';

DO $$
BEGIN
  ALTER TABLE commandes DROP CONSTRAINT IF EXISTS commandes_canal_check;
  ALTER TABLE commandes ADD CONSTRAINT commandes_canal_check
    CHECK (canal IN ('salle', 'comptoir'));

  ALTER TABLE commandes DROP CONSTRAINT IF EXISTS commandes_type_service_check;
  ALTER TABLE commandes ADD CONSTRAINT commandes_type_service_check
    CHECK (type_service IN ('sur_place', 'emporter'));
END $$;

CREATE INDEX IF NOT EXISTS idx_commandes_canal_date ON commandes(canal, date_creation);

COMMENT ON COLUMN commandes.canal IS 'Origine de la prise de commande: salle (serveuse) ou comptoir (agent comptoir)';
COMMENT ON COLUMN commandes.type_service IS 'Service: sur_place ou emporter';
COMMENT ON COLUMN commandes.serveuse_id IS 'Utilisateur ayant pris la commande (serveuse OU agent comptoir)';

-- ============================================================================
-- 2. FACTURATION SCINDÉE : autoriser plusieurs factures par commande
-- ============================================================================

ALTER TABLE factures DROP CONSTRAINT IF EXISTS factures_commande_id_key;
CREATE INDEX IF NOT EXISTS idx_factures_commande ON factures(commande_id);

-- Neutraliser l'ancien trigger de facture globale (incompatible avec la facturation scindée BAR/CUI)
DROP TRIGGER IF EXISTS trigger_create_invoice_on_validation ON commandes;

-- ============================================================================
-- 3. RLS : le comptoir peut créer / lire ses commandes
-- ============================================================================

DROP POLICY IF EXISTS "staff_create_comptoir_commandes" ON commandes;
CREATE POLICY "staff_create_comptoir_commandes" ON commandes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('comptoir', 'gerant', 'patron', 'serveuse')
      AND profiles.actif = true
    )
    AND serveuse_id = auth.uid()
    AND statut = 'en_attente'
  );

DROP POLICY IF EXISTS "staff_read_own_commandes" ON commandes;
CREATE POLICY "staff_read_own_commandes" ON commandes
  FOR SELECT
  TO authenticated
  USING (
    serveuse_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.actif = true
    )
  );

DROP POLICY IF EXISTS "staff_create_commande_items" ON commande_items;
CREATE POLICY "staff_create_commande_items" ON commande_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM commandes
      WHERE commandes.id = commande_items.commande_id
      AND commandes.serveuse_id = auth.uid()
      AND commandes.statut = 'en_attente'
    )
  );

DROP POLICY IF EXISTS "staff_read_own_commande_items" ON commande_items;
CREATE POLICY "staff_read_own_commande_items" ON commande_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM commandes
      WHERE commandes.id = commande_items.commande_id
      AND commandes.serveuse_id = auth.uid()
    )
  );

-- ============================================================================
-- 4. NUMÉROTATION : CPT (comptoir sur place), EMP (à emporter), Txx (salle)
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_numero_commande()
RETURNS TRIGGER AS $$
DECLARE
  v_date_str TEXT;
  v_sequence INT;
  v_table_numero TEXT;
  v_new_numero TEXT;
BEGIN
  v_date_str := to_char(NOW(), 'DDMM');

  IF NEW.table_id IS NOT NULL THEN
    SELECT numero INTO v_table_numero FROM tables WHERE id = NEW.table_id;
    v_table_numero := CASE WHEN v_table_numero IS NOT NULL THEN 'T' || v_table_numero ELSE 'UNK' END;
  ELSIF COALESCE(NEW.type_service, 'sur_place') = 'emporter' THEN
    v_table_numero := 'EMP';
  ELSIF COALESCE(NEW.canal, 'salle') = 'comptoir' THEN
    v_table_numero := 'CPT';
  ELSE
    v_table_numero := 'EMP';
  END IF;

  SELECT COUNT(*) + 1 INTO v_sequence
  FROM commandes
  WHERE date_creation >= CURRENT_DATE AND date_creation < CURRENT_DATE + 1;

  LOOP
    v_new_numero := 'CMD-' || v_date_str || '-' || v_table_numero || '-' || lpad(v_sequence::text, 3, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM commandes WHERE numero_commande = v_new_numero);
    v_sequence := v_sequence + 1;
  END LOOP;

  NEW.numero_commande := v_new_numero;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Sécurité : s'assurer que le trigger de numérotation est bien attaché
DROP TRIGGER IF EXISTS trigger_generate_numero_commande ON commandes;
CREATE TRIGGER trigger_generate_numero_commande
  BEFORE INSERT ON commandes
  FOR EACH ROW
  EXECUTE FUNCTION generate_numero_commande();

-- ============================================================================
-- 5. TRIGGER DE VALIDATION (source unique du décrément de stock)
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_commande_validation()
RETURNS TRIGGER AS $$
DECLARE
  v_item RECORD;
  v_stock RECORD;
  v_produit RECORD;
  v_user_id UUID;
BEGIN
  IF NEW.statut = 'validee' AND (OLD.statut IS NULL OR OLD.statut <> 'validee') THEN

    v_user_id := COALESCE(NEW.validateur_id, NEW.serveuse_id);

    FOR v_item IN SELECT * FROM commande_items WHERE commande_id = NEW.id
    LOOP
      SELECT * INTO v_produit FROM produits WHERE id = v_item.produit_id;

      IF COALESCE(v_produit.gestion_stock, true) = true THEN
        SELECT * INTO v_stock FROM stocks
        WHERE produit_id = v_item.produit_id AND etablissement_id = NEW.etablissement_id;

        IF v_stock IS NULL THEN
          SELECT * INTO v_stock FROM stocks WHERE produit_id = v_item.produit_id LIMIT 1;
        END IF;

        IF v_stock IS NULL THEN
          RAISE EXCEPTION 'Stock introuvable pour le produit %', v_item.nom_produit;
        END IF;

        IF v_stock.quantite_actuelle < v_item.quantite THEN
          RAISE EXCEPTION 'Stock insuffisant pour le produit % : disponible %, demandé %',
            v_item.nom_produit, v_stock.quantite_actuelle, v_item.quantite;
        END IF;

        UPDATE stocks
        SET quantite_actuelle = quantite_actuelle - v_item.quantite,
            derniere_mise_a_jour = NOW()
        WHERE id = v_stock.id;

        INSERT INTO mouvements_stock (
          produit_id, etablissement_id, type, quantite,
          type_reference, reference, utilisateur_id, date_creation
        ) VALUES (
          v_item.produit_id, NEW.etablissement_id, 'sortie', v_item.quantite,
          'commande', NEW.id::TEXT, v_user_id, NOW()
        );
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_handle_commande_validation ON commandes;
CREATE TRIGGER trigger_handle_commande_validation
  BEFORE UPDATE ON commandes
  FOR EACH ROW
  EXECUTE FUNCTION handle_commande_validation();

-- ============================================================================
-- 6. CREATE_COMMANDE v3 (compatible serveuse : p_table_id / p_items)
-- ============================================================================

DROP FUNCTION IF EXISTS create_commande(UUID, JSONB);

CREATE OR REPLACE FUNCTION create_commande(
  p_table_id UUID DEFAULT NULL,
  p_items JSONB DEFAULT '[]'::jsonb,
  p_canal TEXT DEFAULT 'salle',
  p_type_service TEXT DEFAULT 'sur_place',
  p_client_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_commande_id UUID;
  v_item JSONB;
  v_montant_total INTEGER := 0;
  v_produit RECORD;
  v_etablissement_id UUID;
  v_role TEXT;
  v_canal TEXT;
  v_type_service TEXT;
BEGIN
  v_canal := COALESCE(NULLIF(p_canal, ''), 'salle');
  IF v_canal NOT IN ('salle', 'comptoir') THEN
    RAISE EXCEPTION 'Canal invalide: %', v_canal;
  END IF;

  v_type_service := COALESCE(NULLIF(p_type_service, ''), 'sur_place');
  IF v_type_service NOT IN ('sur_place', 'emporter') THEN
    RAISE EXCEPTION 'Type de service invalide: %', v_type_service;
  END IF;

  SELECT etablissement_id, role INTO v_etablissement_id, v_role
  FROM profiles WHERE id = auth.uid();

  IF v_etablissement_id IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non rattaché à un établissement.';
  END IF;

  IF v_canal = 'comptoir' AND v_role NOT IN ('comptoir', 'gerant', 'patron') THEN
    RAISE EXCEPTION 'Rôle non autorisé à prendre une commande au comptoir.';
  END IF;

  IF p_table_id IS NOT NULL THEN
    PERFORM 1 FROM tables WHERE id = p_table_id AND etablissement_id = v_etablissement_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Table introuvable ou non autorisée.';
    END IF;
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'La commande doit contenir au moins un article.';
  END IF;

  IF p_client_id IS NOT NULL THEN
    PERFORM 1 FROM clients WHERE id = p_client_id AND etablissement_id = v_etablissement_id;
    IF NOT FOUND THEN
      p_client_id := NULL;
    END IF;
  END IF;

  INSERT INTO commandes (
    table_id, serveuse_id, statut, etablissement_id, canal, type_service, client_id
  ) VALUES (
    p_table_id, auth.uid(), 'en_attente', v_etablissement_id, v_canal, v_type_service, p_client_id
  )
  RETURNING id INTO v_commande_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT id, nom, prix_vente, actif
    INTO v_produit
    FROM produits
    WHERE id = (v_item->>'produit_id')::UUID
      AND etablissement_id = v_etablissement_id;

    IF v_produit.id IS NULL THEN
      RAISE EXCEPTION 'Produit introuvable ou hors établissement.';
    END IF;

    IF NOT v_produit.actif THEN
      RAISE EXCEPTION 'Produit inactif: %', v_produit.nom;
    END IF;

    IF COALESCE((v_item->>'quantite')::INTEGER, 0) <= 0 THEN
      RAISE EXCEPTION 'Quantité invalide pour %', v_produit.nom;
    END IF;

    DECLARE
      v_qte INTEGER := (v_item->>'quantite')::INTEGER;
      v_prix INTEGER := v_produit.prix_vente;
      v_ligne INTEGER;
    BEGIN
      -- Prix dynamique (Happy Hours / week-end / saison) avec repli sécurisé
      BEGIN
        v_prix := COALESCE(public.get_prix_produit(v_produit.id, NOW()), v_produit.prix_vente);
      EXCEPTION WHEN undefined_function THEN
        v_prix := v_produit.prix_vente;
      END;

      v_ligne := v_prix * v_qte;

      INSERT INTO commande_items (
        commande_id, produit_id, nom_produit, prix_unitaire, quantite, montant_ligne
      ) VALUES (
        v_commande_id, v_produit.id, v_produit.nom, v_prix, v_qte, v_ligne
      );

      v_montant_total := v_montant_total + v_ligne;
    END;
  END LOOP;

  UPDATE commandes SET montant_total = v_montant_total WHERE id = v_commande_id;

  IF p_table_id IS NOT NULL THEN
    UPDATE tables
    SET statut = 'commande_en_attente', derniere_mise_a_jour = NOW()
    WHERE id = p_table_id;
  END IF;

  RETURN v_commande_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_commande(UUID, JSONB, TEXT, TEXT, UUID) TO authenticated;

-- ============================================================================
-- 7. CREATE_COMMANDE_COMPTOIR (création + validation optionnelle atomique)
-- ============================================================================

CREATE OR REPLACE FUNCTION create_commande_comptoir(
  p_items JSONB,
  p_table_id UUID DEFAULT NULL,
  p_type_service TEXT DEFAULT 'sur_place',
  p_client_id UUID DEFAULT NULL,
  p_valider_immediatement BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_commande_id UUID;
  v_validation JSONB := NULL;
BEGIN
  v_commande_id := create_commande(
    p_table_id := p_table_id,
    p_items := p_items,
    p_canal := 'comptoir',
    p_type_service := p_type_service,
    p_client_id := p_client_id
  );

  IF p_valider_immediatement THEN
    v_validation := validate_commande(v_commande_id);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'commande_id', v_commande_id,
    'validee', p_valider_immediatement,
    'validation', v_validation
  );
END;
$$;

GRANT EXECUTE ON FUNCTION create_commande_comptoir(JSONB, UUID, TEXT, UUID, BOOLEAN) TO authenticated;

-- ============================================================================
-- 8. VALIDATE_COMMANDE v3 (sans décrément de stock : géré par le trigger)
-- ============================================================================

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
  v_user_id UUID;
  v_etablissement_id UUID;
  v_montant_bar INTEGER := 0;
  v_montant_cuisine INTEGER := 0;
  v_facture_bar_id UUID;
  v_facture_cuisine_id UUID;
  v_base TEXT;
  v_table_num TEXT;
  v_seq INTEGER;
BEGIN
  v_user_id := auth.uid();

  SELECT c.*, t.numero AS table_numero
  INTO v_commande
  FROM commandes c
  LEFT JOIN tables t ON t.id = c.table_id
  WHERE c.id = p_commande_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Commande introuvable.';
  END IF;

  IF v_commande.statut IN ('validee', 'terminee') THEN
    RETURN jsonb_build_object('success', true, 'message', 'Commande déjà validée.');
  END IF;

  v_etablissement_id := v_commande.etablissement_id;

  -- Calcul des montants par département
  FOR v_item IN
    SELECT ci.*, p.categorie
    FROM commande_items ci
    JOIN produits p ON p.id = ci.produit_id
    WHERE ci.commande_id = p_commande_id
  LOOP
    IF v_item.categorie = 'nourriture' THEN
      v_montant_cuisine := v_montant_cuisine + v_item.montant_ligne;
    ELSE
      v_montant_bar := v_montant_bar + v_item.montant_ligne;
    END IF;
  END LOOP;

  -- Base de numérotation de facture (unique par jour)
  IF v_commande.table_id IS NOT NULL AND v_commande.table_numero IS NOT NULL THEN
    v_table_num := 'T' || v_commande.table_numero;
  ELSIF COALESCE(v_commande.type_service, 'sur_place') = 'emporter' THEN
    v_table_num := 'EMP';
  ELSIF COALESCE(v_commande.canal, 'salle') = 'comptoir' THEN
    v_table_num := 'CPT';
  ELSE
    v_table_num := 'IMP';
  END IF;

  SELECT COUNT(*) + 1 INTO v_seq
  FROM factures
  WHERE date_generation >= CURRENT_DATE AND date_generation < CURRENT_DATE + 1;

  LOOP
    v_base := 'FAC-' || to_char(NOW(), 'DDMMYY') || '-' || v_table_num || '-' || lpad(v_seq::text, 3, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM factures
      WHERE numero_facture IN (v_base || '-BAR', v_base || '-CUI', v_base)
    );
    v_seq := v_seq + 1;
  END LOOP;

  IF v_montant_bar > 0 THEN
    INSERT INTO factures (
      numero_facture, commande_id, montant_total, montant_paye, montant_restant,
      statut, etablissement_id, date_generation
    ) VALUES (
      v_base || '-BAR', p_commande_id, v_montant_bar, 0, v_montant_bar,
      'en_attente_paiement', v_etablissement_id, NOW()
    )
    RETURNING id INTO v_facture_bar_id;
  END IF;

  IF v_montant_cuisine > 0 THEN
    INSERT INTO factures (
      numero_facture, commande_id, montant_total, montant_paye, montant_restant,
      statut, etablissement_id, date_generation
    ) VALUES (
      v_base || '-CUI', p_commande_id, v_montant_cuisine, 0, v_montant_cuisine,
      'en_attente_paiement', v_etablissement_id, NOW()
    )
    RETURNING id INTO v_facture_cuisine_id;
  END IF;

  IF v_montant_bar = 0 AND v_montant_cuisine = 0 THEN
    INSERT INTO factures (
      numero_facture, commande_id, montant_total, montant_paye, montant_restant,
      statut, etablissement_id, date_generation
    ) VALUES (
      v_base, p_commande_id, v_commande.montant_total, 0, v_commande.montant_total,
      'en_attente_paiement', v_etablissement_id, NOW()
    )
    RETURNING id INTO v_facture_bar_id;
  END IF;

  -- Le trigger handle_commande_validation décrémente le stock
  UPDATE commandes
  SET statut = 'validee',
      validateur_id = v_user_id,
      date_validation = NOW()
  WHERE id = p_commande_id;

  IF v_commande.table_id IS NOT NULL THEN
    UPDATE tables
    SET statut = 'occupee',
        derniere_mise_a_jour = NOW()
    WHERE id = v_commande.table_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Commande validée et factures générées.',
    'facture_bar_id', v_facture_bar_id,
    'facture_cuisine_id', v_facture_cuisine_id
  );
END;
$$;

-- Rafraîchir le cache de schéma PostgREST
NOTIFY pgrst, 'reload schema';
