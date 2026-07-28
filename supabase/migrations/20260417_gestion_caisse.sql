-- ============================================================================
-- GESTION DE CAISSE : Table, RLS, Fonctions RPC
-- Permet d'enregistrer les mouvements physiques de caisse
-- (hors ventes et ravitaillements) pour la cloture journaliere
-- ============================================================================

-- ============================================================================
-- TABLE: mouvements_caisse
-- ============================================================================

CREATE TABLE IF NOT EXISTS mouvements_caisse (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  etablissement_id UUID NOT NULL REFERENCES etablissements(id) ON DELETE RESTRICT,
  type TEXT NOT NULL CHECK (type IN ('entree', 'sortie')),
  montant INTEGER NOT NULL CHECK (montant > 0),
  motif TEXT NOT NULL,
  mode_paiement TEXT DEFAULT 'especes' CHECK (mode_paiement IN ('especes', 'mobile_money', 'carte_bancaire', 'cheque', 'virement')),
  commentaire TEXT,
  utilisateur_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  date_creation TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mouvements_caisse_etablissement ON mouvements_caisse(etablissement_id);
CREATE INDEX IF NOT EXISTS idx_mouvements_caisse_date ON mouvements_caisse(date_creation);
CREATE INDEX IF NOT EXISTS idx_mouvements_caisse_type ON mouvements_caisse(type);
CREATE INDEX IF NOT EXISTS idx_mouvements_caisse_utilisateur ON mouvements_caisse(utilisateur_id);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE mouvements_caisse ENABLE ROW LEVEL SECURITY;

-- SELECT: Personnel de l'etablissement peut lire
CREATE POLICY "mouvements_caisse_select_etablissement"
  ON mouvements_caisse FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('serveuse', 'comptoir', 'gerant', 'patron')
      AND actif = true
      AND etablissement_id = mouvements_caisse.etablissement_id
    )
  );

-- INSERT: Comptoir, gerant et patron peuvent creer
CREATE POLICY "mouvements_caisse_insert_etablissement"
  ON mouvements_caisse FOR INSERT
  TO authenticated
  WITH CHECK (
    utilisateur_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('comptoir', 'gerant', 'patron')
      AND actif = true
      AND etablissement_id = mouvements_caisse.etablissement_id
    )
  );

-- UPDATE: Interdit (les mouvements sont immuables)
CREATE POLICY "mouvements_caisse_no_update"
  ON mouvements_caisse FOR UPDATE
  USING (false);

-- DELETE: Interdit
CREATE POLICY "mouvements_caisse_no_delete"
  ON mouvements_caisse FOR DELETE
  USING (false);

-- Admin: lecture transversale
CREATE POLICY "mouvements_caisse_admin_read_all"
  ON mouvements_caisse FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- FONCTION RPC: creer_mouvement_caisse
-- ============================================================================

CREATE OR REPLACE FUNCTION creer_mouvement_caisse(
  p_type TEXT,
  p_montant INTEGER,
  p_motif TEXT,
  p_mode_paiement TEXT DEFAULT 'especes',
  p_commentaire TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_etablissement_id UUID;
  v_mouvement_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  SELECT etablissement_id INTO v_etablissement_id
  FROM profiles
  WHERE id = v_user_id;
  
  IF v_etablissement_id IS NULL THEN
    RAISE EXCEPTION 'Etablissement non trouve.';
  END IF;
  
  IF p_type NOT IN ('entree', 'sortie') THEN
    RAISE EXCEPTION 'Type invalide. Utilisez entree ou sortie.';
  END IF;
  
  IF p_montant <= 0 THEN
    RAISE EXCEPTION 'Le montant doit etre superieur a 0.';
  END IF;
  
  INSERT INTO mouvements_caisse (
    etablissement_id,
    type,
    montant,
    motif,
    mode_paiement,
    commentaire,
    utilisateur_id
  ) VALUES (
    v_etablissement_id,
    p_type,
    p_montant,
    p_motif,
    p_mode_paiement,
    p_commentaire,
    v_user_id
  )
  RETURNING id INTO v_mouvement_id;
  
  RETURN json_build_object(
    'success', true,
    'mouvement_id', v_mouvement_id,
    'type', p_type,
    'montant', p_montant
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erreur creation mouvement caisse: %', SQLERRM;
END;
$$;

-- ============================================================================
-- FONCTION RPC: get_solde_caisse
-- Retourne le solde theorique de la caisse pour une journee donnee
-- = Solde ouverture + entrees - sorties + ventes encaissees
-- ============================================================================

CREATE OR REPLACE FUNCTION get_solde_caisse(
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_etablissement_id UUID;
  v_entrees_caisse BIGINT;
  v_sorties_caisse BIGINT;
  v_encaissements_ventes BIGINT;
  v_solde_theorique BIGINT;
BEGIN
  SELECT etablissement_id INTO v_etablissement_id
  FROM profiles
  WHERE id = auth.uid();
  
  -- Mouvements caisse du jour
  SELECT COALESCE(SUM(montant), 0) INTO v_entrees_caisse
  FROM mouvements_caisse
  WHERE etablissement_id = v_etablissement_id
  AND type = 'entree'
  AND date_creation::DATE = p_date;
  
  SELECT COALESCE(SUM(montant), 0) INTO v_sorties_caisse
  FROM mouvements_caisse
  WHERE etablissement_id = v_etablissement_id
  AND type = 'sortie'
  AND date_creation::DATE = p_date;
  
  -- Encaissements du jour (ventes)
  SELECT COALESCE(SUM(e.montant), 0) INTO v_encaissements_ventes
  FROM encaissements e
  JOIN factures f ON e.facture_id = f.id
  WHERE f.etablissement_id = v_etablissement_id
  AND e.date_encaissement::DATE = p_date;
  
  v_solde_theorique := v_entrees_caisse + v_encaissements_ventes - v_sorties_caisse;
  
  RETURN json_build_object(
    'date', p_date,
    'entrees_caisse', v_entrees_caisse,
    'sorties_caisse', v_sorties_caisse,
    'encaissements_ventes', v_encaissements_ventes,
    'solde_theorique', v_solde_theorique
  );
END;
$$;

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT, INSERT ON mouvements_caisse TO authenticated;
GRANT EXECUTE ON FUNCTION creer_mouvement_caisse(TEXT, INTEGER, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_solde_caisse(DATE) TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE mouvements_caisse IS 'Mouvements physiques de caisse hors ventes : apports, retraits, depenses diverses';
COMMENT ON FUNCTION creer_mouvement_caisse IS 'Cree un mouvement de caisse (entree ou sortie)';
COMMENT ON FUNCTION get_solde_caisse IS 'Calcule le solde theorique de caisse pour une date donnee';
