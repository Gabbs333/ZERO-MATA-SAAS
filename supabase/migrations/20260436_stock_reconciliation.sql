-- Migration: Rapprochement journalier du stock et de sa valeur
-- Description:
--   1. Colonnes manquantes (seuil_alerte, commentaire de clôture)
--   2. stock_jour_detail() : état de stock par produit et par jour
--      (ouverture, entrées, sorties ventes, sorties autres, théorique, réel, écarts)
--   3. get_etat_stock_jour() : préparation d'une clôture de stock
--   4. enregistrer_cloture_stock() : saisie du comptage physique + ajustement
--   5. get_rapport_stock_journalier() : synthèse quotidienne
--   6. get_export_stock_dataset() + routage de get_export_dataset
-- Created: 2026-04-36
--
-- Rappel de la méthode de calcul :
--   La quantité de fin de journée est reconstruite à rebours depuis le stock
--   courant : qte_fin(J) = stock_actuel - somme(deltas des mouvements postérieurs à J).
--   La valorisation utilise le coût unitaire figé sur le mouvement, ou à défaut
--   le prix d'achat courant du produit.

-- ============================================================================
-- 1. COLONNES
-- ============================================================================

ALTER TABLE public.stocks
  ADD COLUMN IF NOT EXISTS seuil_alerte INTEGER DEFAULT 10;

UPDATE public.stocks SET seuil_alerte = 10 WHERE seuil_alerte IS NULL;

ALTER TABLE public.stocks
  ALTER COLUMN seuil_alerte SET DEFAULT 10;

ALTER TABLE public.clotures_stock_journalieres
  ADD COLUMN IF NOT EXISTS commentaire TEXT;

-- ============================================================================
-- 2. DÉTAIL DE STOCK PAR PRODUIT ET PAR JOUR
-- ============================================================================

