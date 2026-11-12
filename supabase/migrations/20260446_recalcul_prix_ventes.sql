-- Migration: Recalcul rétroactif des prix de vente
-- Description:
--   Après correction des tarifs dynamiques, les ventes déjà enregistrées
--   conservent leurs anciens prix. Cette migration fournit un outil de
--   recalcul contrôlé, avec simulation préalable.
--
--   PÉRIMÈTRE STRICT :
--     * commandes de l'établissement, statut 'validee' / 'terminee',
--       créées dans la période fournie ;
--     * seules les lignes dont un tarif dynamique s'applique RÉELLEMENT
--       à l'instant de la vente sont recalculées (`get_prix_produit` non NULL).
--       Les produits sans tarif applicable gardent leur prix enregistré :
--       aucun prix négocié / manuel n'est écrasé.
--
--   EFFETS EN CASCADE (cohérence comptable) :
--     * commande_items.prix_unitaire / montant_ligne / montant_initial ;
--     * factures.montant_total ajusté par DELTA (somme des écarts de prix des
--       lignes impactées du département concerné). On ne recalcule jamais le
--       total depuis les lignes : les ajustements antérieurs (retours,
--       échanges, remises) sont donc préservés ;
--     * factures.montant_paye plafonné au nouveau total, montant_restant et
--       statut réajustés ;
--     * en cas de trop-perçu : un encaissement négatif « AJUSTEMENT-PRIX »
--       est enregistré (le trigger caisse crée automatiquement la sortie) ;
--     * commandes.montant_total = somme des factures de la commande.
--
--   MODE SIMULATION par défaut (p_dry_run = TRUE) : aucune écriture.
--
--   Idempotente : un second passage ne trouve plus de différence.
-- Created: 2026-04-46

