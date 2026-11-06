-- Migration: Opérations manuelles de stock (entrée, sortie, échange/troc) avec valorisation
-- Description:
--   * Tables operations_stock + operations_stock_lignes (entête + lignes, immuables)
--   * Extension de mouvements_stock.type_reference ('echange')
--   * RPC creer_operation_stock() atomique et valorisée (met à jour le coût moyen pondéré)
--   * RLS : lecture pour le personnel, écriture uniquement via RPC

-- ============================================================================
-- 1. TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS operations_stock (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  etablissement_id UUID NOT NULL REFERENCES etablissements(id) ON DELETE RESTRICT,
  reference TEXT NOT NULL UNIQUE,
  type_operation TEXT NOT NULL CHECK (type_operation IN ('entree', 'sortie', 'echange')),
  motif TEXT NOT NULL,
  contrepartie TEXT,
  valeur_entree INTEGER NOT NULL DEFAULT 0 CHECK (valeur_entree >= 0),
  valeur_sortie INTEGER NOT NULL DEFAULT 0 CHECK (valeur_sortie >= 0),
  valeur_nette INTEGER NOT NULL DEFAULT 0,
  utilisateur_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  date_creation TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS operations_stock_lignes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  operation_id UUID NOT NULL REFERENCES operations_stock(id) ON DELETE RESTRICT,
  produit_id UUID NOT NULL REFERENCES produits(id) ON DELETE RESTRICT,
  nom_produit TEXT NOT NULL,
  sens TEXT NOT NULL CHECK (sens IN ('entree', 'sortie')),
  quantite INTEGER NOT NULL CHECK (quantite > 0),
  prix_unitaire INTEGER NOT NULL DEFAULT 0 CHECK (prix_unitaire >= 0),
  montant_ligne INTEGER NOT NULL DEFAULT 0 CHECK (montant_ligne >= 0)
);

CREATE INDEX IF NOT EXISTS idx_operations_stock_etab_date
  ON operations_stock(etablissement_id, date_creation DESC);
CREATE INDEX IF NOT EXISTS idx_operations_stock_lignes_operation
  ON operations_stock_lignes(operation_id);
CREATE INDEX IF NOT EXISTS idx_operations_stock_lignes_produit
  ON operations_stock_lignes(produit_id);

COMMENT ON TABLE operations_stock IS 'Opérations manuelles de stock : entrée seule, sortie seule, ou échange (troc)';
COMMENT ON COLUMN operations_stock.contrepartie IS 'Tiers concerné (fournisseur, client, personne externe)';
COMMENT ON COLUMN operations_stock.valeur_nette IS 'valeur_entree - valeur_sortie (impact sur la valeur du stock)';

-- ============================================================================
-- 2. EXTENSION mouvements_stock
-- ============================================================================

ALTER TABLE mouvements_stock DROP CONSTRAINT IF EXISTS mouvements_stock_type_reference_check;
ALTER TABLE mouvements_stock
  ADD CONSTRAINT mouvements_stock_type_reference_check
  CHECK (type_reference IN ('commande', 'ravitaillement', 'ajustement', 'retour', 'echange'));

-- ============================================================================
-- 3. RLS
-- ============================================================================

ALTER TABLE operations_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations_stock_lignes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "operations_stock_read_staff" ON operations_stock;
CREATE POLICY "operations_stock_read_staff" ON operations_stock
  FOR SELECT TO authenticated
  USING (
    etablissement_id = (SELECT p.etablissement_id FROM public.profiles p WHERE p.id = auth.uid())
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "operations_stock_no_direct_write" ON operations_stock;
CREATE POLICY "operations_stock_no_direct_write" ON operations_stock
  FOR INSERT TO authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS "operations_stock_no_update" ON operations_stock;
CREATE POLICY "operations_stock_no_update" ON operations_stock
  FOR UPDATE TO authenticated USING (false);

DROP POLICY IF EXISTS "operations_stock_no_delete" ON operations_stock;
CREATE POLICY "operations_stock_no_delete" ON operations_stock
  FOR DELETE TO authenticated USING (false);

DROP POLICY IF EXISTS "operations_lignes_read_staff" ON operations_stock_lignes;
CREATE POLICY "operations_lignes_read_staff" ON operations_stock_lignes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM operations_stock o
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE o.id = operations_stock_lignes.operation_id
        AND (p.etablissement_id = o.etablissement_id OR public.is_admin())
    )
  );

DROP POLICY IF EXISTS "operations_lignes_no_direct_write" ON operations_stock_lignes;
CREATE POLICY "operations_lignes_no_direct_write" ON operations_stock_lignes
  FOR INSERT TO authenticated
  WITH CHECK (false);

