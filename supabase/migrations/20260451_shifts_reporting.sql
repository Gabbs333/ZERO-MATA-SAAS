-- Migration: Shifts — reporting des sessions, réglages de journée d'exploitation
-- Description:
--   Phase 3 du plan « shifts ». Ajoute :
--     1. `get_sessions_shift(p_debut, p_fin)` : liste des sessions de shift
--        d'une plage de journées d'exploitation, avec toutes les métriques
--        nécessaires aux cartes de passation (CA bar/cuisine, encaissements par
--        mode, mouvements hors ventes, solde théorique, écart, agents).
--     2. `set_heure_debut_journee(p_heure)` : réglage du début de journée
--        d'exploitation. Les colonnes d'`etablissements` ne sont modifiables
--        que par l'admin via RLS ; cette RPC ouvre le réglage au patron/gérant
--        de l'établissement, sans élargir la RLS.
--     3. `get_export_sessions_shift_dataset` + routage de `get_export_dataset`
--        pour le type `journal_sessions_shift` (CSV/XLSX/PDF côté patron).
--
--   Lecture seule sur les données existantes : aucune écriture rétroactive,
--   aucune donnée historique modifiée.
-- Created: 2026-04-51

-- ============================================================================
-- 1. LISTE DES SESSIONS DE SHIFT
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_sessions_shift(
  p_debut DATE DEFAULT NULL,
  p_fin DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile RECORD;
  v_etab RECORD;
  v_debut DATE;
  v_fin DATE;
  v_rows JSONB;
  v_totaux JSONB;
BEGIN
  SELECT id, role, etablissement_id, actif, nom, prenom
  INTO v_profile
  FROM profiles WHERE id = auth.uid();

  IF NOT FOUND OR COALESCE(v_profile.actif, true) <> true THEN
    RAISE EXCEPTION 'Accès refusé.';
  END IF;
  IF v_profile.etablissement_id IS NULL THEN
    RAISE EXCEPTION 'Aucun établissement associé à votre compte.';
  END IF;

  SELECT * INTO v_etab FROM etablissements WHERE id = v_profile.etablissement_id;

  v_debut := COALESCE(p_debut, (CURRENT_DATE - INTERVAL '30 days')::date);
  v_fin := COALESCE(p_fin, CURRENT_DATE);
  IF v_debut > v_fin THEN
    RAISE EXCEPTION 'Période invalide.';
  END IF;

  SELECT COALESCE(jsonb_agg(r ORDER BY sort_date DESC, sort_shift, sort_ouverte), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT jsonb_build_object(
      'id', s.id,
      'business_date', s.business_date,
      'statut', s.statut,
      'shift_id', sh.id,
      'shift_nom', sh.nom,
      'shift_ordre', sh.ordre,
      'heure_debut', to_char(sh.heure_debut, 'HH24:MI'),
      'heure_fin', to_char(sh.heure_fin, 'HH24:MI'),
      'traverse_minuit', sh.traverse_minuit,
      'ouverte_le', s.ouverte_le,
      'fermee_le', s.fermee_le,
      'ouverte_par', COALESCE(NULLIF(TRIM(CONCAT_WS(' ', op.prenom, op.nom)), ''), '—'),
      'fermee_par', COALESCE(NULLIF(TRIM(CONCAT_WS(' ', fp.prenom, fp.nom)), ''), '—'),
      'fond_initial', s.fond_initial,
      'ventes', COALESCE(fa.total, 0),
      'ventes_bar', COALESCE(fa.total_bar, 0),
      'ventes_cuisine', COALESCE(fa.total_cuisine, 0),
      'nombre_commandes', COALESCE(fa.nb_commandes, 0),
      'montant_impayes', COALESCE(fa.total_impayes, 0),
      'encaissements', COALESCE(enc.total, 0),
      'encaissements_par_mode', COALESCE(enc.par_mode, '{}'::jsonb),
      'nombre_encaissements', COALESCE(enc.nb, 0),
      'entrees_hors_ventes', COALESCE(mv.entrees, 0),
      'sorties_hors_ventes', COALESCE(mv.sorties, 0),
      'solde_theorique', s.fond_initial + COALESCE(enc.total, 0) + COALESCE(mv.entrees, 0) - COALESCE(mv.sorties, 0),
      'montant_compte', s.montant_compte,
      'ecart', s.ecart,
      'commentaire', s.commentaire
    ) AS r,
    s.business_date AS sort_date,
    sh.ordre AS sort_shift,
    s.ouverte_le AS sort_ouverte
    FROM sessions_shift s
    JOIN shifts sh ON sh.id = s.shift_id
    LEFT JOIN profiles op ON op.id = s.ouverte_par
    LEFT JOIN profiles fp ON fp.id = s.fermee_par
    LEFT JOIN LATERAL (
      SELECT
        SUM(fd.montant_total) AS total,
        SUM(fd.bar_montant_total) AS total_bar,
        SUM(fd.cuisine_montant_total) AS total_cuisine,
        SUM(fd.bar_montant_restant + fd.cuisine_montant_restant) AS total_impayes,
        COUNT(DISTINCT c.id) AS nb_commandes
      FROM factures_departements fd
      JOIN commandes c ON c.id = fd.commande_id
      WHERE c.session_id = s.id
    ) fa ON TRUE
    LEFT JOIN LATERAL (
      SELECT
        SUM(m.total) AS total,
        SUM(m.nb) AS nb,
        jsonb_object_agg(m.mode_paiement, m.total) AS par_mode
      FROM (
        SELECT mode_paiement, SUM(montant)::BIGINT AS total, COUNT(*) AS nb
        FROM encaissements
        WHERE session_id = s.id
        GROUP BY mode_paiement
      ) m
    ) enc ON TRUE
    LEFT JOIN LATERAL (
      SELECT
        SUM(CASE WHEN type = 'entree' AND encaissement_id IS NULL THEN montant ELSE 0 END) AS entrees,
        SUM(CASE WHEN type = 'sortie' AND encaissement_id IS NULL THEN montant ELSE 0 END) AS sorties
      FROM mouvements_caisse
      WHERE session_id = s.id
    ) mv ON TRUE
    WHERE s.etablissement_id = v_profile.etablissement_id
      AND s.business_date BETWEEN v_debut AND v_fin
  ) x;

  -- Totaux de la plage (toutes sessions confondues)
  SELECT jsonb_build_object(
    'sessions', COUNT(*),
    'sessions_ouvertes', COUNT(*) FILTER (WHERE s.statut = 'ouverte'),
    'ventes', COALESCE(SUM(COALESCE(fa.total, 0)), 0),
    'ventes_bar', COALESCE(SUM(COALESCE(fa.total_bar, 0)), 0),
    'ventes_cuisine', COALESCE(SUM(COALESCE(fa.total_cuisine, 0)), 0),
    'encaissements', COALESCE(SUM(COALESCE(enc.total, 0)), 0),
    'ecart_cumule', COALESCE(SUM(CASE WHEN s.ecart IS NOT NULL THEN s.ecart ELSE 0 END), 0),
    'nb_ecarts', COUNT(*) FILTER (WHERE s.ecart IS NOT NULL AND s.ecart <> 0)
  )
  INTO v_totaux
  FROM sessions_shift s
  LEFT JOIN LATERAL (
    SELECT
      SUM(fd.montant_total) AS total,
      SUM(fd.bar_montant_total) AS total_bar,
      SUM(fd.cuisine_montant_total) AS total_cuisine
    FROM factures_departements fd
    JOIN commandes c ON c.id = fd.commande_id
    WHERE c.session_id = s.id
  ) fa ON TRUE
  LEFT JOIN LATERAL (
    SELECT SUM(e.montant) AS total
    FROM encaissements e
    WHERE e.session_id = s.id
  ) enc ON TRUE
  WHERE s.etablissement_id = v_profile.etablissement_id
    AND s.business_date BETWEEN v_debut AND v_fin;

  RETURN jsonb_build_object(
    'etablissement', jsonb_build_object(
      'id', v_etab.id,
      'nom', v_etab.nom,
      'devise', COALESCE(v_etab.devise, 'XAF'),
      'fuseau_horaire', COALESCE(v_etab.fuseau_horaire, 'Africa/Douala'),
      'heure_debut_journee', to_char(COALESCE(v_etab.heure_debut_journee, TIME '00:00'), 'HH24:MI')
    ),
    'periode', jsonb_build_object('debut', v_debut, 'fin', v_fin),
    'sessions', v_rows,
    'totaux', v_totaux
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_sessions_shift(DATE, DATE) TO authenticated;

COMMENT ON FUNCTION public.get_sessions_shift(DATE, DATE) IS
  'Sessions de shift de l''établissement de l''appelant, avec métriques de passation (CA bar/cuisine, encaissements, écart).';

-- ============================================================================
-- 2. RÉGLAGE DU DÉBUT DE JOURNÉE D'EXPLOITATION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_heure_debut_journee(p_heure TIME)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile RECORD;
BEGIN
  SELECT id, role, etablissement_id, actif INTO v_profile
  FROM profiles WHERE id = auth.uid();

  IF NOT FOUND OR COALESCE(v_profile.actif, true) <> true THEN
    RAISE EXCEPTION 'Accès refusé.';
  END IF;
  IF v_profile.role NOT IN ('patron', 'gerant') AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Seul le propriétaire ou le gérant peut modifier la journée d''exploitation.';
  END IF;
  IF v_profile.etablissement_id IS NULL THEN
    RAISE EXCEPTION 'Aucun établissement associé à votre compte.';
  END IF;
  IF p_heure IS NULL THEN
    RAISE EXCEPTION 'Heure obligatoire.';
  END IF;

  UPDATE etablissements
  SET heure_debut_journee = p_heure
  WHERE id = v_profile.etablissement_id;

  RETURN jsonb_build_object(
    'heure_debut_journee', to_char(p_heure, 'HH24:MI'),
    'message', 'Journée d''exploitation mise à jour.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_heure_debut_journee(TIME) TO authenticated;

COMMENT ON FUNCTION public.set_heure_debut_journee(TIME) IS
  'Permet au patron/gérant de définir l''heure de début de la journée d''exploitation (ex. 06:00 pour un 24/24).';

-- ============================================================================
-- 3. DATASET D'EXPORT DES SESSIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_export_sessions_shift_dataset(
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
  v_shift_nom TEXT := NULLIF(TRIM(p_filtres->>'shift'), '');
  v_statut TEXT := NULLIF(LOWER(p_filtres->>'statut'), '');
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

  SELECT COALESCE(jsonb_agg(r ORDER BY sort_date DESC, sort_shift), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT jsonb_build_object(
      'business_date', to_char(s.business_date, 'DD/MM/YYYY'),
      'shift', sh.nom,
      'heure_debut', to_char(sh.heure_debut, 'HH24:MI'),
      'heure_fin', to_char(sh.heure_fin, 'HH24:MI'),
      'statut', CASE WHEN s.statut = 'ouverte' THEN 'Ouverte' ELSE 'Fermée' END,
      'ouverte_le', to_char(s.ouverte_le AT TIME ZONE v_tz, 'DD/MM/YYYY HH24:MI'),
      'fermee_le', CASE WHEN s.fermee_le IS NOT NULL
                        THEN to_char(s.fermee_le AT TIME ZONE v_tz, 'DD/MM/YYYY HH24:MI') ELSE '' END,
      'ouverte_par', COALESCE(NULLIF(TRIM(CONCAT_WS(' ', op.prenom, op.nom)), ''), '—'),
      'fermee_par', COALESCE(NULLIF(TRIM(CONCAT_WS(' ', fp.prenom, fp.nom)), ''), '—'),
      'fond_initial', s.fond_initial,
      'ventes_bar', COALESCE(fa.total_bar, 0),
      'ventes_cuisine', COALESCE(fa.total_cuisine, 0),
      'ventes_total', COALESCE(fa.total, 0),
      'commandes', COALESCE(fa.nb_commandes, 0),
      'impayes', COALESCE(fa.total_impayes, 0),
      'encaisse_especes', COALESCE((enc.par_mode->>'especes')::BIGINT, 0),
      'encaisse_mobile_money', COALESCE((enc.par_mode->>'mobile_money')::BIGINT, 0),
      'encaisse_autre',
        COALESCE(enc.total, 0)
        - COALESCE((enc.par_mode->>'especes')::BIGINT, 0)
        - COALESCE((enc.par_mode->>'mobile_money')::BIGINT, 0),
      'encaissements', COALESCE(enc.total, 0),
      'entrees_hors_ventes', COALESCE(mv.entrees, 0),
      'sorties_hors_ventes', COALESCE(mv.sorties, 0),
      'solde_theorique', s.fond_initial + COALESCE(enc.total, 0) + COALESCE(mv.entrees, 0) - COALESCE(mv.sorties, 0),
      'montant_compte', COALESCE(s.montant_compte, 0),
      'ecart', COALESCE(s.ecart, 0),
      'commentaire', COALESCE(s.commentaire, '')
    ) AS r,
    s.business_date AS sort_date,
    sh.ordre AS sort_shift
    FROM sessions_shift s
    JOIN shifts sh ON sh.id = s.shift_id
    LEFT JOIN profiles op ON op.id = s.ouverte_par
    LEFT JOIN profiles fp ON fp.id = s.fermee_par
    LEFT JOIN LATERAL (
      SELECT
        SUM(fd.montant_total) AS total,
        SUM(fd.bar_montant_total) AS total_bar,
        SUM(fd.cuisine_montant_total) AS total_cuisine,
        SUM(fd.bar_montant_restant + fd.cuisine_montant_restant) AS total_impayes,
        COUNT(DISTINCT c.id) AS nb_commandes
      FROM factures_departements fd
      JOIN commandes c ON c.id = fd.commande_id
      WHERE c.session_id = s.id
    ) fa ON TRUE
    LEFT JOIN LATERAL (
      SELECT SUM(mm.total) AS total, jsonb_object_agg(mm.mode_paiement, mm.total) AS par_mode
      FROM (
        SELECT mode_paiement, SUM(montant)::BIGINT AS total
        FROM encaissements
        WHERE session_id = s.id
        GROUP BY mode_paiement
      ) mm
    ) enc ON TRUE
    LEFT JOIN LATERAL (
      SELECT
        SUM(CASE WHEN type = 'entree' AND encaissement_id IS NULL THEN montant ELSE 0 END) AS entrees,
        SUM(CASE WHEN type = 'sortie' AND encaissement_id IS NULL THEN montant ELSE 0 END) AS sorties
      FROM mouvements_caisse
      WHERE session_id = s.id
    ) mv ON TRUE
    WHERE s.etablissement_id = v_profile.etablissement_id
      AND s.business_date BETWEEN v_debut AND v_fin
      AND (v_shift_nom IS NULL OR sh.nom = v_shift_nom)
      AND (v_statut IS NULL OR s.statut = v_statut)
  ) x;

  SELECT jsonb_build_object(
    'sessions', COUNT(*),
    'ventes', COALESCE(SUM(COALESCE(fa.total, 0)), 0),
    'ventes_bar', COALESCE(SUM(COALESCE(fa.total_bar, 0)), 0),
    'ventes_cuisine', COALESCE(SUM(COALESCE(fa.total_cuisine, 0)), 0),
    'encaissements', COALESCE(SUM(COALESCE(enc.total, 0)), 0),
    'impayes', COALESCE(SUM(COALESCE(fa.total_impayes, 0)), 0),
    'ecart_cumule', COALESCE(SUM(COALESCE(s.ecart, 0)), 0)
  )
  INTO v_totaux
  FROM sessions_shift s
  JOIN shifts sh ON sh.id = s.shift_id
  LEFT JOIN LATERAL (
    SELECT
      SUM(fd.montant_total) AS total,
      SUM(fd.bar_montant_total) AS total_bar,
      SUM(fd.cuisine_montant_total) AS total_cuisine,
      SUM(fd.bar_montant_restant + fd.cuisine_montant_restant) AS total_impayes
    FROM factures_departements fd
    JOIN commandes c ON c.id = fd.commande_id
    WHERE c.session_id = s.id
  ) fa ON TRUE
  LEFT JOIN LATERAL (
    SELECT SUM(montant) AS total FROM encaissements WHERE session_id = s.id
  ) enc ON TRUE
  WHERE s.etablissement_id = v_profile.etablissement_id
    AND s.business_date BETWEEN v_debut AND v_fin
    AND (v_shift_nom IS NULL OR sh.nom = v_shift_nom)
    AND (v_statut IS NULL OR s.statut = v_statut);

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

GRANT EXECUTE ON FUNCTION public.get_export_sessions_shift_dataset(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, JSONB) TO authenticated;

COMMENT ON FUNCTION public.get_export_sessions_shift_dataset(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, JSONB) IS
  'Journal des sessions de shift (une ligne par session) pour l''établissement de l''appelant.';

-- ============================================================================
-- 4. ROUTAGE DE get_export_dataset
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

COMMENT ON FUNCTION public.get_export_dataset(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, JSONB) IS
  'Point d''entrée unique des exports comptables. Délègue aux jeux de données ventes / caisse / stock / shifts selon le type demandé.';

-- ============================================================================
-- 5. get_solde_session — ventilation bar/cuisine alignée sur le reporting
-- ============================================================================
--
--   La version initiale de `get_solde_session` déduisait le département du
--   suffixe du numéro de facture (-BAR / -CUI). Or une facture non scindée
--   (commande 100 % boissons, ou historique antérieur au scindage) n'a pas de
--   suffixe : elle était alors comptée en « ventes » mais ni en bar ni en
--   cuisine. On s'appuie désormais sur la vue `factures_departements`, qui
--   ventile aussi les factures non scindées au prorata des articles.
--   Contrat de sortie inchangé (le bandeau comptoir continue de fonctionner).

CREATE OR REPLACE FUNCTION public.get_solde_session(p_session_id UUID)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile RECORD;
  v_session RECORD;
  v_shift RECORD;
  v_enc BIGINT := 0;
  v_entrees BIGINT := 0;
  v_sorties BIGINT := 0;
  v_ca BIGINT := 0;
  v_ca_bar BIGINT := 0;
  v_ca_cuisine BIGINT := 0;
  v_nb_commandes BIGINT := 0;
  v_modes JSON;
  v_theorique BIGINT := 0;
BEGIN
  SELECT role, etablissement_id, actif INTO v_profile FROM profiles WHERE id = auth.uid();
  IF NOT FOUND OR COALESCE(v_profile.actif, true) <> true THEN
    RAISE EXCEPTION 'Accès refusé.';
  END IF;

  SELECT * INTO v_session FROM sessions_shift WHERE id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session introuvable.';
  END IF;
  IF v_session.etablissement_id <> v_profile.etablissement_id AND v_profile.role <> 'patron' THEN
    RAISE EXCEPTION 'Session d''un autre établissement.';
  END IF;

  SELECT * INTO v_shift FROM shifts WHERE id = v_session.shift_id;

  SELECT COALESCE(SUM(montant), 0) INTO v_enc
  FROM encaissements WHERE session_id = p_session_id;

  SELECT
    COALESCE(SUM(CASE WHEN type = 'entree' AND encaissement_id IS NULL THEN montant END), 0),
    COALESCE(SUM(CASE WHEN type = 'sortie' AND encaissement_id IS NULL THEN montant END), 0)
  INTO v_entrees, v_sorties
  FROM mouvements_caisse WHERE session_id = p_session_id;

  SELECT
    COALESCE(SUM(fd.montant_total), 0),
    COALESCE(SUM(fd.bar_montant_total), 0),
    COALESCE(SUM(fd.cuisine_montant_total), 0),
    COUNT(DISTINCT c.id)
  INTO v_ca, v_ca_bar, v_ca_cuisine, v_nb_commandes
  FROM factures_departements fd
  JOIN commandes c ON c.id = fd.commande_id
  WHERE c.session_id = p_session_id;

  SELECT COALESCE(json_object_agg(mode_paiement, total), '{}'::json)
  INTO v_modes
  FROM (
    SELECT mode_paiement, SUM(montant)::BIGINT AS total
    FROM encaissements
    WHERE session_id = p_session_id
    GROUP BY mode_paiement
  ) m;

  v_theorique := v_session.fond_initial + v_enc + v_entrees - v_sorties;

  RETURN json_build_object(
    'session_id', v_session.id,
    'statut', v_session.statut,
    'business_date', v_session.business_date,
    'shift', json_build_object('nom', v_shift.nom, 'heure_debut', v_shift.heure_debut, 'heure_fin', v_shift.heure_fin),
    'ouverte_le', v_session.ouverte_le,
    'fermee_le', v_session.fermee_le,
    'fond_initial', v_session.fond_initial,
    'ventes', v_ca,
    'ventes_bar', v_ca_bar,
    'ventes_cuisine', v_ca_cuisine,
    'nombre_commandes', v_nb_commandes,
    'encaissements', v_enc,
    'encaissements_par_mode', v_modes,
    'entrees_hors_ventes', v_entrees,
    'sorties_hors_ventes', v_sorties,
    'solde_theorique', v_theorique,
    'montant_compte', v_session.montant_compte,
    'ecart', v_session.ecart
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_solde_session(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_solde_session(UUID) IS
  'Solde et métriques d''une session de shift (ventilation bar/cuisine via factures_departements).';

NOTIFY pgrst, 'reload schema';
