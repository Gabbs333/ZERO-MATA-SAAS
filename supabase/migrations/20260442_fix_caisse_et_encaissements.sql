-- Migration: Réparation de la chaîne caisse + encaissements
-- Description:
--   Symptômes corrigés :
--     1. La caisse affiche 0 malgré les ventes : les encaissements ne sont plus
--        répercutés dans `mouvements_caisse` (trigger absent/en échec silencieux).
--     2. Les montants « encaissés » ne se réconcilient pas avec le CA moins les
--        impayés (paiements d'anciennes factures + double comptage éventuel).
--
--   Actions :
--     A. Trigger réécrit : robuste, idempotent, gère les remboursements
--        (montant négatif => sortie de caisse) et n'écrit plus un établissement
--        factice en cas de donnée manquante.
--     B. Rattrapage de tous les encaissements absents de mouvements_caisse.
--     C. get_solde_caisse() recalculé en fuseau établissement et sans double
--        comptage : solde = entrées hors ventes + encaissements réels - sorties.
-- Created: 2026-04-42

-- ============================================================================
-- A. TRIGGER D'ALIMENTATION DE LA CAISSE
-- ============================================================================

CREATE OR REPLACE FUNCTION public.record_encaissement_mouvement_caisse()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_etab UUID;
  v_numero TEXT;
  v_mode TEXT;
BEGIN
  IF NEW.montant IS NULL OR NEW.montant = 0 THEN
    RETURN NEW;
  END IF;

  -- Idempotence : un encaissement ne génère qu'un seul mouvement de caisse
  IF EXISTS (SELECT 1 FROM mouvements_caisse WHERE encaissement_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  SELECT f.etablissement_id, f.numero_facture
  INTO v_etab, v_numero
  FROM factures f
  WHERE f.id = NEW.facture_id;

  IF v_etab IS NULL THEN
    v_etab := NEW.etablissement_id;
  END IF;

  IF v_etab IS NULL THEN
    SELECT etablissement_id INTO v_etab FROM profiles WHERE id = NEW.utilisateur_id;
  END IF;

  IF v_etab IS NULL THEN
    RAISE WARNING 'Encaissement % non répercuté en caisse : établissement introuvable', NEW.id;
    RETURN NEW;
  END IF;

  -- `mouvements_caisse` n'accepte que ce jeu de valeurs
  v_mode := CASE
    WHEN NEW.mode_paiement IN ('especes', 'mobile_money', 'carte_bancaire', 'cheque', 'virement')
      THEN NEW.mode_paiement
    WHEN NEW.mode_paiement = 'carte' THEN 'carte_bancaire'
    ELSE 'especes'
  END;

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
      v_etab,
      CASE WHEN NEW.montant > 0 THEN 'entree' ELSE 'sortie' END,
      ABS(NEW.montant),
      CASE WHEN NEW.montant > 0 THEN 'Vente - ' ELSE 'Remboursement - ' END
        || COALESCE(v_numero, 'Facture'),
      v_mode,
      CASE WHEN NEW.montant > 0
           THEN 'Encaissement vente automatique'
           ELSE 'Remboursement automatique' END,
      NEW.utilisateur_id,
      COALESCE(NEW.date_encaissement, NOW()),
      NEW.id
    );
  EXCEPTION WHEN OTHERS THEN
    -- La vente ne doit jamais échouer à cause de la tenue de caisse
    RAISE WARNING 'Trigger caisse (encaissement %): %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_encaissement_to_mouvement_caisse ON public.encaissements;
CREATE TRIGGER trigger_encaissement_to_mouvement_caisse
  AFTER INSERT ON public.encaissements
  FOR EACH ROW
  EXECUTE FUNCTION public.record_encaissement_mouvement_caisse();

-- ============================================================================
-- B. RATTRAPAGE DES ENCAISSEMENTS NON RÉPERCUTÉS
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
  COALESCE(f.etablissement_id, e.etablissement_id, p.etablissement_id),
  CASE WHEN e.montant > 0 THEN 'entree' ELSE 'sortie' END,
  ABS(e.montant),
  CASE WHEN e.montant > 0 THEN 'Vente - ' ELSE 'Remboursement - ' END
    || COALESCE(f.numero_facture, 'Facture'),
  CASE
    WHEN e.mode_paiement IN ('especes', 'mobile_money', 'carte_bancaire', 'cheque', 'virement')
      THEN e.mode_paiement
    WHEN e.mode_paiement = 'carte' THEN 'carte_bancaire'
    ELSE 'especes'
  END,
  'Rattrapage automatique',
  e.utilisateur_id,
  COALESCE(e.date_encaissement, NOW()),
  e.id
FROM encaissements e
LEFT JOIN factures f ON f.id = e.facture_id
LEFT JOIN profiles p ON p.id = e.utilisateur_id
WHERE e.montant IS NOT NULL
  AND e.montant <> 0
  AND NOT EXISTS (
    SELECT 1 FROM mouvements_caisse mc WHERE mc.encaissement_id = e.id
  )
  AND COALESCE(f.etablissement_id, e.etablissement_id, p.etablissement_id) IS NOT NULL;

-- ============================================================================
-- C. SOLDE DE CAISSE SANS DOUBLE COMPTAGE
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_solde_caisse(p_date DATE DEFAULT CURRENT_DATE)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_etab UUID;
  v_tz TEXT;
  v_entrees_total BIGINT := 0;
  v_entrees_ventes BIGINT := 0;
  v_sorties BIGINT := 0;
  v_ventes BIGINT := 0;
  v_theorique BIGINT := 0;
BEGIN
  SELECT etablissement_id INTO v_etab FROM profiles WHERE id = auth.uid();

  IF v_etab IS NULL THEN
    RETURN json_build_object(
      'date', p_date,
      'entrees_caisse', 0,
      'sorties_caisse', 0,
      'encaissements_ventes', 0,
      'solde_theorique', 0
    );
  END IF;

  SELECT COALESCE(fuseau_horaire, 'Africa/Douala') INTO v_tz
  FROM etablissements WHERE id = v_etab;
  v_tz := COALESCE(v_tz, 'Africa/Douala');

  SELECT
    COALESCE(SUM(CASE WHEN type = 'entree' THEN montant END), 0),
    COALESCE(SUM(CASE WHEN type = 'entree' AND encaissement_id IS NOT NULL THEN montant END), 0),
    COALESCE(SUM(CASE WHEN type = 'sortie' THEN montant END), 0)
  INTO v_entrees_total, v_entrees_ventes, v_sorties
  FROM mouvements_caisse
  WHERE etablissement_id = v_etab
    AND (date_creation AT TIME ZONE v_tz)::date = p_date;

  -- Source de vérité des ventes : la table encaissements (les remboursements
  -- y sont négatifs et viennent donc en déduction).
  SELECT COALESCE(SUM(e.montant), 0)
  INTO v_ventes
  FROM encaissements e
  LEFT JOIN factures f ON f.id = e.facture_id
  WHERE COALESCE(e.etablissement_id, f.etablissement_id) = v_etab
    AND (e.date_encaissement AT TIME ZONE v_tz)::date = p_date;

  v_theorique := (v_entrees_total - v_entrees_ventes) + v_ventes - v_sorties;

  RETURN json_build_object(
    'date', p_date,
    'entrees_caisse', v_entrees_total - v_entrees_ventes,
    'entrees_totales', v_entrees_total,
    'sorties_caisse', v_sorties,
    'encaissements_ventes', v_ventes,
    'solde_theorique', v_theorique
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_solde_caisse(DATE) TO authenticated;

NOTIFY pgrst, 'reload schema';
