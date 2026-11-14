-- Migration: Shifts — rapprochement de stock par session
-- Description:
--   Jusqu'ici le rapprochement de stock était journalier (`stock_jour_detail`).
--   Les sessions de shift existent désormais ; on ajoute le même raisonnement
--   à l'échelle d'une session :
--
--     qte_cloture   = stock_actuel - somme(deltas des mouvements POSTÉRIEURS
--                     à la fin de la session)
--     qte_ouverture = qte_cloture - somme(deltas des mouvements DE la session)
--     qte_ouverture + entrées - ventes - sorties autres = qte_cloture
--
--   L'identité est garantie par construction : la session est définie par sa
--   fenêtre temporelle (ouverte_le -> fermee_le, ou NOW() si ouverte), pas par
--   `session_id`. Les mouvements saisis hors session restent donc correctement
--   pris en compte dans la chronologie du stock.
--
--   Valorisation identique au rapprochement journalier :
--     COALESCE(mouvements_stock.cout_unitaire, produits.prix_achat, 0)
--
--   Le comptage physique (`clotures_stock_journalieres`) reste JOURNALIER : il
--   est exposé à titre indicatif sur la journée d'exploitation de la session
--   (`qte_comptee_jour`, `ecart_qte_jour`), sans être attribué à un shift.
--
--   Livré :
--     1. `stock_session_detail()`       — socle (une ligne par produit)
--     2. `get_rapprochement_stock_session()` — détail + totaux pour une session
--     3. `get_export_stock_shift_dataset()`  — exports par session
--     4. routage de `get_export_dataset` (rapport_stock_shift,
--        rapport_stock_shift_produit)
--
--   Lecture seule : aucune donnée historique n'est modifiée.
-- Created: 2026-04-52