-- ============================================================================
-- 4. RPC creer_operation_stock
--    p_lignes : [ { produit_id, sens: 'entree'|'sortie', quantite, prix_unitaire } ]
-- ============================================================================

CREATE OR REPLACE FUNCTION creer_operation_stock(
  p_type_operation TEXT,
  p_motif TEXT,
  p_contrepartie TEXT DEFAULT NULL,
  p_lignes JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_role TEXT;
  v_etablissement_id UUID;
  v_operation_id UUID;
  v_reference TEXT;
  v_prefix TEXT;
  v_seq INTEGER;
  v_ligne JSONB;
  v_produit RECORD;
  v_stock RECORD;
  v_sens TEXT;
  v_quantite INTEGER;
  v_prix INTEGER;
  v_montant INTEGER;
  v_valeur_entree INTEGER := 0;
  v_valeur_sortie INTEGER := 0;
  v_ancienne_qte INTEGER;
  v_ancien_cout INTEGER;
  v_nouvelle_qte INTEGER;
  v_nouveau_cout INTEGER;
  v_nb_entrees INTEGER := 0;
  v_nb_sorties INTEGER := 0;
  v_type_ref TEXT;
BEGIN
  v_user_id := auth.uid();

  SELECT role, etablissement_id INTO v_role, v_etablissement_id
  FROM profiles WHERE id = v_user_id;

  IF v_etablissement_id IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non rattaché à un établissement.';
  END IF;

  IF v_role NOT IN ('comptoir', 'gerant', 'patron') THEN
    RAISE EXCEPTION 'Rôle non autorisé à effectuer une opération de stock.';
  END IF;

  IF p_type_operation NOT IN ('entree', 'sortie', 'echange') THEN
    RAISE EXCEPTION 'Type d''opération invalide: %', p_type_operation;
  END IF;

  IF p_motif IS NULL OR btrim(p_motif) = '' THEN
    RAISE EXCEPTION 'Le motif est obligatoire.';
  END IF;

  IF p_lignes IS NULL OR jsonb_array_length(p_lignes) = 0 THEN
    RAISE EXCEPTION 'Au moins une ligne est requise.';
  END IF;

  -- Référence
  v_prefix := CASE p_type_operation
    WHEN 'entree' THEN 'ENT'
    WHEN 'sortie' THEN 'SOR'
    ELSE 'ECH'
  END;

  SELECT COUNT(*) + 1 INTO v_seq
  FROM operations_stock
  WHERE date_creation >= CURRENT_DATE AND date_creation < CURRENT_DATE + 1;

  LOOP
    v_reference := v_prefix || '-' || to_char(NOW(), 'YYYYMMDD') || '-' || lpad(v_seq::text, 3, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM operations_stock WHERE reference = v_reference);
    v_seq := v_seq + 1;
  END LOOP;

  v_type_ref := CASE WHEN p_type_operation = 'echange' THEN 'echange' ELSE 'ajustement' END;

  INSERT INTO operations_stock (
    etablissement_id, reference, type_operation, motif, contrepartie, utilisateur_id
  ) VALUES (
    v_etablissement_id, v_reference, p_type_operation, p_motif, NULLIF(btrim(COALESCE(p_contrepartie, '')), ''), v_user_id
  )
  RETURNING id INTO v_operation_id;

  FOR v_ligne IN SELECT * FROM jsonb_array_elements(p_lignes)
  LOOP
    v_sens := COALESCE(NULLIF(v_ligne->>'sens', ''), p_type_operation);
    IF v_sens NOT IN ('entree', 'sortie') THEN
      RAISE EXCEPTION 'Sens invalide pour une ligne: %', v_sens;
    END IF;

    IF p_type_operation = 'entree' AND v_sens <> 'entree' THEN
      RAISE EXCEPTION 'Une opération d''entrée ne peut contenir que des entrées.';
    END IF;
    IF p_type_operation = 'sortie' AND v_sens <> 'sortie' THEN
      RAISE EXCEPTION 'Une opération de sortie ne peut contenir que des sorties.';
    END IF;

    v_quantite := COALESCE((v_ligne->>'quantite')::INTEGER, 0);
    IF v_quantite <= 0 THEN
      RAISE EXCEPTION 'Quantité invalide.';
    END IF;

    SELECT id, nom, prix_achat, prix_vente, gestion_stock
    INTO v_produit
    FROM produits
    WHERE id = (v_ligne->>'produit_id')::UUID
      AND etablissement_id = v_etablissement_id;

    IF v_produit.id IS NULL THEN
      RAISE EXCEPTION 'Produit introuvable ou hors établissement.';
    END IF;

    IF COALESCE(v_produit.gestion_stock, false) = false THEN
      RAISE EXCEPTION 'Le produit % n''a pas de suivi de stock actif.', v_produit.nom;
    END IF;

    v_prix := COALESCE((v_ligne->>'prix_unitaire')::INTEGER, 0);
    IF v_prix <= 0 THEN
      v_prix := COALESCE(v_produit.prix_achat, 0);
    END IF;

    v_montant := v_prix * v_quantite;

    SELECT * INTO v_stock FROM stocks
    WHERE produit_id = v_produit.id AND etablissement_id = v_etablissement_id;

    IF v_stock IS NULL THEN
      SELECT * INTO v_stock FROM stocks WHERE produit_id = v_produit.id LIMIT 1;
    END IF;

    IF v_sens = 'sortie' THEN
      IF v_stock IS NULL OR v_stock.quantite_actuelle < v_quantite THEN
        RAISE EXCEPTION 'Stock insuffisant pour % (disponible %, demandé %)',
          v_produit.nom, COALESCE(v_stock.quantite_actuelle, 0), v_quantite;
      END IF;

      UPDATE stocks
      SET quantite_actuelle = quantite_actuelle - v_quantite,
          derniere_mise_a_jour = NOW()
      WHERE id = v_stock.id;

      v_valeur_sortie := v_valeur_sortie + v_montant;
      v_nb_sorties := v_nb_sorties + 1;
    ELSE
      -- Entrée : upsert de la ligne de stock
      IF v_stock IS NULL THEN
        INSERT INTO stocks (produit_id, etablissement_id, quantite_actuelle, seuil_alerte, derniere_mise_a_jour)
        VALUES (v_produit.id, v_etablissement_id, 0, 10, NOW())
        RETURNING * INTO v_stock;
      END IF;

      v_ancienne_qte := COALESCE(v_stock.quantite_actuelle, 0);
      v_ancien_cout := COALESCE(v_produit.prix_achat, 0);
      v_nouvelle_qte := v_ancienne_qte + v_quantite;

      UPDATE stocks
      SET quantite_actuelle = v_nouvelle_qte,
          derniere_mise_a_jour = NOW()
      WHERE id = v_stock.id;

      -- Coût moyen pondéré (valorisation du stock)
      IF v_prix > 0 AND v_nouvelle_qte > 0 THEN
        v_nouveau_cout := ROUND(
          (v_ancienne_qte::numeric * v_ancien_cout + v_quantite::numeric * v_prix) / v_nouvelle_qte
        )::INTEGER;
        UPDATE produits SET prix_achat = v_nouveau_cout WHERE id = v_produit.id;
      END IF;

      v_valeur_entree := v_valeur_entree + v_montant;
      v_nb_entrees := v_nb_entrees + 1;
    END IF;

    INSERT INTO operations_stock_lignes (
      operation_id, produit_id, nom_produit, sens, quantite, prix_unitaire, montant_ligne
    ) VALUES (
      v_operation_id, v_produit.id, v_produit.nom, v_sens, v_quantite, v_prix, v_montant
    );

    INSERT INTO mouvements_stock (
      produit_id, etablissement_id, type, quantite, cout_unitaire,
      type_reference, reference, utilisateur_id, date_creation
    ) VALUES (
      v_produit.id, v_etablissement_id, v_sens, v_quantite, v_prix,
      v_type_ref, v_reference, v_user_id, NOW()
    );
  END LOOP;

  IF p_type_operation = 'echange' AND (v_nb_entrees = 0 OR v_nb_sorties = 0) THEN
    RAISE EXCEPTION 'Un échange doit comporter au moins une entrée et une sortie.';
  END IF;

  UPDATE operations_stock
  SET valeur_entree = v_valeur_entree,
      valeur_sortie = v_valeur_sortie,
      valeur_nette = v_valeur_entree - v_valeur_sortie
  WHERE id = v_operation_id;

  RETURN jsonb_build_object(
    'success', true,
    'operation_id', v_operation_id,
    'reference', v_reference,
    'type_operation', p_type_operation,
    'valeur_entree', v_valeur_entree,
    'valeur_sortie', v_valeur_sortie,
    'valeur_nette', v_valeur_entree - v_valeur_sortie
  );
END;
$$;

GRANT EXECUTE ON FUNCTION creer_operation_stock(TEXT, TEXT, TEXT, JSONB) TO authenticated;

-- Rafraîchir le cache de schéma PostgREST
NOTIFY pgrst, 'reload schema';
