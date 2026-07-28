-- ============================================================================
-- CORRECTIF: Nettoyage et reconstruction des politiques RLS pour encaissements
-- Probleme: Accumulation de politiques RLS conflictuelles de plusieurs migrations
-- Solution: Supprimer TOUTES les politiques, recreer proprement
-- ============================================================================

-- ============================================================================
-- PHASE 1: Supprimer TOUTES les politiques existantes sur encaissements
-- ============================================================================

-- Politiques de 20240116000002 (deja droppees par multi-tenant mais on verifie)
DROP POLICY IF EXISTS "Comptoir can read all encaissements" ON encaissements;
DROP POLICY IF EXISTS "Comptoir can insert encaissements" ON encaissements;

-- Politiques de 20240121000002 (jamais droppees !)
DROP POLICY IF EXISTS "comptoir_create_encaissements" ON encaissements;
DROP POLICY IF EXISTS "comptoir_patron_gerant_read_encaissements" ON encaissements;
DROP POLICY IF EXISTS "no_update_encaissements" ON encaissements;
DROP POLICY IF EXISTS "no_delete_encaissements" ON encaissements;

-- Politiques de 20240128000005 (multi-tenant)
DROP POLICY IF EXISTS "comptoir_read_establishment_encaissements" ON encaissements;
DROP POLICY IF EXISTS "comptoir_insert_encaissements" ON encaissements;

-- Politiques de 20240128000006 (admin)
DROP POLICY IF EXISTS "admin_read_all_encaissements" ON encaissements;

-- ============================================================================
-- PHASE 2: Verifier et corriger la contrainte CHECK sur montant
-- ============================================================================

-- Permettre les montants negatifs pour les remboursements (retours)
ALTER TABLE encaissements 
  DROP CONSTRAINT IF EXISTS encaissements_montant_check;

ALTER TABLE encaissements 
  ADD CONSTRAINT encaissements_montant_check 
  CHECK (montant <> 0);

-- ============================================================================
-- PHASE 3: Recréer les politiques RLS propres
-- ============================================================================

-- SELECT: Tout le personnel de l'etablissement peut lire les encaissements
CREATE POLICY "encaissements_select_etablissement"
  ON encaissements FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('serveuse', 'comptoir', 'gerant', 'patron')
      AND actif = true
      AND etablissement_id = encaissements.etablissement_id
    )
  );

-- INSERT: Comptoir, gerant et patron peuvent creer des encaissements
CREATE POLICY "encaissements_insert_etablissement"
  ON encaissements FOR INSERT
  TO authenticated
  WITH CHECK (
    utilisateur_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('comptoir', 'gerant', 'patron')
      AND actif = true
      AND etablissement_id = encaissements.etablissement_id
    )
  );

-- UPDATE: Interdit (les encaissements sont immuables)
CREATE POLICY "encaissements_no_update"
  ON encaissements FOR UPDATE
  USING (false);

-- DELETE: Interdit
CREATE POLICY "encaissements_no_delete"
  ON encaissements FOR DELETE
  USING (false);

-- Admin: lecture transversale de tous les encaissements
CREATE POLICY "encaissements_admin_read_all"
  ON encaissements FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- PHASE 4: Mettre a jour la fonction create_encaissement
-- ============================================================================

DROP FUNCTION IF EXISTS create_encaissement(UUID, INTEGER, TEXT, TEXT);

CREATE OR REPLACE FUNCTION create_encaissement(
  p_facture_id UUID,
  p_montant INTEGER,
  p_mode_paiement TEXT,
  p_reference TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  facture_id UUID,
  montant INTEGER,
  mode_paiement TEXT,
  reference TEXT,
  utilisateur_id UUID,
  etablissement_id UUID,
  date_encaissement TIMESTAMPTZ
) AS $$
DECLARE
  v_facture RECORD;
  v_encaissement_id UUID;
  v_user_id UUID;
  v_etablissement_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  SELECT etablissement_id INTO v_etablissement_id
  FROM profiles
  WHERE id = v_user_id;
  
  IF v_etablissement_id IS NULL THEN
    RAISE EXCEPTION 'Etablissement non trouve pour l''utilisateur.';
  END IF;

  IF p_mode_paiement NOT IN ('especes', 'mobile_money', 'carte_bancaire') THEN
    RAISE EXCEPTION 'Mode de paiement invalide: %. Modes acceptes: especes, mobile_money, carte_bancaire', p_mode_paiement;
  END IF;
  
  SELECT * INTO v_facture
  FROM factures
  WHERE id = p_facture_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Facture introuvable: %', p_facture_id;
  END IF;
  
  IF p_montant > 0 AND p_montant > COALESCE(v_facture.montant_restant, v_facture.montant_total - COALESCE(v_facture.montant_paye, 0)) THEN
    RAISE EXCEPTION 'Le montant (%) depasse le reste a payer de la facture.', p_montant;
  END IF;
  
  INSERT INTO encaissements (
    facture_id,
    montant,
    mode_paiement,
    reference,
    utilisateur_id,
    etablissement_id
  ) VALUES (
    p_facture_id,
    p_montant,
    p_mode_paiement,
    p_reference,
    v_user_id,
    v_etablissement_id
  )
  RETURNING 
    encaissements.id,
    encaissements.facture_id,
    encaissements.montant,
    encaissements.mode_paiement,
    encaissements.reference,
    encaissements.utilisateur_id,
    encaissements.etablissement_id,
    encaissements.date_encaissement
  INTO 
    v_encaissement_id,
    p_facture_id,
    p_montant,
    p_mode_paiement,
    p_reference,
    v_user_id,
    v_etablissement_id,
    date_encaissement;
  
  RETURN QUERY
  SELECT 
    v_encaissement_id,
    p_facture_id,
    p_montant,
    p_mode_paiement,
    p_reference,
    v_user_id,
    v_etablissement_id,
    NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- PHASE 5: Droits d'acces
-- ============================================================================

GRANT SELECT, INSERT ON encaissements TO authenticated;
GRANT EXECUTE ON FUNCTION create_encaissement(UUID, INTEGER, TEXT, TEXT) TO authenticated;

-- ============================================================================
-- VERIFICATION FINALE
-- ============================================================================

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM pg_policies
  WHERE tablename = 'encaissements';
  
  RAISE NOTICE 'Nombre de politiques sur encaissements: %', v_count;
  
  IF v_count != 5 THEN
    RAISE WARNING 'ATTENTION: Nombre inattendu de politiques sur encaissements (attendu: 5, trouve: %)', v_count;
  END IF;
END $$;