CREATE OR REPLACE FUNCTION public.recalculer_prix_ventes(
  p_debut TIMESTAMPTZ,
  p_fin TIMESTAMPTZ,
  p_dry_run BOOLEAN DEFAULT TRUE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_profile RECORD;
  v_etab UUID;

  v_nb_commandes BIGINT := 0;
  v_nb_lignes INTEGER := 0;
  v_nb_factures INTEGER := 0;
  v_ancien_ca BIGINT := 0;
  v_nouveau_ca BIGINT := 0;
  v_trop_percu BIGINT := 0;
  v_supplement BIGINT := 0;
  v_details JSONB := '[]'::jsonb;

  r RECORD;
  v_new_paye BIGINT;
  v_overpay BIGINT;
  v_new_restant BIGINT;
  v_new_statut TEXT;
  v_last_mode TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Non authentifié.';
  END IF;

  SELECT role, etablissement_id, actif INTO v_profile
  FROM profiles WHERE id = v_uid;

  IF NOT FOUND
     OR v_profile.role IS DISTINCT FROM 'patron'
     OR COALESCE(v_profile.actif, true) <> true THEN
    RAISE EXCEPTION 'Accès refusé. Seul le patron peut recalculer les ventes.';
  END IF;

  IF v_profile.etablissement_id IS NULL THEN
    RAISE EXCEPTION 'Aucun établissement associé.';
  END IF;

  IF p_debut IS NULL OR p_fin IS NULL OR p_debut > p_fin THEN
    RAISE EXCEPTION 'Période invalide.';
  END IF;

  v_etab := v_profile.etablissement_id;

  -- ------------------------------------------------------------------------
  -- 1. Périmètre et prix cibles
  -- ------------------------------------------------------------------------
  CREATE TEMP TABLE tmp_cmd ON COMMIT DROP AS
  SELECT c.id, c.date_creation
  FROM commandes c
  WHERE c.etablissement_id = v_etab
    AND c.statut IN ('validee', 'terminee')
    AND c.date_creation >= p_debut
    AND c.date_creation <= p_fin;

  CREATE TEMP TABLE tmp_lignes ON COMMIT DROP AS
  SELECT
    ci.id AS item_id,
    ci.commande_id,
    ci.quantite,
    ci.quantite_initiale,
    ci.prix_unitaire AS ancien_prix,
    public.get_prix_produit(ci.produit_id, cmd.date_creation) AS nouveau_prix,
    LOWER(BTRIM(COALESCE(pr.categorie, ''))) AS categorie
  FROM commande_items ci
  JOIN tmp_cmd cmd ON cmd.id = ci.commande_id
  LEFT JOIN produits pr ON pr.id = ci.produit_id;

  CREATE TEMP TABLE tmp_fact ON COMMIT DROP AS
  SELECT
    f.id,
    f.commande_id,
    f.numero_facture,
    f.montant_total,
    COALESCE(f.montant_paye, 0) AS montant_paye,
    COALESCE(f.statut, '') AS statut,
    COALESCE(f.credit_sur, false) AS credit_sur,
    GREATEST(0, f.montant_total + COALESCE((
      SELECT SUM((l.nouveau_prix - l.ancien_prix) * l.quantite)
      FROM tmp_lignes l
      WHERE l.commande_id = f.commande_id
        AND l.nouveau_prix IS NOT NULL
        AND l.nouveau_prix IS DISTINCT FROM l.ancien_prix
        AND (
          (f.numero_facture LIKE '%-BAR' AND l.categorie IS DISTINCT FROM 'nourriture')
          OR (f.numero_facture LIKE '%-CUI' AND l.categorie = 'nourriture')
          OR (f.numero_facture NOT LIKE '%-BAR' AND f.numero_facture NOT LIKE '%-CUI')
        )
    ), 0))::BIGINT AS nouveau_total
  FROM factures f
  JOIN tmp_cmd c ON c.id = f.commande_id
  WHERE COALESCE(f.statut, '') <> 'annulee';

  SELECT COUNT(*) INTO v_nb_commandes FROM tmp_cmd;

  SELECT COUNT(*) INTO v_nb_lignes
  FROM tmp_lignes
  WHERE nouveau_prix IS NOT NULL
    AND nouveau_prix IS DISTINCT FROM ancien_prix;

  SELECT
    COALESCE(SUM(montant_total), 0),
    COALESCE(SUM(nouveau_total), 0),
    COUNT(*) FILTER (WHERE nouveau_total IS DISTINCT FROM montant_total)
  INTO v_ancien_ca, v_nouveau_ca, v_nb_factures
  FROM tmp_fact;

  -- ------------------------------------------------------------------------
  -- 2. Application
  -- ------------------------------------------------------------------------
  IF NOT p_dry_run THEN
    -- 2.a Lignes de commande (uniquement celles réellement tarifées)
    UPDATE commande_items ci
    SET prix_unitaire = l.nouveau_prix,
        montant_ligne = l.nouveau_prix * l.quantite,
        montant_initial = l.nouveau_prix * COALESCE(l.quantite_initiale, l.quantite)
    FROM tmp_lignes l
    WHERE ci.id = l.item_id
      AND l.nouveau_prix IS NOT NULL
      AND l.nouveau_prix IS DISTINCT FROM l.ancien_prix;

    -- 2.b Factures : montants, paiement plafonné, statut
    FOR r IN
      SELECT * FROM tmp_fact
      WHERE nouveau_total IS DISTINCT FROM montant_total
    LOOP
      v_new_paye := LEAST(r.montant_paye, r.nouveau_total);
      v_overpay := r.montant_paye - v_new_paye;
      v_new_restant := r.nouveau_total - v_new_paye;
      v_new_statut := CASE
        WHEN v_new_restant <= 0 THEN 'payee'
        WHEN v_new_paye > 0 THEN 'partiellement_payee'
        ELSE 'en_attente_paiement'
      END;

      UPDATE factures SET
        montant_total = r.nouveau_total,
        montant_paye = v_new_paye,
        montant_restant = v_new_restant,
        statut = v_new_statut,
        date_paiement_complet = CASE
          WHEN v_new_restant <= 0 THEN COALESCE(date_paiement_complet, NOW())
          ELSE NULL
        END
      WHERE id = r.id;

      SELECT e.mode_paiement INTO v_last_mode
      FROM encaissements e
      WHERE e.facture_id = r.id AND e.montant > 0
      ORDER BY e.date_encaissement DESC
      LIMIT 1;

      IF v_overpay > 0 THEN
        INSERT INTO encaissements (
          etablissement_id, facture_id, montant, mode_paiement,
          reference, utilisateur_id, date_encaissement
        ) VALUES (
          v_etab, r.id, -v_overpay, COALESCE(v_last_mode, 'especes'),
          'AJUSTEMENT-PRIX', v_uid, NOW()
        );
        v_trop_percu := v_trop_percu + v_overpay;
      ELSIF r.nouveau_total > r.montant_total THEN
        v_supplement := v_supplement + (r.nouveau_total - r.montant_total);
      END IF;
    END LOOP;

    -- 2.c Total des commandes = somme de leurs factures
    UPDATE commandes c
    SET montant_total = f.total
    FROM (
      SELECT commande_id, SUM(montant_total)::INTEGER AS total
      FROM factures
      WHERE commande_id IN (SELECT id FROM tmp_cmd)
      GROUP BY commande_id
    ) f
    WHERE c.id = f.commande_id;
  ELSE
    -- Simulation : on calcule les mêmes indicateurs sans écrire
    SELECT
      COALESCE(SUM(GREATEST(montant_paye - nouveau_total, 0)), 0),
      COALESCE(SUM(GREATEST(nouveau_total - montant_total, 0)), 0)
    INTO v_trop_percu, v_supplement
    FROM tmp_fact
    WHERE nouveau_total IS DISTINCT FROM montant_total;
  END IF;

  -- ------------------------------------------------------------------------
  -- 3. Détail (plafonné pour la lisibilité)
  -- ------------------------------------------------------------------------
  SELECT COALESCE(jsonb_agg(d ORDER BY d->>'numero_facture'), '[]'::jsonb)
  INTO v_details
  FROM (
    SELECT jsonb_build_object(
      'numero_facture', numero_facture,
      'ancien_total', montant_total,
      'nouveau_total', nouveau_total,
      'ancien_paye', montant_paye,
      'nouveau_paye', LEAST(montant_paye, nouveau_total),
      'remboursement', GREATEST(montant_paye - nouveau_total, 0),
      'nouveau_restant', nouveau_total - LEAST(montant_paye, nouveau_total)
    ) AS d
    FROM tmp_fact
    WHERE nouveau_total IS DISTINCT FROM montant_total
    LIMIT 200
  ) x;

  RETURN json_build_object(
    'dry_run', p_dry_run,
    'periode', json_build_object('debut', p_debut, 'fin', p_fin),
    'commandes', v_nb_commandes,
    'lignes_modifiees', v_nb_lignes,
    'factures_ajustees', v_nb_factures,
    'ancien_ca', v_ancien_ca,
    'nouveau_ca', v_nouveau_ca,
    'delta_ca', v_nouveau_ca - v_ancien_ca,
    'trop_percu', v_trop_percu,
    'supplement', v_supplement,
    'details', v_details
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalculer_prix_ventes(TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN) TO authenticated;

COMMENT ON FUNCTION public.recalculer_prix_ventes(TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN) IS
  'Recalcule les prix dynamiques des ventes déjà réalisées (simulation par défaut) et réajuste factures, encaissements et caisse.';

NOTIFY pgrst, 'reload schema';
