-- Migration: Enregistrer automatiquement les ventes (encaissements) comme entrées de caisse
-- Description: Lie chaque encaissement de vente à la table mouvements_caisse (type = 'entree')
-- avec des fallbacks robustes pour garantir l'enregistrement des ventes de boissons et plats.

-- ============================================================================
-- 1. AJOUT DE LA COLONNE encaissement_id SUR mouvements_caisse
-- ============================================================================

ALTER TABLE mouvements_caisse
ADD COLUMN IF NOT EXISTS encaissement_id UUID REFERENCES encaissements(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_mouvements_caisse_encaissement ON mouvements_caisse(encaissement_id);

-- ============================================================================
-- 2. TRIGGER ROBUSTE SUR encaissements
-- ============================================================================

CREATE OR REPLACE FUNCTION record_encaissement_mouvement_caisse()
RETURNS TRIGGER AS $$
DECLARE
  v_etablissement_id UUID;
  v_numero_facture TEXT;
BEGIN
  -- Récupérer l'établissement et le numéro de facture depuis la facture liée
  SELECT f.etablissement_id, f.numero_facture
  INTO v_etablissement_id, v_numero_facture
  FROM factures f
  WHERE f.id = NEW.facture_id;

  -- Fallbacks successifs si etablissement_id est NULL
  IF v_etablissement_id IS NULL THEN
    v_etablissement_id := NEW.etablissement_id;
  END IF;

  IF v_etablissement_id IS NULL THEN
    SELECT etablissement_id INTO v_etablissement_id FROM profiles WHERE id = NEW.utilisateur_id;
  END IF;

  IF v_etablissement_id IS NULL THEN
    SELECT id INTO v_etablissement_id FROM etablissements LIMIT 1;
  END IF;

  -- Insertion sécurisée dans mouvements_caisse
  BEGIN
    INSERT INTO mouvements_caisse (
      etablissement_id,
      type,
      montant,
      motif,
      mode_paiement,
      commentaire,
      utilisateur_id,
      date_creation,
      encaissement_id
    ) VALUES (
      COALESCE(v_etablissement_id, '00000000-0000-0000-0000-000000000000'::UUID),
      'entree',
      NEW.montant,
      'Vente - ' || COALESCE(v_numero_facture, 'Facture'),
      COALESCE(NEW.mode_paiement, 'especes'),
      'Encaissement vente automatique',
      NEW.utilisateur_id,
      COALESCE(NEW.date_encaissement, NOW()),
      NEW.id
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Trigger record_encaissement_mouvement_caisse warning: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_encaissement_to_mouvement_caisse ON encaissements;
CREATE TRIGGER trigger_encaissement_to_mouvement_caisse
  AFTER INSERT ON encaissements
  FOR EACH ROW
  EXECUTE FUNCTION record_encaissement_mouvement_caisse();

-- ============================================================================
-- 3. RETRO-ACTIF : INSÉRER TOUS LES ENCAISSEMENTS PASSÉS DANS mouvements_caisse
-- ============================================================================

INSERT INTO mouvements_caisse (
  etablissement_id,
  type,
  montant,
  motif,
  mode_paiement,
  commentaire,
  utilisateur_id,
  date_creation,
  encaissement_id
)
SELECT 
  COALESCE(e.etablissement_id, f.etablissement_id, (SELECT id FROM etablissements LIMIT 1)),
  'entree',
  e.montant,
  'Vente - ' || COALESCE(f.numero_facture, 'Facture'),
  COALESCE(e.mode_paiement, 'especes'),
  'Encaissement vente rétroactif',
  e.utilisateur_id,
  COALESCE(e.date_encaissement, NOW()),
  e.id
FROM encaissements e
LEFT JOIN factures f ON e.facture_id = f.id
WHERE NOT EXISTS (
  SELECT 1 FROM mouvements_caisse mc WHERE mc.encaissement_id = e.id
);

-- ============================================================================
-- 4. MISE À JOUR DE LA FONCTION RPC get_solde_caisse
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
  
  -- Total des entrées de caisse (inclut les ventes)
  SELECT COALESCE(SUM(montant), 0) INTO v_entrees_caisse
  FROM mouvements_caisse
  WHERE etablissement_id = v_etablissement_id
  AND type = 'entree'
  AND date_creation::DATE = p_date;
  
  -- Total des sorties de caisse
  SELECT COALESCE(SUM(montant), 0) INTO v_sorties_caisse
  FROM mouvements_caisse
  WHERE etablissement_id = v_etablissement_id
  AND type = 'sortie'
  AND date_creation::DATE = p_date;
  
  -- Total des ventes par encaissements du jour
  SELECT COALESCE(SUM(montant), 0) INTO v_encaissements_ventes
  FROM mouvements_caisse
  WHERE etablissement_id = v_etablissement_id
  AND encaissement_id IS NOT NULL
  AND date_creation::DATE = p_date;
  
  v_solde_theorique := v_entrees_caisse - v_sorties_caisse;
  
  RETURN json_build_object(
    'date', p_date,
    'entrees_caisse', v_entrees_caisse,
    'sorties_caisse', v_sorties_caisse,
    'encaissements_ventes', v_encaissements_ventes,
    'solde_theorique', v_solde_theorique
  );
END;
$$;