CREATE OR REPLACE FUNCTION public.stock_jour_detail(
  p_etablissement_id UUID,
  p_date_debut DATE,
  p_date_fin DATE
)
RETURNS TABLE (
  jour DATE,
  produit_id UUID,
  produit_nom TEXT,
  categorie TEXT,
  cout_unitaire INTEGER,
  qte_ouverture INTEGER,
  qte_entrees INTEGER,
  qte_sorties_ventes INTEGER,
  qte_sorties_autres INTEGER,
  qte_theorique INTEGER,
  valeur_ouverture INTEGER,
  valeur_entrees INTEGER,
  valeur_sorties_ventes INTEGER,
  valeur_sorties_autres INTEGER,
  valeur_theorique INTEGER,
  qte_reelle INTEGER,
  valeur_reelle INTEGER,
  ecart_qte INTEGER,
  ecart_valeur INTEGER,
  est_compte BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH tz AS (
    SELECT COALESCE(fuseau_horaire, 'Africa/Douala') AS v_tz
    FROM etablissements
    WHERE id = p_etablissement_id
  ),
  jours AS (
    SELECT (generate_series(p_date_debut, p_date_fin, INTERVAL '1 day'))::date AS d
  ),
  prod AS (
    SELECT p.id,
           p.nom,
           p.categorie,
           COALESCE(p.prix_achat, 0) AS cout,
           COALESCE(s.quantite_actuelle, 0) AS qte_actuelle
    FROM produits p
    LEFT JOIN stocks s
      ON s.produit_id = p.id
     AND s.etablissement_id = p_etablissement_id
    WHERE p.etablissement_id = p_etablissement_id
      AND COALESCE(p.gestion_stock, false) = true
  ),
  mvt AS (
    SELECT m.produit_id,
           (m.date_creation AT TIME ZONE (SELECT v_tz FROM tz))::date AS j,
           CASE WHEN m.type = 'entree' THEN m.quantite ELSE -m.quantite END AS delta,
           CASE WHEN m.type = 'entree' THEN m.quantite ELSE 0 END AS q_entree,
           CASE WHEN m.type = 'sortie' AND m.type_reference = 'commande' THEN m.quantite ELSE 0 END AS q_vente,
           CASE WHEN m.type = 'sortie' AND m.type_reference <> 'commande' THEN m.quantite ELSE 0 END AS q_autre,
           CASE WHEN m.type = 'entree'
                THEN m.quantite * COALESCE(m.cout_unitaire, p.prix_achat, 0) ELSE 0 END AS v_entree,
           CASE WHEN m.type = 'sortie' AND m.type_reference = 'commande'
                THEN m.quantite * COALESCE(m.cout_unitaire, p.prix_achat, 0) ELSE 0 END AS v_vente,
           CASE WHEN m.type = 'sortie' AND m.type_reference <> 'commande'
                THEN m.quantite * COALESCE(m.cout_unitaire, p.prix_achat, 0) ELSE 0 END AS v_autre
    FROM mouvements_stock m
    JOIN prod p ON p.id = m.produit_id
    WHERE m.etablissement_id = p_etablissement_id
  ),
  daily AS (
    SELECT m.produit_id,
           m.j,
           SUM(m.delta)   AS delta,
           SUM(m.q_entree) AS q_entree,
           SUM(m.q_vente)  AS q_vente,
           SUM(m.q_autre)  AS q_autre,
           SUM(m.v_entree) AS v_entree,
           SUM(m.v_vente)  AS v_vente,
           SUM(m.v_autre)  AS v_autre
    FROM mvt m
    GROUP BY m.produit_id, m.j
  ),
  total AS (
    SELECT d.produit_id, SUM(d.delta) AS delta_total
    FROM daily d
    GROUP BY d.produit_id
  ),
  cum AS (
    SELECT d.produit_id,
           d.j,
           SUM(d.delta) OVER (PARTITION BY d.produit_id ORDER BY d.j) AS cum
    FROM daily d
  ),
  base AS (
    SELECT jj.d AS jour,
           pr.id AS produit_id,
           pr.nom AS produit_nom,
           pr.categorie,
           pr.cout AS cout_unitaire,
           COALESCE(d.q_entree, 0)::INTEGER AS qte_entrees,
           COALESCE(d.q_vente, 0)::INTEGER AS qte_sorties_ventes,
           COALESCE(d.q_autre, 0)::INTEGER AS qte_sorties_autres,
           COALESCE(d.v_entree, 0)::INTEGER AS valeur_entrees,
           COALESCE(d.v_vente, 0)::INTEGER AS valeur_sorties_ventes,
           COALESCE(d.v_autre, 0)::INTEGER AS valeur_sorties_autres,
           COALESCE(d.delta, 0)::INTEGER AS delta_jour,
           (pr.qte_actuelle - (COALESCE(t.delta_total, 0) - COALESCE(c.cum, 0)))::INTEGER AS qte_fin
    FROM jours jj
    CROSS JOIN prod pr
    LEFT JOIN daily d
      ON d.produit_id = pr.id
     AND d.j = jj.d
    LEFT JOIN total t ON t.produit_id = pr.id
    LEFT JOIN LATERAL (
      SELECT cc.cum
      FROM cum cc
      WHERE cc.produit_id = pr.id
        AND cc.j <= jj.d
      ORDER BY cc.j DESC
      LIMIT 1
    ) c ON true
  )
  SELECT
    b.jour,
    b.produit_id,
    b.produit_nom,
    b.categorie,
    b.cout_unitaire,
    (b.qte_fin - b.delta_jour) AS qte_ouverture,
    b.qte_entrees,
    b.qte_sorties_ventes,
    b.qte_sorties_autres,
    CASE WHEN cs.id IS NOT NULL THEN cs.quantite_theorique ELSE b.qte_fin END AS qte_theorique,
    ((b.qte_fin - b.delta_jour) * b.cout_unitaire) AS valeur_ouverture,
    b.valeur_entrees,
    b.valeur_sorties_ventes,
    b.valeur_sorties_autres,
    CASE
      WHEN cs.id IS NOT NULL THEN cs.valeur_theorique
      ELSE ((b.qte_fin - b.delta_jour) * b.cout_unitaire)
           + b.valeur_entrees - b.valeur_sorties_ventes - b.valeur_sorties_autres
    END AS valeur_theorique,
    cs.quantite_reelle,
    cs.valeur_reelle,
    cs.ecart_qte,
    cs.ecart_valeur,
    (cs.id IS NOT NULL) AS est_compte
  FROM base b
  LEFT JOIN clotures_stock_journalieres cs
    ON cs.etablissement_id = p_etablissement_id
   AND cs.date_cloture = b.jour
   AND cs.produit_id = b.produit_id;
$$;

-- Fonction interne : jamais appelable directement par un client (le paramètre
-- etablissement_id n'est pas contrôlé).
REVOKE ALL ON FUNCTION public.stock_jour_detail(UUID, DATE, DATE) FROM PUBLIC;

COMMENT ON FUNCTION public.stock_jour_detail(UUID, DATE, DATE) IS
  'État de stock reconstitué par produit et par jour : ouverture, mouvements, théorique, réel et écarts.';

-- ============================================================================
-- 3. ÉTAT DU STOCK POUR UNE JOURNÉE (préparation de la clôture)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_etat_stock_jour(p_date DATE DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_profile RECORD;
  v_etab UUID;
  v_date DATE;
  v_rows JSONB := '[]'::jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Non authentifié.';
  END IF;

  SELECT * INTO v_profile FROM profiles WHERE id = v_uid;
  IF NOT FOUND OR v_profile.role NOT IN ('patron', 'gerant') OR COALESCE(v_profile.actif, true) <> true THEN
    RAISE EXCEPTION 'Accès refusé.';
  END IF;
  IF v_profile.etablissement_id IS NULL THEN
    RAISE EXCEPTION 'Aucun établissement associé.';
  END IF;

  v_etab := v_profile.etablissement_id;
  v_date := COALESCE(p_date, CURRENT_DATE);
  IF v_date > CURRENT_DATE THEN
    RAISE EXCEPTION 'La date ne peut pas être dans le futur.';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'produit_id', d.produit_id,
    'produit_nom', d.produit_nom,
    'categorie', d.categorie,
    'cout_unitaire', d.cout_unitaire,
    'qte_ouverture', d.qte_ouverture,
    'qte_entrees', d.qte_entrees,
    'qte_sorties_ventes', d.qte_sorties_ventes,
    'qte_sorties_autres', d.qte_sorties_autres,
    'qte_theorique', d.qte_theorique,
    'valeur_theorique', d.valeur_theorique,
    'qte_reelle', d.qte_reelle,
    'est_compte', d.est_compte
  ) ORDER BY d.categorie, d.produit_nom), '[]'::jsonb)
  INTO v_rows
  FROM public.stock_jour_detail(v_etab, v_date, v_date) d;

  RETURN jsonb_build_object(
    'date', v_date,
    'rows', v_rows
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_etat_stock_jour(DATE) TO authenticated;

COMMENT ON FUNCTION public.get_etat_stock_jour(DATE) IS
  'Liste les produits à suivi de stock avec leur quantité théorique de fin de journée, pour préparer une clôture de stock.';

-- ============================================================================
-- 4. ENREGISTREMENT D'UNE CLÔTURE DE STOCK
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enregistrer_cloture_stock(
  p_date DATE,
  p_items JSONB,
  p_commentaire TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_profile RECORD;
  v_etab UUID;
  v_date DATE;
  v_map JSONB := '{}'::jsonb;
  v_item JSONB;
  v_detail RECORD;
  v_reel INTEGER;
  v_cout INTEGER;
  v_stock_actuel INTEGER;
  v_ecart_precedent INTEGER;
  v_ecart_courant INTEGER;
  v_ajustement INTEGER;
  v_modifies INTEGER := 0;
  v_ajustes INTEGER := 0;
  v_ecart_qte_total INTEGER := 0;
  v_ecart_valeur_total INTEGER := 0;
  v_reference TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Non authentifié.';
  END IF;

  SELECT * INTO v_profile FROM profiles WHERE id = v_uid;
  IF NOT FOUND OR v_profile.role NOT IN ('patron', 'gerant') OR COALESCE(v_profile.actif, true) <> true THEN
    RAISE EXCEPTION 'Accès refusé.';
  END IF;
  IF v_profile.etablissement_id IS NULL THEN
    RAISE EXCEPTION 'Aucun établissement associé.';
  END IF;

  v_etab := v_profile.etablissement_id;
  v_date := COALESCE(p_date, CURRENT_DATE);
  IF v_date > CURRENT_DATE THEN
    RAISE EXCEPTION 'La date de clôture ne peut pas être dans le futur.';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'Liste de produits invalide.';
  END IF;

  -- Quantités comptées, indexées par produit
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    IF (v_item->>'quantite_reelle') IS NULL THEN
      RAISE EXCEPTION 'Quantité réelle manquante pour un produit.';
    END IF;
    IF (v_item->>'quantite_reelle')::INTEGER < 0 THEN
      RAISE EXCEPTION 'La quantité comptée ne peut pas être négative.';
    END IF;
    v_map := v_map || jsonb_build_object(
      v_item->>'produit_id',
      (v_item->>'quantite_reelle')::INTEGER
    );
  END LOOP;

  IF v_map = '{}'::jsonb THEN
    RAISE EXCEPTION 'Aucun produit compté.';
  END IF;

  v_reference := 'CLOTURE-STOCK-' || to_char(v_date, 'YYYYMMDD');

  FOR v_detail IN
    SELECT * FROM public.stock_jour_detail(v_etab, v_date, v_date)
  LOOP
    IF NOT (v_map ? (v_detail.produit_id::text)) THEN
      CONTINUE;
    END IF;

    v_reel := (v_map->>(v_detail.produit_id::text))::INTEGER;
    v_cout := COALESCE(v_detail.cout_unitaire, 0);

    -- Écart déjà appliqué lors d'une clôture précédente de la même journée
    -- (permet de rejouer une clôture sans corriger deux fois le stock).
    SELECT COALESCE(ecart_qte, 0) INTO v_ecart_precedent
    FROM clotures_stock_journalieres
    WHERE etablissement_id = v_etab
      AND date_cloture = v_date
      AND produit_id = v_detail.produit_id;

    v_ecart_precedent := COALESCE(v_ecart_precedent, 0);
    v_ecart_courant := v_reel - v_detail.qte_theorique;
    v_ajustement := v_ecart_courant - v_ecart_precedent;

    -- Stock courant avant alignement
    SELECT COALESCE(quantite_actuelle, 0) INTO v_stock_actuel
    FROM stocks
    WHERE produit_id = v_detail.produit_id
      AND etablissement_id = v_etab;

    v_stock_actuel := COALESCE(v_stock_actuel, 0);

    INSERT INTO clotures_stock_journalieres (
      etablissement_id, date_cloture, produit_id,
      quantite_ouverture, cout_ouverture,
      qte_entrees, valeur_entrees,
      qte_sorties_ventes, valeur_sorties_ventes,
      qte_sorties_autres, valeur_sorties_autres,
      quantite_theorique, quantite_reelle, cout_fin,
      valeur_theorique, valeur_reelle,
      ecart_qte, ecart_valeur,
      commentaire, utilisateur_id
    ) VALUES (
      v_etab, v_date, v_detail.produit_id,
      v_detail.qte_ouverture, v_cout,
      v_detail.qte_entrees, v_detail.valeur_entrees,
      v_detail.qte_sorties_ventes, v_detail.valeur_sorties_ventes,
      v_detail.qte_sorties_autres, v_detail.valeur_sorties_autres,
      v_detail.qte_theorique, v_reel, v_cout,
      v_detail.valeur_theorique, v_reel * v_cout,
      v_ecart_courant, v_ecart_courant * v_cout,
      p_commentaire, v_uid
    )
    ON CONFLICT (etablissement_id, date_cloture, produit_id) DO UPDATE
    SET quantite_ouverture = EXCLUDED.quantite_ouverture,
        cout_ouverture = EXCLUDED.cout_ouverture,
        qte_entrees = EXCLUDED.qte_entrees,
        valeur_entrees = EXCLUDED.valeur_entrees,
        qte_sorties_ventes = EXCLUDED.qte_sorties_ventes,
        valeur_sorties_ventes = EXCLUDED.valeur_sorties_ventes,
        qte_sorties_autres = EXCLUDED.qte_sorties_autres,
        valeur_sorties_autres = EXCLUDED.valeur_sorties_autres,
        quantite_theorique = EXCLUDED.quantite_theorique,
        quantite_reelle = EXCLUDED.quantite_reelle,
        cout_fin = EXCLUDED.cout_fin,
        valeur_theorique = EXCLUDED.valeur_theorique,
        valeur_reelle = EXCLUDED.valeur_reelle,
        ecart_qte = EXCLUDED.ecart_qte,
        ecart_valeur = EXCLUDED.ecart_valeur,
        commentaire = EXCLUDED.commentaire,
        utilisateur_id = EXCLUDED.utilisateur_id,
        date_creation = NOW();

    v_modifies := v_modifies + 1;
    v_ecart_qte_total := v_ecart_qte_total + v_ecart_courant;
    v_ecart_valeur_total := v_ecart_valeur_total + (v_ecart_courant * v_cout);

    -- Alignement physique du stock + mouvement d'ajustement (traçabilité)
    IF v_ajustement <> 0 THEN
      IF v_ajustement > 0 THEN
        INSERT INTO mouvements_stock (
          produit_id, etablissement_id, type, quantite, cout_unitaire,
          type_reference, reference, utilisateur_id, date_creation
        ) VALUES (
          v_detail.produit_id, v_etab, 'entree', v_ajustement, v_cout,
          'ajustement', v_reference, v_uid, NOW()
        );
      ELSE
        INSERT INTO mouvements_stock (
          produit_id, etablissement_id, type, quantite, cout_unitaire,
          type_reference, reference, utilisateur_id, date_creation
        ) VALUES (
          v_detail.produit_id, v_etab, 'sortie', ABS(v_ajustement), v_cout,
          'ajustement', v_reference, v_uid, NOW()
        );
      END IF;

      UPDATE stocks
      SET quantite_actuelle = GREATEST(0, v_stock_actuel + v_ajustement),
          derniere_mise_a_jour = NOW()
      WHERE produit_id = v_detail.produit_id
        AND etablissement_id = v_etab;

      IF NOT FOUND THEN
        INSERT INTO stocks (produit_id, etablissement_id, quantite_actuelle, seuil_alerte, derniere_mise_a_jour)
        VALUES (v_detail.produit_id, v_etab, GREATEST(0, v_reel), 10, NOW());
      END IF;

      v_ajustes := v_ajustes + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'date_cloture', v_date,
    'produits_comptes', v_modifies,
    'produits_ajustes', v_ajustes,
    'ecart_qte', v_ecart_qte_total,
    'ecart_valeur', v_ecart_valeur_total
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.enregistrer_cloture_stock(DATE, JSONB, TEXT) TO authenticated;

COMMENT ON FUNCTION public.enregistrer_cloture_stock(DATE, JSONB, TEXT) IS
  'Enregistre un comptage physique de stock, calcule les écarts et aligne le stock via un mouvement d''ajustement.';

-- ============================================================================
-- 5. RAPPORT JOURNALIER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_rapport_stock_journalier(
  p_date_debut DATE,
  p_date_fin DATE,
  p_departement TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_profile RECORD;
  v_etab UUID;
  v_debut DATE;
  v_fin DATE;
  v_dept TEXT := NULLIF(LOWER(p_departement), '');
  v_rows JSONB := '[]'::jsonb;
  v_totaux JSONB := '{}'::jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Non authentifié.';
  END IF;

  SELECT * INTO v_profile FROM profiles WHERE id = v_uid;
  IF NOT FOUND OR v_profile.role NOT IN ('patron', 'gerant') OR COALESCE(v_profile.actif, true) <> true THEN
    RAISE EXCEPTION 'Accès refusé.';
  END IF;
  IF v_profile.etablissement_id IS NULL THEN
    RAISE EXCEPTION 'Aucun établissement associé.';
  END IF;

  v_etab := v_profile.etablissement_id;
  v_debut := COALESCE(p_date_debut, CURRENT_DATE);
  v_fin := LEAST(COALESCE(p_date_fin, CURRENT_DATE), CURRENT_DATE);
  IF v_debut > v_fin THEN
    RAISE EXCEPTION 'Période invalide.';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'date', to_char(a.jour, 'DD/MM/YYYY'),
    'qte_entrees', a.qte_entrees,
    'qte_sorties_ventes', a.qte_sorties_ventes,
    'qte_sorties_autres', a.qte_sorties_autres,
    'valeur_ouverture', a.valeur_ouverture,
    'valeur_entrees', a.valeur_entrees,
    'valeur_sorties_ventes', a.valeur_sorties_ventes,
    'valeur_sorties_autres', a.valeur_sorties_autres,
    'valeur_theorique', a.valeur_theorique,
    'valeur_reelle', a.valeur_reelle,
    'ecart_qte', a.ecart_qte,
    'ecart_valeur', a.ecart_valeur,
    'produits_suivis', a.produits_suivis,
    'produits_comptes', a.produits_comptes,
    'statut', CASE WHEN a.produits_comptes >= a.produits_suivis AND a.produits_suivis > 0
                   THEN 'Clôturé' ELSE 'Ouvert' END
  ) ORDER BY a.jour DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT d.jour,
           SUM(d.qte_entrees)::INTEGER AS qte_entrees,
           SUM(d.qte_sorties_ventes)::INTEGER AS qte_sorties_ventes,
           SUM(d.qte_sorties_autres)::INTEGER AS qte_sorties_autres,
           SUM(d.valeur_ouverture)::INTEGER AS valeur_ouverture,
           SUM(d.valeur_entrees)::INTEGER AS valeur_entrees,
           SUM(d.valeur_sorties_ventes)::INTEGER AS valeur_sorties_ventes,
           SUM(d.valeur_sorties_autres)::INTEGER AS valeur_sorties_autres,
           SUM(d.valeur_theorique)::INTEGER AS valeur_theorique,
           COALESCE(SUM(d.valeur_reelle), 0)::INTEGER AS valeur_reelle,
           COALESCE(SUM(d.ecart_qte), 0)::INTEGER AS ecart_qte,
           COALESCE(SUM(d.ecart_valeur), 0)::INTEGER AS ecart_valeur,
           COUNT(*)::INTEGER AS produits_suivis,
           COUNT(*) FILTER (WHERE d.est_compte)::INTEGER AS produits_comptes
    FROM public.stock_jour_detail(v_etab, v_debut, v_fin) d
    WHERE (
      v_dept IS NULL
      OR (v_dept = 'cuisine' AND d.categorie = 'nourriture')
      OR (v_dept = 'bar' AND d.categorie <> 'nourriture')
    )
    GROUP BY d.jour
  ) a;

  SELECT jsonb_build_object(
    -- Les niveaux de stock ne se cumulent pas : on retient l'ouverture de la
    -- première journée et la clôture de la dernière. Les flux, eux, se somment.
    'valeur_ouverture', COALESCE((v_rows->(GREATEST(jsonb_array_length(v_rows) - 1, 0)))->>'valeur_ouverture', '0')::numeric,
    'valeur_entrees', COALESCE(SUM((r->>'valeur_entrees')::numeric), 0),
    'valeur_sorties_ventes', COALESCE(SUM((r->>'valeur_sorties_ventes')::numeric), 0),
    'valeur_sorties_autres', COALESCE(SUM((r->>'valeur_sorties_autres')::numeric), 0),
    'valeur_theorique', COALESCE((v_rows->0)->>'valeur_theorique', '0')::numeric,
    'valeur_reelle', COALESCE((v_rows->0)->>'valeur_reelle', '0')::numeric,
    'ecart_qte', COALESCE(SUM((r->>'ecart_qte')::numeric), 0),
    'ecart_valeur', COALESCE(SUM((r->>'ecart_valeur')::numeric), 0),
    'jours', jsonb_array_length(v_rows)
  )
  INTO v_totaux
  FROM jsonb_array_elements(v_rows) AS r;

  RETURN jsonb_build_object(
    'date_debut', v_debut,
    'date_fin', v_fin,
    'departement', COALESCE(v_dept, 'tous'),
    'rows', v_rows,
    'totaux', v_totaux
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_rapport_stock_journalier(DATE, DATE, TEXT) TO authenticated;

COMMENT ON FUNCTION public.get_rapport_stock_journalier(DATE, DATE, TEXT) IS
  'Rapprochement quotidien du stock et de sa valeur : valeur du stock vendu (COGS), entrées, écarts de comptage.';

-- ============================================================================
-- 6. DATASET D'EXPORT STOCK + ROUTAGE
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_export_stock_dataset(
  p_type TEXT,
  p_date_debut TIMESTAMPTZ,
  p_date_fin TIMESTAMPTZ,
  p_filtres JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_profile RECORD;
  v_etab RECORD;
  v_tz TEXT;
  v_dept TEXT := NULLIF(LOWER(p_filtres->>'departement'), '');
  v_debut_date DATE;
  v_fin_date DATE;
  v_rows JSONB := '[]'::jsonb;
  v_totaux JSONB := '{}'::jsonb;
  v_stock JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Non authentifié.';
  END IF;

  SELECT * INTO v_profile FROM profiles WHERE id = v_uid;
  IF NOT FOUND OR v_profile.role NOT IN ('patron', 'gerant') OR COALESCE(v_profile.actif, true) <> true THEN
    RAISE EXCEPTION 'Accès refusé.';
  END IF;
  IF v_profile.etablissement_id IS NULL THEN
    RAISE EXCEPTION 'Aucun établissement associé à votre compte.';
  END IF;
  IF p_date_debut IS NULL OR p_date_fin IS NULL THEN
    RAISE EXCEPTION 'Période obligatoire.';
  END IF;
  IF p_date_debut > p_date_fin THEN
    RAISE EXCEPTION 'Période invalide.';
  END IF;

  SELECT * INTO v_etab FROM etablissements WHERE id = v_profile.etablissement_id;
  v_tz := COALESCE(v_etab.fuseau_horaire, 'Africa/Douala');
  v_debut_date := (p_date_debut AT TIME ZONE v_tz)::date;
  v_fin_date := LEAST((p_date_fin AT TIME ZONE v_tz)::date, CURRENT_DATE);

  IF p_type = 'rapport_stock_journalier' THEN
    v_stock := public.get_rapport_stock_journalier(v_debut_date, v_fin_date, v_dept);
    v_rows := COALESCE(v_stock->'rows', '[]'::jsonb);
    v_totaux := COALESCE(v_stock->'totaux', '{}'::jsonb);

  ELSIF p_type = 'journal_mouvements_stock' THEN
    SELECT COALESCE(jsonb_agg(r ORDER BY s.sort_ts DESC), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT jsonb_build_object(
        'date', to_char(m.date_creation AT TIME ZONE v_tz, 'DD/MM/YYYY HH24:MI'),
        'produit', p.nom,
        'categorie', p.categorie,
        'departement', CASE WHEN p.categorie = 'nourriture' THEN 'Cuisine' ELSE 'Bar' END,
        'sens', CASE WHEN m.type = 'entree' THEN 'Entrée' ELSE 'Sortie' END,
        'origine',
          CASE m.type_reference
            WHEN 'commande' THEN 'Vente'
            WHEN 'ravitaillement' THEN 'Ravitaillement'
            WHEN 'retour' THEN 'Retour'
            WHEN 'echange' THEN 'Échange'
            WHEN 'ajustement' THEN 'Ajustement'
            ELSE COALESCE(m.type_reference, '—')
          END,
        'quantite', m.quantite,
        'cout_unitaire', COALESCE(m.cout_unitaire, p.prix_achat, 0),
        'valeur', m.quantite * COALESCE(m.cout_unitaire, p.prix_achat, 0),
        'reference', m.reference,
        'agent', COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.prenom, u.nom)), ''), '—')
      ) AS r,
      m.date_creation AS sort_ts
      FROM mouvements_stock m
      JOIN produits p ON p.id = m.produit_id
      LEFT JOIN profiles u ON u.id = m.utilisateur_id
      WHERE m.etablissement_id = v_profile.etablissement_id
        AND m.date_creation >= p_date_debut
        AND m.date_creation <= p_date_fin
        AND (
          v_dept IS NULL
          OR (v_dept = 'cuisine' AND p.categorie = 'nourriture')
          OR (v_dept = 'bar' AND p.categorie <> 'nourriture')
        )
    ) s;

    SELECT jsonb_build_object(
      'valeur_entrees', COALESCE(SUM(CASE WHEN m.type = 'entree'
        THEN m.quantite * COALESCE(m.cout_unitaire, p.prix_achat, 0) ELSE 0 END), 0),
      'valeur_sorties', COALESCE(SUM(CASE WHEN m.type = 'sortie'
        THEN m.quantite * COALESCE(m.cout_unitaire, p.prix_achat, 0) ELSE 0 END), 0),
      'lignes', COUNT(*)
    )
    INTO v_totaux
    FROM mouvements_stock m
    JOIN produits p ON p.id = m.produit_id
    WHERE m.etablissement_id = v_profile.etablissement_id
      AND m.date_creation >= p_date_debut
      AND m.date_creation <= p_date_fin
      AND (
        v_dept IS NULL
        OR (v_dept = 'cuisine' AND p.categorie = 'nourriture')
        OR (v_dept = 'bar' AND p.categorie <> 'nourriture')
      );

  ELSE
    RAISE EXCEPTION 'Type d''export stock inconnu : %', p_type;
  END IF;

  RETURN jsonb_build_object(
    'meta', jsonb_build_object(
      'type', p_type,
      'etablissement_id', v_etab.id,
      'etablissement_nom', v_etab.nom,
      'date_debut', p_date_debut,
      'date_fin', p_date_fin,
      'devise', COALESCE(v_etab.devise, 'XAF'),
      'taux_tva', COALESCE(v_etab.taux_tva, 19.25),
      'prix_ttc', COALESCE(v_etab.prix_ttc, true),
      'fuseau_horaire', v_tz,
      'genere_le', NOW(),
      'genere_par', COALESCE(NULLIF(TRIM(CONCAT_WS(' ', v_profile.prenom, v_profile.nom)), ''), v_profile.role),
      'filtres', COALESCE(p_filtres, '{}'::jsonb)
    ),
    'rows', v_rows,
    'totaux', v_totaux
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_export_stock_dataset(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, JSONB) TO authenticated;

-- Routage : get_export_dataset conserve son rôle d'entrée unique côté client.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'get_export_dataset'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'get_export_dataset_core'
  ) THEN
    EXECUTE 'ALTER FUNCTION public.get_export_dataset(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, JSONB) RENAME TO get_export_dataset_core';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_export_dataset(
  p_type TEXT,
  p_date_debut TIMESTAMPTZ,
  p_date_fin TIMESTAMPTZ,
  p_filtres JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_type IN ('rapport_stock_journalier', 'journal_mouvements_stock') THEN
    RETURN public.get_export_stock_dataset(p_type, p_date_debut, p_date_fin, p_filtres);
  END IF;
  RETURN public.get_export_dataset_core(p_type, p_date_debut, p_date_fin, p_filtres);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_export_dataset(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, JSONB) TO authenticated;

COMMENT ON FUNCTION public.get_export_dataset(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, JSONB) IS
  'Point d''entrée unique des exports comptables. Délègue aux jeux de données ventes/caisse ou stock selon le type demandé.';

NOTIFY pgrst, 'reload schema';