-- ============================================================================
-- 1. SOCLE : DÉTAIL DE STOCK D'UNE SESSION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.stock_session_detail(
  p_etablissement_id UUID,
  p_debut TIMESTAMPTZ,
  p_fin TIMESTAMPTZ,
  p_business_date DATE
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
  qte_comptee_jour INTEGER,
  ecart_qte_jour INTEGER,
  ecart_valeur_jour INTEGER
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
        FILTER (WHERE m.date_creation >= p_debut AND m.date_creation <= p_fin), 0) AS q_entrees,
      COALESCE(SUM(CASE WHEN m.type = 'entree'
                        THEN m.quantite * COALESCE(m.cout_unitaire, p.cout, 0) ELSE 0 END)
        FILTER (WHERE m.date_creation >= p_debut AND m.date_creation <= p_fin), 0) AS v_entrees,
      COALESCE(SUM(CASE WHEN m.type = 'sortie' AND m.type_reference = 'commande'
                        THEN m.quantite ELSE 0 END)
        FILTER (WHERE m.date_creation >= p_debut AND m.date_creation <= p_fin), 0) AS q_vendues,
      COALESCE(SUM(CASE WHEN m.type = 'sortie' AND m.type_reference = 'commande'
                        THEN m.quantite * COALESCE(m.cout_unitaire, p.cout, 0) ELSE 0 END)
        FILTER (WHERE m.date_creation >= p_debut AND m.date_creation <= p_fin), 0) AS v_vendues,
      COALESCE(SUM(CASE WHEN m.type = 'sortie' AND m.type_reference <> 'commande'
                        THEN m.quantite ELSE 0 END)
        FILTER (WHERE m.date_creation >= p_debut AND m.date_creation <= p_fin), 0) AS q_autres,
      COALESCE(SUM(CASE WHEN m.type = 'sortie' AND m.type_reference <> 'commande'
                        THEN m.quantite * COALESCE(m.cout_unitaire, p.cout, 0) ELSE 0 END)
        FILTER (WHERE m.date_creation >= p_debut AND m.date_creation <= p_fin), 0) AS v_autres
    FROM mouvements_stock m
    JOIN prod p ON p.id = m.produit_id
    WHERE m.etablissement_id = p_etablissement_id
    GROUP BY m.produit_id
  ),
  calc AS (
    SELECT
      pr.id AS produit_id,
      pr.nom AS produit_nom,
      pr.categorie,
      CASE WHEN LOWER(BTRIM(COALESCE(pr.categorie, ''))) = 'nourriture'
           THEN 'cuisine' ELSE 'bar' END AS departement,
      pr.cout AS cout_unitaire,
      COALESCE(mv.q_entrees, 0) AS qte_entrees,
      COALESCE(mv.v_entrees, 0) AS valeur_entrees,
      COALESCE(mv.q_vendues, 0) AS qte_vendues,
      COALESCE(mv.v_vendues, 0) AS valeur_vendues,
      COALESCE(mv.q_autres, 0) AS qte_sorties_autres,
      COALESCE(mv.v_autres, 0) AS valeur_sorties_autres,
      -- Stock à la clôture de la session, reconstitué à rebours
      pr.qte_actuelle - COALESCE(mv.delta_apres, 0) AS qte_cloture,
      -- Stock à l'ouverture = clôture - mouvements de la session
      (pr.qte_actuelle - COALESCE(mv.delta_apres, 0)) - COALESCE(mv.delta_session, 0) AS qte_ouverture
    FROM prod pr
    LEFT JOIN mv ON mv.produit_id = pr.id
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
    COALESCE(cs.quantite_reelle, 0) AS qte_comptee_jour,
    COALESCE(cs.ecart_qte, 0) AS ecart_qte_jour,
    COALESCE(cs.ecart_valeur, 0) AS ecart_valeur_jour
  FROM calc c
  LEFT JOIN clotures_stock_journalieres cs
    ON cs.etablissement_id = p_etablissement_id
   AND cs.produit_id = c.produit_id
   AND cs.date_cloture = p_business_date
  ORDER BY c.produit_nom;
$$;

GRANT EXECUTE ON FUNCTION public.stock_session_detail(UUID, TIMESTAMPTZ, TIMESTAMPTZ, DATE) TO authenticated;

COMMENT ON FUNCTION public.stock_session_detail(UUID, TIMESTAMPTZ, TIMESTAMPTZ, DATE) IS
  'Rapprochement de stock d''une fenêtre de session (ouverture, entrées, ventes, sorties autres, clôture théorique) valorisé.';

-- ============================================================================
-- 2. RPC : RAPPROCHEMENT DE STOCK D'UNE SESSION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_rapprochement_stock_session(p_session_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile RECORD;
  v_session RECORD;
  v_shift RECORD;
  v_debut TIMESTAMPTZ;
  v_fin TIMESTAMPTZ;
  v_produits JSONB := '[]'::jsonb;
  v_totaux JSONB := '{}'::jsonb;
  v_comptage JSONB := '{}'::jsonb;
BEGIN
  SELECT id, role, etablissement_id, actif INTO v_profile
  FROM profiles WHERE id = auth.uid();

  IF NOT FOUND OR COALESCE(v_profile.actif, true) <> true THEN
    RAISE EXCEPTION 'Accès refusé.';
  END IF;

  SELECT * INTO v_session FROM sessions_shift WHERE id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session introuvable.';
  END IF;
  IF v_session.etablissement_id <> v_profile.etablissement_id
     AND v_profile.role <> 'patron' AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Session d''un autre établissement.';
  END IF;

  SELECT * INTO v_shift FROM shifts WHERE id = v_session.shift_id;

  v_debut := v_session.ouverte_le;
  v_fin := COALESCE(v_session.fermee_le, NOW());

  -- Détail (uniquement les produits réellement concernés : mouvement ou stock)
  SELECT COALESCE(jsonb_agg(to_jsonb(d) ORDER BY d.valeur_vendues DESC, d.produit_nom), '[]'::jsonb)
  INTO v_produits
  FROM public.stock_session_detail(
         v_session.etablissement_id, v_debut, v_fin, v_session.business_date
       ) d
  WHERE d.qte_entrees <> 0
     OR d.qte_vendues <> 0
     OR d.qte_sorties_autres <> 0
     OR d.qte_ouverture <> 0
     OR d.qte_cloture <> 0;

  -- Totaux sur l'ensemble des produits suivis
  SELECT jsonb_build_object(
    'qte_ouverture', COALESCE(SUM(d.qte_ouverture), 0),
    'valeur_ouverture', COALESCE(SUM(d.valeur_ouverture), 0),
    'qte_entrees', COALESCE(SUM(d.qte_entrees), 0),
    'valeur_entrees', COALESCE(SUM(d.valeur_entrees), 0),
    'qte_vendues', COALESCE(SUM(d.qte_vendues), 0),
    'valeur_vendues', COALESCE(SUM(d.valeur_vendues), 0),
    'qte_sorties_autres', COALESCE(SUM(d.qte_sorties_autres), 0),
    'valeur_sorties_autres', COALESCE(SUM(d.valeur_sorties_autres), 0),
    'qte_cloture', COALESCE(SUM(d.qte_cloture), 0),
    'valeur_cloture', COALESCE(SUM(d.valeur_cloture), 0),
    'produits_suivis', COUNT(*),
    'produits_mouvementes', COUNT(*) FILTER (
      WHERE d.qte_entrees <> 0 OR d.qte_vendues <> 0 OR d.qte_sorties_autres <> 0
    )
  )
  INTO v_totaux
  FROM public.stock_session_detail(
         v_session.etablissement_id, v_debut, v_fin, v_session.business_date
       ) d;

  -- Comptage physique éventuel de la journée d'exploitation (indicatif)
  SELECT jsonb_build_object(
    'disponible', COUNT(*) > 0,
    'date_cloture', v_session.business_date,
    'produits_comptes', COUNT(*),
    'ecart_qte', COALESCE(SUM(cs.ecart_qte), 0),
    'ecart_valeur', COALESCE(SUM(cs.ecart_valeur), 0),
    'portee', 'journee'
  )
  INTO v_comptage
  FROM clotures_stock_journalieres cs
  WHERE cs.etablissement_id = v_session.etablissement_id
    AND cs.date_cloture = v_session.business_date;

  RETURN jsonb_build_object(
    'session_id', v_session.id,
    'business_date', v_session.business_date,
    'statut', v_session.statut,
    'shift', jsonb_build_object(
      'nom', v_shift.nom,
      'heure_debut', to_char(v_shift.heure_debut, 'HH24:MI'),
      'heure_fin', to_char(v_shift.heure_fin, 'HH24:MI')
    ),
    'fenetre', jsonb_build_object('debut', v_debut, 'fin', v_fin),
    'totaux', v_totaux,
    'comptage', v_comptage,
    'produits', v_produits
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_rapprochement_stock_session(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_rapprochement_stock_session(UUID) IS
  'Rapprochement de stock (quantités et valeurs) sur la fenêtre d''une session de shift.';

-- ============================================================================
-- 3. EXPORTS PAR SESSION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_export_stock_shift_dataset(
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
  v_debut DATE;
  v_fin DATE;
  v_session_id UUID := NULLIF(p_filtres->>'session_id', '')::UUID;
  v_shift_nom TEXT := NULLIF(TRIM(p_filtres->>'shift'), '');
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
  v_debut := (p_date_debut AT TIME ZONE v_tz)::date;
  v_fin := (p_date_fin AT TIME ZONE v_tz)::date;

  IF p_type = 'rapport_stock_shift_produit' THEN
    -- Une ligne par session et par produit mouvementé
    SELECT COALESCE(jsonb_agg(r ORDER BY sort_date DESC, sort_shift, produit), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT
        jsonb_build_object(
          'business_date', to_char(s.business_date, 'DD/MM/YYYY'),
          'shift', sh.nom,
          'statut', CASE WHEN s.statut = 'ouverte' THEN 'Ouverte' ELSE 'Fermée' END,
          'produit', d.produit_nom,
          'categorie', COALESCE(d.categorie, '—'),
          'departement', CASE WHEN d.departement = 'cuisine' THEN 'Cuisine' ELSE 'Bar' END,
          'cout_unitaire', d.cout_unitaire,
          'qte_ouverture', d.qte_ouverture,
          'valeur_ouverture', d.valeur_ouverture,
          'qte_entrees', d.qte_entrees,
          'valeur_entrees', d.valeur_entrees,
          'qte_vendues', d.qte_vendues,
          'valeur_vendues', d.valeur_vendues,
          'qte_sorties_autres', d.qte_sorties_autres,
          'valeur_sorties_autres', d.valeur_sorties_autres,
          'qte_cloture', d.qte_cloture,
          'valeur_cloture', d.valeur_cloture,
          'ecart_qte_jour', d.ecart_qte_jour,
          'ecart_valeur_jour', d.ecart_valeur_jour
        ) AS r,
        s.business_date AS sort_date,
        sh.ordre AS sort_shift,
        d.produit_nom AS produit
      FROM sessions_shift s
      JOIN shifts sh ON sh.id = s.shift_id
      CROSS JOIN LATERAL public.stock_session_detail(
        s.etablissement_id, s.ouverte_le, COALESCE(s.fermee_le, NOW()), s.business_date
      ) d
      WHERE s.etablissement_id = v_profile.etablissement_id
        AND s.business_date BETWEEN v_debut AND v_fin
        AND (v_session_id IS NULL OR s.id = v_session_id)
        AND (v_shift_nom IS NULL OR sh.nom = v_shift_nom)
        AND (d.qte_entrees <> 0 OR d.qte_vendues <> 0 OR d.qte_sorties_autres <> 0
             OR d.qte_ouverture <> 0 OR d.qte_cloture <> 0)
    ) x;
  ELSE
    -- Synthèse : une ligne par session
    SELECT COALESCE(jsonb_agg(r ORDER BY sort_date DESC, sort_shift), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT
        jsonb_build_object(
          'business_date', to_char(s.business_date, 'DD/MM/YYYY'),
          'shift', sh.nom,
          'heure_debut', to_char(sh.heure_debut, 'HH24:MI'),
          'heure_fin', to_char(sh.heure_fin, 'HH24:MI'),
          'statut', CASE WHEN s.statut = 'ouverte' THEN 'Ouverte' ELSE 'Fermée' END,
          'qte_ouverture', COALESCE(SUM(d.qte_ouverture), 0),
          'valeur_ouverture', COALESCE(SUM(d.valeur_ouverture), 0),
          'qte_entrees', COALESCE(SUM(d.qte_entrees), 0),
          'valeur_entrees', COALESCE(SUM(d.valeur_entrees), 0),
          'qte_vendues', COALESCE(SUM(d.qte_vendues), 0),
          'valeur_vendues', COALESCE(SUM(d.valeur_vendues), 0),
          'qte_sorties_autres', COALESCE(SUM(d.qte_sorties_autres), 0),
          'valeur_sorties_autres', COALESCE(SUM(d.valeur_sorties_autres), 0),
          'qte_cloture', COALESCE(SUM(d.qte_cloture), 0),
          'valeur_cloture', COALESCE(SUM(d.valeur_cloture), 0),
          'produits_mouvementes', COUNT(*) FILTER (
            WHERE d.qte_entrees <> 0 OR d.qte_vendues <> 0 OR d.qte_sorties_autres <> 0
          )
        ) AS r,
        s.business_date AS sort_date,
        sh.ordre AS sort_shift
      FROM sessions_shift s
      JOIN shifts sh ON sh.id = s.shift_id
      CROSS JOIN LATERAL public.stock_session_detail(
        s.etablissement_id, s.ouverte_le, COALESCE(s.fermee_le, NOW()), s.business_date
      ) d
      WHERE s.etablissement_id = v_profile.etablissement_id
        AND s.business_date BETWEEN v_debut AND v_fin
        AND (v_session_id IS NULL OR s.id = v_session_id)
        AND (v_shift_nom IS NULL OR sh.nom = v_shift_nom)
      GROUP BY s.id, s.business_date, sh.nom, sh.heure_debut, sh.heure_fin, sh.ordre, s.statut
    ) x;
  END IF;

  -- Totaux de la plage
  SELECT jsonb_build_object(
    'sessions', COUNT(DISTINCT s.id),
    'qte_entrees', COALESCE(SUM(d.qte_entrees), 0),
    'valeur_entrees', COALESCE(SUM(d.valeur_entrees), 0),
    'qte_vendues', COALESCE(SUM(d.qte_vendues), 0),
    'valeur_vendues', COALESCE(SUM(d.valeur_vendues), 0),
    'qte_sorties_autres', COALESCE(SUM(d.qte_sorties_autres), 0),
    'valeur_sorties_autres', COALESCE(SUM(d.valeur_sorties_autres), 0),
    'valeur_cloture', COALESCE(SUM(d.valeur_cloture), 0)
  )
  INTO v_totaux
  FROM sessions_shift s
  JOIN shifts sh ON sh.id = s.shift_id
  CROSS JOIN LATERAL public.stock_session_detail(
    s.etablissement_id, s.ouverte_le, COALESCE(s.fermee_le, NOW()), s.business_date
  ) d
  WHERE s.etablissement_id = v_profile.etablissement_id
    AND s.business_date BETWEEN v_debut AND v_fin
    AND (v_session_id IS NULL OR s.id = v_session_id)
    AND (v_shift_nom IS NULL OR sh.nom = v_shift_nom);

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

GRANT EXECUTE ON FUNCTION public.get_export_stock_shift_dataset(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, JSONB) TO authenticated;

COMMENT ON FUNCTION public.get_export_stock_shift_dataset(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, JSONB) IS
  'Rapprochement de stock par session de shift : synthèse par session ou détail session x produit.';

-- ============================================================================
-- 4. ROUTAGE
-- ============================================================================

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
  IF p_type IN ('rapport_stock_shift', 'rapport_stock_shift_produit') THEN
    RETURN public.get_export_stock_shift_dataset(p_type, p_date_debut, p_date_fin, p_filtres);
  END IF;

  IF p_type = 'journal_sessions_shift' THEN
    RETURN public.get_export_sessions_shift_dataset(p_type, p_date_debut, p_date_fin, p_filtres);
  END IF;

  IF p_type = 'journal_factures' THEN
    RETURN public.get_export_factures(p_type, p_date_debut, p_date_fin, p_filtres);
  END IF;

  IF p_type = 'rapport_stock_journalier' THEN
    RETURN public.get_export_stock_produits(p_type, p_date_debut, p_date_fin, p_filtres);
  END IF;

  IF p_type = 'rapport_stock_synthese' THEN
    RETURN public.get_export_stock_dataset('rapport_stock_journalier', p_date_debut, p_date_fin, p_filtres);
  END IF;

  IF p_type = 'rapport_stock_jour_produit' THEN
    RETURN public.get_export_stock_jour_produit(p_type, p_date_debut, p_date_fin, p_filtres);
  END IF;

  IF p_type = 'journal_mouvements_stock' THEN
    RETURN public.get_export_stock_dataset(p_type, p_date_debut, p_date_fin, p_filtres);
  END IF;

  RETURN public.get_export_dataset_core(p_type, p_date_debut, p_date_fin, p_filtres);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_export_dataset(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, JSONB) TO authenticated;

NOTIFY pgrst, 'reload schema';
