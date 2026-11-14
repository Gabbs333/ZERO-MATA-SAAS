-- Migration: Prix dynamique pour la valorisation du stock
-- Description:
--   1. `get_prix_produit()` résout désormais les règles tarifaires dans le
--      **fuseau horaire de l'établissement** (et non dans celui de la base).
--      Impact : les tarifs par jour de semaine et par heure (happy hour,
--      nuit) s'appliquent à l'heure locale, comme à la caisse. Sans effet
--      sur les tarifs sans condition horaire.
--   2. `stock_session_detail()` valorise le stock au **prix dynamique** :
--        - ouverture  -> prix applicable à l'instant d'ouverture du shift
--        - clôture    -> prix applicable à l'instant de clôture
--        - comptage   -> prix applicable au moment de la passation, figé
--                        dans `comptages_shift.prix_vente_unitaire`
--      Le prix moyen réellement pratiqué et le prix catalogue restent
--      exposés à titre de comparaison, mais ne servent plus à la valorisation.
--
--   Aucune donnée historique n'est modifiée (les comptages déjà enregistrés
--   conservent leur prix figé).
-- Created: 2026-04-56

-- ============================================================================
-- 1. get_prix_produit() — fuseau horaire de l'établissement
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_prix_produit(
  p_produit_id UUID,
  p_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prix INTEGER;
  v_tz TEXT;
  v_local TIMESTAMP;
BEGIN
  SELECT COALESCE(e.fuseau_horaire, 'Africa/Douala')
  INTO v_tz
  FROM produits p
  LEFT JOIN etablissements e ON e.id = p.etablissement_id
  WHERE p.id = p_produit_id;

  v_tz := COALESCE(v_tz, 'Africa/Douala');
  -- Heure locale de l'établissement : c'est elle qui porte les règles tarifaires
  v_local := (COALESCE(p_at, NOW())) AT TIME ZONE v_tz;

  SELECT t.prix_vente
  INTO v_prix
  FROM tarifs_specifiques t
  WHERE t.produit_id = p_produit_id
    AND COALESCE(t.actif, true) = true
    AND (t.date_debut IS NULL OR t.date_debut::DATE <= v_local::DATE)
    AND (t.date_fin IS NULL OR t.date_fin::DATE >= v_local::DATE)
    AND (
      t.jours_semaine IS NULL
      OR array_length(t.jours_semaine, 1) IS NULL
      OR EXTRACT(DOW FROM v_local)::INTEGER = ANY (t.jours_semaine)
    )
    AND (
      t.heure_debut IS NULL
      OR t.heure_fin IS NULL
      OR (t.heure_debut <= t.heure_fin AND v_local::TIME >= t.heure_debut AND v_local::TIME <= t.heure_fin)
      OR (t.heure_debut > t.heure_fin AND (v_local::TIME >= t.heure_debut OR v_local::TIME <= t.heure_fin))
    )
  ORDER BY COALESCE(t.priorite, 0) DESC, t.date_creation DESC
  LIMIT 1;

  RETURN v_prix; -- NULL si aucun tarif applicable → repli sur produits.prix_vente
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_prix_produit(UUID, TIMESTAMPTZ) TO authenticated;

COMMENT ON FUNCTION public.get_prix_produit(UUID, TIMESTAMPTZ) IS
  'Prix de vente applicable à un produit à un instant donné, règles évaluées dans le fuseau de l''établissement (NULL si aucun tarif).';

-- ============================================================================
-- 2. stock_session_detail() — valorisation au prix dynamique
-- ============================================================================

-- ============================================================================
-- stock_session_detail() v3 — prix dynamique
-- ============================================================================

-- Toutes les surcharges sont retirées (le nombre de colonnes de sortie change).
DO $drop_stock_session_detail$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'stock_session_detail'
  LOOP
    EXECUTE format('DROP FUNCTION %s', r.signature);
  END LOOP;
END
$drop_stock_session_detail$;

CREATE FUNCTION public.stock_session_detail(
  p_etablissement_id UUID,
  p_debut TIMESTAMPTZ,
  p_fin TIMESTAMPTZ,
  p_business_date DATE,
  p_session_id UUID DEFAULT NULL
)
RETURNS TABLE (
  produit_id UUID,
  produit_nom TEXT,
  categorie TEXT,
  departement TEXT,
  cout_unitaire INTEGER,
  qte_ouverture INTEGER,
  valeur_ouverture INTEGER,
  qte_entrees INTEGER,
  valeur_entrees INTEGER,
  qte_vendues INTEGER,
  valeur_vendues INTEGER,
  qte_sorties_autres INTEGER,
  valeur_sorties_autres INTEGER,
  qte_cloture INTEGER,
  valeur_cloture INTEGER,
  qte_ajustements INTEGER,
  valeur_ajustements INTEGER,
  qte_comptee INTEGER,
  ecart_qte_comptage INTEGER,
  ecart_valeur_comptage INTEGER,
  compte_le TIMESTAMPTZ,
  qte_comptee_jour INTEGER,
  ecart_qte_jour INTEGER,
  ecart_valeur_jour INTEGER,
  prix_vente INTEGER,
  prix_vente_ouverture INTEGER,
  prix_vente_catalogue INTEGER,
  prix_vente_moyen INTEGER,
  valeur_vente_ouverture INTEGER,
  valeur_vente_cloture INTEGER,
  ecart_valeur_vente_comptage INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH prod AS (
    SELECT
      p.id,
      p.nom,
      p.categorie,
      COALESCE(p.prix_achat, 0) AS cout,
      COALESCE(p.prix_vente, 0) AS pv,
      COALESCE(st.quantite_actuelle, 0) AS qte_actuelle
    FROM produits p
    LEFT JOIN stocks st
      ON st.produit_id = p.id
     AND st.etablissement_id = p_etablissement_id
    WHERE p.etablissement_id = p_etablissement_id
      AND COALESCE(p.gestion_stock, false) = true
  ),
  mv AS (
    SELECT
      m.produit_id,
      SUM(CASE WHEN m.type = 'entree' THEN m.quantite ELSE -m.quantite END)
        FILTER (WHERE m.date_creation > p_fin) AS delta_apres,
      SUM(CASE WHEN m.type = 'entree' THEN m.quantite ELSE -m.quantite END)
        FILTER (WHERE m.date_creation >= p_debut AND m.date_creation <= p_fin) AS delta_session,
      COALESCE(SUM(CASE WHEN m.type = 'entree' THEN m.quantite ELSE 0 END)
        FILTER (WHERE m.date_creation >= p_debut AND m.date_creation <= p_fin
                  AND COALESCE(m.type_reference, '') <> 'ajustement'), 0) AS q_entrees,
      COALESCE(SUM(CASE WHEN m.type = 'entree'
                        THEN m.quantite * COALESCE(m.cout_unitaire, p.cout, 0) ELSE 0 END)
        FILTER (WHERE m.date_creation >= p_debut AND m.date_creation <= p_fin
                  AND COALESCE(m.type_reference, '') <> 'ajustement'), 0) AS v_entrees,
      COALESCE(SUM(CASE WHEN m.type = 'sortie' AND m.type_reference = 'commande'
                        THEN m.quantite ELSE 0 END)
        FILTER (WHERE m.date_creation >= p_debut AND m.date_creation <= p_fin), 0) AS q_vendues,
      COALESCE(SUM(CASE WHEN m.type = 'sortie' AND m.type_reference = 'commande'
                        THEN m.quantite * COALESCE(m.cout_unitaire, p.cout, 0) ELSE 0 END)
        FILTER (WHERE m.date_creation >= p_debut AND m.date_creation <= p_fin), 0) AS v_vendues,
      COALESCE(SUM(CASE WHEN m.type = 'sortie'
                         AND COALESCE(m.type_reference, '') NOT IN ('commande', 'ajustement')
                        THEN m.quantite ELSE 0 END)
        FILTER (WHERE m.date_creation >= p_debut AND m.date_creation <= p_fin), 0) AS q_autres,
      COALESCE(SUM(CASE WHEN m.type = 'sortie'
                         AND COALESCE(m.type_reference, '') NOT IN ('commande', 'ajustement')
                        THEN m.quantite * COALESCE(m.cout_unitaire, p.cout, 0) ELSE 0 END)
        FILTER (WHERE m.date_creation >= p_debut AND m.date_creation <= p_fin), 0) AS v_autres,
      COALESCE(SUM(CASE WHEN COALESCE(m.type_reference, '') = 'ajustement'
                        THEN CASE WHEN m.type = 'entree' THEN m.quantite ELSE -m.quantite END
                        ELSE 0 END)
        FILTER (WHERE m.date_creation >= p_debut AND m.date_creation <= p_fin), 0) AS q_ajust,
      COALESCE(SUM(CASE WHEN COALESCE(m.type_reference, '') = 'ajustement'
                        THEN CASE WHEN m.type = 'entree' THEN m.quantite ELSE -m.quantite END
                             * COALESCE(m.cout_unitaire, p.cout, 0)
                        ELSE 0 END)
        FILTER (WHERE m.date_creation >= p_debut AND m.date_creation <= p_fin), 0) AS v_ajust
    FROM mouvements_stock m
    JOIN prod p ON p.id = m.produit_id
    WHERE m.etablissement_id = p_etablissement_id
    GROUP BY m.produit_id
  ),
  ventes AS (
    -- Prix moyen réellement pratiqué sur la fenêtre du shift
    SELECT
      ci.produit_id,
      SUM(ci.quantite) AS qte,
      SUM(ci.montant_ligne) AS montant
    FROM commande_items ci
    JOIN commandes c ON c.id = ci.commande_id
    WHERE c.etablissement_id = p_etablissement_id
      AND c.statut IN ('validee', 'terminee')
      AND COALESCE(c.date_validation, c.date_creation) >= p_debut
      AND COALESCE(c.date_validation, c.date_creation) <= p_fin
    GROUP BY ci.produit_id
  ),
  calc AS (
    SELECT
      pr.id AS produit_id,
      pr.nom AS produit_nom,
      pr.categorie,
      CASE WHEN LOWER(BTRIM(COALESCE(pr.categorie, ''))) = 'nourriture'
           THEN 'cuisine' ELSE 'bar' END AS departement,
      pr.cout AS cout_unitaire,
      pr.pv AS prix_vente_catalogue,
      COALESCE(public.get_prix_produit(pr.id, p_fin), pr.pv) AS prix_vente,
      COALESCE(public.get_prix_produit(pr.id, p_debut), pr.pv) AS prix_vente_ouverture,
      CASE WHEN COALESCE(v.qte, 0) > 0
           THEN ROUND(v.montant::NUMERIC / v.qte)::INTEGER
           ELSE NULL END AS prix_vente_moyen,
      COALESCE(mv.q_entrees, 0) AS qte_entrees,
      COALESCE(mv.v_entrees, 0) AS valeur_entrees,
      COALESCE(mv.q_vendues, 0) AS qte_vendues,
      COALESCE(mv.v_vendues, 0) AS valeur_vendues,
      COALESCE(mv.q_autres, 0) AS qte_sorties_autres,
      COALESCE(mv.v_autres, 0) AS valeur_sorties_autres,
      COALESCE(mv.q_ajust, 0) AS qte_ajustements,
      COALESCE(mv.v_ajust, 0) AS valeur_ajustements,
      pr.qte_actuelle - COALESCE(mv.delta_apres, 0) AS qte_cloture,
      (pr.qte_actuelle - COALESCE(mv.delta_apres, 0)) - COALESCE(mv.delta_session, 0) AS qte_ouverture
    FROM prod pr
    LEFT JOIN mv ON mv.produit_id = pr.id
    LEFT JOIN ventes v ON v.produit_id = pr.id
  )
  SELECT
    c.produit_id,
    c.produit_nom,
    c.categorie,
    c.departement,
    c.cout_unitaire,
    c.qte_ouverture,
    (c.qte_ouverture * c.cout_unitaire) AS valeur_ouverture,
    c.qte_entrees,
    c.valeur_entrees,
    c.qte_vendues,
    c.valeur_vendues,
    c.qte_sorties_autres,
    c.valeur_sorties_autres,
    c.qte_cloture,
    (c.qte_cloture * c.cout_unitaire) AS valeur_cloture,
    c.qte_ajustements,
    c.valeur_ajustements,
    COALESCE(cs.quantite_comptee, 0) AS qte_comptee,
    COALESCE(cs.ecart_qte, 0) AS ecart_qte_comptage,
    COALESCE(cs.ecart_valeur, 0) AS ecart_valeur_comptage,
    cs.date_comptage AS compte_le,
    COALESCE(cj.quantite_reelle, 0) AS qte_comptee_jour,
    COALESCE(cj.ecart_qte, 0) AS ecart_qte_jour,
    COALESCE(cj.ecart_valeur, 0) AS ecart_valeur_jour,
    c.prix_vente,
    c.prix_vente_ouverture,
    c.prix_vente_catalogue,
    c.prix_vente_moyen,
    (c.qte_ouverture * c.prix_vente_ouverture) AS valeur_vente_ouverture,
    (c.qte_cloture * c.prix_vente) AS valeur_vente_cloture,
    COALESCE(cs.ecart_valeur_vente, 0) AS ecart_valeur_vente_comptage
  FROM calc c
  LEFT JOIN comptages_shift cs
    ON cs.produit_id = c.produit_id
   AND cs.session_id = p_session_id
  LEFT JOIN clotures_stock_journalieres cj
    ON cj.etablissement_id = p_etablissement_id
   AND cj.produit_id = c.produit_id
   AND cj.date_cloture = p_business_date
  ORDER BY c.produit_nom;
$$;

GRANT EXECUTE ON FUNCTION public.stock_session_detail(UUID, TIMESTAMPTZ, TIMESTAMPTZ, DATE, UUID) TO authenticated;

COMMENT ON FUNCTION public.stock_session_detail(UUID, TIMESTAMPTZ, TIMESTAMPTZ, DATE, UUID) IS
  'Rapprochement de stock d''une session : valorisation au coût et au prix dynamique (ouverture/clôture), prix moyen pratiqué, comptage physique du shift et journalier.';

-- ============================================================================