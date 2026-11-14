-- Migration: Comptage physique de stock par shift (passation)
-- Description:
--   Le comptage physique existant (`clotures_stock_journalieres`) est journalier :
--   il ne permet pas de constater les écarts à chaque passation de shift, alors
--   que c'est précisément le moment où le comptage est pratiqué.
--
--   Cette migration ajoute un comptage **rattaché à la session** :
--     1. `comptages_shift` : une ligne par session et par produit (théorique
--        figé au moment du comptage, compté, écart quantité et valeur).
--     2. Saisie depuis le comptoir au moment de la clôture :
--        `enregistrer_comptage_shift()` enregistre les quantités comptées et,
--        si demandé, aligne le stock via un mouvement d'ajustement.
--     3. `get_comptage_shift_preparation()` : pré-remplit le formulaire de
--        passation avec les quantités théoriques de clôture.
--     4. `stock_session_detail()` expose désormais le compté du shift.
--     5. `get_rapprochement_stock_session()` et `get_sessions_shift()` exposent
--        l'écart de comptage par shift (le comptage journalier est conservé,
--        sous le nom `comptage_jour`).
--     6. Exports : colonnes de comptage ajoutées aux rapports stock par shift
--        et au journal des sessions.
--
--   Modèle d'écart :
--     ecart_qte    = quantite_comptee - quantite_theorique (figée au comptage)
--     ecart_valeur = ecart_qte * cout_unitaire
--   L'ajustement de stock est calculé sur le stock courant
--   (comptee - stock_actuel), ce qui rend l'opération rejouable sans cumul.
--
-- Created: 2026-04-53

-- ============================================================================
-- 1. TABLE DES COMPTAGES DE SHIFT
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.comptages_shift (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id UUID NOT NULL REFERENCES public.etablissements(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.sessions_shift(id) ON DELETE CASCADE,
  produit_id UUID NOT NULL REFERENCES public.produits(id) ON DELETE RESTRICT,
  quantite_theorique INTEGER NOT NULL DEFAULT 0,
  quantite_comptee INTEGER NOT NULL DEFAULT 0 CHECK (quantite_comptee >= 0),
  cout_unitaire INTEGER NOT NULL DEFAULT 0,
  ecart_qte INTEGER NOT NULL DEFAULT 0,
  ecart_valeur INTEGER NOT NULL DEFAULT 0,
  commentaire TEXT,
  utilisateur_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  date_comptage TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, produit_id)
);

CREATE INDEX IF NOT EXISTS idx_comptages_shift_session
  ON public.comptages_shift (session_id);

CREATE INDEX IF NOT EXISTS idx_comptages_shift_etab_date
  ON public.comptages_shift (etablissement_id, date_comptage DESC);

ALTER TABLE public.comptages_shift ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS comptages_shift_read ON public.comptages_shift;
CREATE POLICY comptages_shift_read ON public.comptages_shift
  FOR SELECT
  USING (
    etablissement_id IN (SELECT p.etablissement_id FROM public.profiles p WHERE p.id = auth.uid())
    OR public.is_admin()
  );

DROP POLICY IF EXISTS comptages_shift_write ON public.comptages_shift;
CREATE POLICY comptages_shift_write ON public.comptages_shift
  FOR ALL
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.actif = TRUE
        AND p.role IN ('comptoir', 'patron', 'gerant')
        AND p.etablissement_id = comptages_shift.etablissement_id
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.actif = TRUE
        AND p.role IN ('comptoir', 'patron', 'gerant')
        AND p.etablissement_id = comptages_shift.etablissement_id
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.comptages_shift TO authenticated;

-- ============================================================================
-- 2. stock_session_detail() v2 — compté du shift
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
      COALESCE(mv.q_ajust, 0) AS qte_ajustements,
      COALESCE(mv.v_ajust, 0) AS valeur_ajustements,
      pr.qte_actuelle - COALESCE(mv.delta_apres, 0) AS qte_cloture,
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
    c.qte_ajustements,
    c.valeur_ajustements,
    COALESCE(cs.quantite_comptee, 0) AS qte_comptee,
    COALESCE(cs.ecart_qte, 0) AS ecart_qte_comptage,
    COALESCE(cs.ecart_valeur, 0) AS ecart_valeur_comptage,
    cs.date_comptage AS compte_le,
    COALESCE(cj.quantite_reelle, 0) AS qte_comptee_jour,
    COALESCE(cj.ecart_qte, 0) AS ecart_qte_jour,
    COALESCE(cj.ecart_valeur, 0) AS ecart_valeur_jour
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
  'Rapprochement de stock d''une session (théorique valorisé) + comptage physique du shift et comptage journalier s''ils existent.';

-- ============================================================================
-- 3. PRÉPARATION DU FORMULAIRE DE PASSATION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_comptage_shift_preparation(p_session_id UUID)
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
  v_produits JSONB := '[]'::jsonb;
  v_resume JSONB;
BEGIN
  SELECT id, role, etablissement_id, actif INTO v_profile FROM profiles WHERE id = auth.uid();
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

  SELECT COALESCE(jsonb_agg(r ORDER BY nom), '[]'::jsonb)
  INTO v_produits
  FROM (
    SELECT
      jsonb_build_object(
        'produit_id', d.produit_id,
        'produit_nom', d.produit_nom,
        'categorie', COALESCE(d.categorie, '—'),
        'departement', d.departement,
        'cout_unitaire', d.cout_unitaire,
        'quantite_theorique', CASE WHEN d.compte_le IS NOT NULL
                                   THEN d.qte_comptee - d.ecart_qte_comptage
                                   ELSE d.qte_cloture END,
        'quantite_comptee', CASE WHEN d.compte_le IS NOT NULL THEN d.qte_comptee ELSE NULL END,
        'deja_compte', d.compte_le IS NOT NULL,
        'valeur_ecart', d.ecart_valeur_comptage
      ) AS r,
      d.produit_nom AS nom
    FROM public.stock_session_detail(
           v_session.etablissement_id,
           v_session.ouverte_le,
           COALESCE(v_session.fermee_le, NOW()),
           v_session.business_date,
           v_session.id
         ) d
  ) x;

  SELECT jsonb_build_object(
    'produits_comptes', COUNT(*),
    'ecart_qte', COALESCE(SUM(ecart_qte), 0),
    'ecart_valeur', COALESCE(SUM(ecart_valeur), 0),
    'date_comptage', MAX(date_comptage)
  )
  INTO v_resume
  FROM comptages_shift
  WHERE session_id = p_session_id;

  RETURN jsonb_build_object(
    'session_id', v_session.id,
    'business_date', v_session.business_date,
    'statut', v_session.statut,
    'shift', jsonb_build_object('nom', v_shift.nom, 'heure_debut', to_char(v_shift.heure_debut, 'HH24:MI'), 'heure_fin', to_char(v_shift.heure_fin, 'HH24:MI')),
    'comptage_existant', v_resume,
    'produits', v_produits
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_comptage_shift_preparation(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_comptage_shift_preparation(UUID) IS
  'Prépare la saisie du comptage physique de stock d''une session (théorique pré-rempli, compté déjà saisi).';

-- ============================================================================
-- 4. SAISIE DU COMPTAGE (ET AJUSTEMENT DE STOCK)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enregistrer_comptage_shift(
  p_session_id UUID,
  p_lignes JSONB,
  p_commentaire TEXT DEFAULT NULL,
  p_appliquer_ajustement BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_profile RECORD;
  v_session RECORD;
  v_shift RECORD;
  v_ligne JSONB;
  v_produit_id UUID;
  v_comptee INTEGER;
  v_theorique INTEGER;
  v_theorique_fige INTEGER;
  v_deja_compte BOOLEAN;
  v_cout INTEGER;
  v_stock INTEGER;
  v_ecart INTEGER;
  v_ecart_valeur INTEGER;
  v_delta INTEGER;
  v_nb INTEGER := 0;
  v_ajustements INTEGER := 0;
  v_ecart_total INTEGER := 0;
  v_ecart_valeur_total INTEGER := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Non authentifié.';
  END IF;

  SELECT id, role, etablissement_id, actif INTO v_profile FROM profiles WHERE id = v_uid;
  IF NOT FOUND OR COALESCE(v_profile.actif, true) <> true THEN
    RAISE EXCEPTION 'Accès refusé.';
  END IF;

  SELECT * INTO v_session FROM sessions_shift WHERE id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session introuvable.';
  END IF;

  IF public.is_admin() IS NOT TRUE THEN
    IF v_session.etablissement_id <> v_profile.etablissement_id THEN
      RAISE EXCEPTION 'Session d''un autre établissement.';
    END IF;
    IF v_profile.role NOT IN ('comptoir', 'gerant', 'patron') THEN
      RAISE EXCEPTION 'Seul le comptoir, le gérant ou le propriétaire peut enregistrer un comptage.';
    END IF;
  END IF;

  IF v_session.statut <> 'ouverte' THEN
    RAISE EXCEPTION 'Le comptage physique se saisit avant la clôture de la session.';
  END IF;

  IF p_lignes IS NULL OR jsonb_typeof(p_lignes) <> 'array' OR jsonb_array_length(p_lignes) = 0 THEN
    RAISE EXCEPTION 'Aucune ligne de comptage fournie.';
  END IF;

  SELECT * INTO v_shift FROM shifts WHERE id = v_session.shift_id;

  FOR v_ligne IN SELECT * FROM jsonb_array_elements(p_lignes)
  LOOP
    v_produit_id := NULLIF(v_ligne->>'produit_id', '')::UUID;
    IF v_produit_id IS NULL THEN
      CONTINUE;
    END IF;
    IF v_ligne->>'quantite_comptee' IS NULL THEN
      CONTINUE;
    END IF;

    v_comptee := GREATEST(0, COALESCE((v_ligne->>'quantite_comptee')::NUMERIC, 0)::INTEGER);

    -- Théorique figé, coût et stock courant du produit
    SELECT d.qte_cloture, d.cout_unitaire
    INTO v_theorique, v_cout
    FROM public.stock_session_detail(
           v_session.etablissement_id,
           v_session.ouverte_le,
           COALESCE(v_session.fermee_le, NOW()),
           v_session.business_date,
           v_session.id
         ) d
    WHERE d.produit_id = v_produit_id;

    IF NOT FOUND THEN
      CONTINUE; -- produit non suivi en stock
    END IF;

    SELECT COALESCE(quantite_actuelle, 0) INTO v_stock
    FROM stocks
    WHERE produit_id = v_produit_id
      AND etablissement_id = v_session.etablissement_id;

    -- Le théorique est figé au premier comptage : un nouvel enregistrement
    -- (correction du compté) ne doit pas réécrire l'écart constaté.
    v_deja_compte := FALSE;
    SELECT cs.quantite_theorique INTO v_theorique_fige
    FROM comptages_shift cs
    WHERE cs.session_id = p_session_id AND cs.produit_id = v_produit_id;

    IF FOUND THEN
      v_theorique := v_theorique_fige;
      v_deja_compte := TRUE;
    END IF;

    v_stock := COALESCE(v_stock, 0);
    v_ecart := v_comptee - v_theorique;
    v_ecart_valeur := v_ecart * COALESCE(v_cout, 0);

    INSERT INTO comptages_shift (
      etablissement_id, session_id, produit_id,
      quantite_theorique, quantite_comptee, cout_unitaire,
      ecart_qte, ecart_valeur, commentaire, utilisateur_id
    ) VALUES (
      v_session.etablissement_id, p_session_id, v_produit_id,
      v_theorique, v_comptee, COALESCE(v_cout, 0),
      v_ecart, v_ecart_valeur, NULLIF(TRIM(p_commentaire), ''), v_uid
    )
    ON CONFLICT (session_id, produit_id) DO UPDATE
    SET quantite_theorique = CASE WHEN v_deja_compte
                                  THEN comptages_shift.quantite_theorique
                                  ELSE EXCLUDED.quantite_theorique END,
        quantite_comptee = EXCLUDED.quantite_comptee,
        cout_unitaire = EXCLUDED.cout_unitaire,
        ecart_qte = EXCLUDED.ecart_qte,
        ecart_valeur = EXCLUDED.ecart_valeur,
        commentaire = EXCLUDED.commentaire,
        utilisateur_id = EXCLUDED.utilisateur_id,
        date_comptage = NOW();

    v_nb := v_nb + 1;
    v_ecart_total := v_ecart_total + v_ecart;
    v_ecart_valeur_total := v_ecart_valeur_total + v_ecart_valeur;

    -- Alignement du stock sur le compté (delta vs stock courant : rejouable)
    IF p_appliquer_ajustement THEN
      v_delta := v_comptee - v_stock;
      IF v_delta <> 0 THEN
        INSERT INTO mouvements_stock (
          produit_id, type, quantite, cout_unitaire, reference, type_reference,
          utilisateur_id, etablissement_id
        ) VALUES (
          v_produit_id,
          CASE WHEN v_delta > 0 THEN 'entree' ELSE 'sortie' END,
          ABS(v_delta),
          COALESCE(v_cout, 0),
          'Comptage shift ' || v_shift.nom || ' du ' || to_char(v_session.business_date, 'DD/MM/YYYY'),
          'ajustement',
          v_uid,
          v_session.etablissement_id
        );

        -- Alignement physique du stock (aucun trigger ne le fait)
        UPDATE stocks
        SET quantite_actuelle = GREATEST(0, v_stock + v_delta),
            derniere_mise_a_jour = NOW()
        WHERE produit_id = v_produit_id
          AND etablissement_id = v_session.etablissement_id;

        IF NOT FOUND THEN
          INSERT INTO stocks (produit_id, etablissement_id, quantite_actuelle, seuil_alerte, derniere_mise_a_jour)
          VALUES (v_produit_id, v_session.etablissement_id, GREATEST(0, v_comptee), 10, NOW());
        END IF;

        v_ajustements := v_ajustements + 1;
      END IF;
    END IF;
  END LOOP;

  IF v_nb = 0 THEN
    RAISE EXCEPTION 'Aucune ligne exploitable : les produits doivent être suivis en stock.';
  END IF;

  RETURN jsonb_build_object(
    'session_id', p_session_id,
    'produits_comptes', v_nb,
    'ecart_qte', v_ecart_total,
    'ecart_valeur', v_ecart_valeur_total,
    'ajustements', v_ajustements,
    'ajustement_applique', p_appliquer_ajustement
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.enregistrer_comptage_shift(UUID, JSONB, TEXT, BOOLEAN) TO authenticated;

COMMENT ON FUNCTION public.enregistrer_comptage_shift(UUID, JSONB, TEXT, BOOLEAN) IS
  'Enregistre le comptage physique de stock d''une session ouverte et aligne le stock (mouvements d''ajustement) si demandé.';

-- ============================================================================
-- 5. get_rapprochement_stock_session() v2 — comptage du shift
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
  v_comptage_shift JSONB := '{}'::jsonb;
  v_comptage_jour JSONB := '{}'::jsonb;
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

  SELECT COALESCE(jsonb_agg(to_jsonb(d) ORDER BY d.valeur_vendues DESC, d.produit_nom), '[]'::jsonb)
  INTO v_produits
  FROM public.stock_session_detail(
         v_session.etablissement_id, v_debut, v_fin, v_session.business_date, v_session.id
       ) d
  WHERE d.qte_entrees <> 0
     OR d.qte_vendues <> 0
     OR d.qte_sorties_autres <> 0
     OR d.qte_ouverture <> 0
     OR d.qte_cloture <> 0
     OR d.compte_le IS NOT NULL;

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
    'qte_ajustements', COALESCE(SUM(d.qte_ajustements), 0),
    'valeur_ajustements', COALESCE(SUM(d.valeur_ajustements), 0),
    'qte_cloture_avant_comptage', COALESCE(SUM(d.qte_cloture - d.qte_ajustements), 0),
    'valeur_cloture_avant_comptage', COALESCE(SUM(d.valeur_cloture - d.valeur_ajustements), 0),
    'qte_comptee', COALESCE(SUM(d.qte_comptee) FILTER (WHERE d.compte_le IS NOT NULL), 0),
    'ecart_qte_comptage', COALESCE(SUM(d.ecart_qte_comptage), 0),
    'ecart_valeur_comptage', COALESCE(SUM(d.ecart_valeur_comptage), 0),
    'produits_suivis', COUNT(*),
    'produits_mouvementes', COUNT(*) FILTER (
      WHERE d.qte_entrees <> 0 OR d.qte_vendues <> 0 OR d.qte_sorties_autres <> 0
    ),
    'produits_comptes', COUNT(*) FILTER (WHERE d.compte_le IS NOT NULL)
  )
  INTO v_totaux
  FROM public.stock_session_detail(
         v_session.etablissement_id, v_debut, v_fin, v_session.business_date, v_session.id
       ) d;

  SELECT jsonb_build_object(
    'effectue', COUNT(*) > 0,
    'produits_comptes', COUNT(*),
    'ecart_qte', COALESCE(SUM(ecart_qte), 0),
    'ecart_valeur', COALESCE(SUM(ecart_valeur), 0),
    'date_comptage', MAX(date_comptage),
    'portee', 'shift'
  )
  INTO v_comptage_shift
  FROM comptages_shift
  WHERE session_id = p_session_id;

  SELECT jsonb_build_object(
    'disponible', COUNT(*) > 0,
    'date_cloture', v_session.business_date,
    'produits_comptes', COUNT(*),
    'ecart_qte', COALESCE(SUM(cs.ecart_qte), 0),
    'ecart_valeur', COALESCE(SUM(cs.ecart_valeur), 0),
    'portee', 'journee'
  )
  INTO v_comptage_jour
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
    'comptage_shift', v_comptage_shift,
    'comptage_jour', v_comptage_jour,
    'produits', v_produits
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_rapprochement_stock_session(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_rapprochement_stock_session(UUID) IS
  'Rapprochement de stock (théorique + comptage physique) sur la fenêtre d''une session de shift.';

-- ============================================================================
-- 6. get_sessions_shift() v2 — indicateur de comptage
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
      'commentaire', s.commentaire,
      'comptage_stock', jsonb_build_object(
        'effectue', COALESCE(cs.nb, 0) > 0,
        'produits_comptes', COALESCE(cs.nb, 0),
        'ecart_qte', COALESCE(cs.ecart_qte, 0),
        'ecart_valeur', COALESCE(cs.ecart_valeur, 0)
      )
    ) AS r,
    s.business_date AS sort_date,
    sh.ordre AS sort_shift,
    s.ouverte_le AS sort_ouverte
    FROM sessions_shift s
    JOIN shifts sh ON sh.id = s.shift_id
    LEFT JOIN profiles op ON op.id = s.ouverte_par
    LEFT JOIN profiles fp ON fp.id = s.fermee_par
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS nb, SUM(ecart_qte) AS ecart_qte, SUM(ecart_valeur) AS ecart_valeur
      FROM comptages_shift
      WHERE session_id = s.id
    ) cs ON TRUE
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

  SELECT jsonb_build_object(
    'sessions', COUNT(*),
    'sessions_ouvertes', COUNT(*) FILTER (WHERE s.statut = 'ouverte'),
    'ventes', COALESCE(SUM(COALESCE(fa.total, 0)), 0),
    'ventes_bar', COALESCE(SUM(COALESCE(fa.total_bar, 0)), 0),
    'ventes_cuisine', COALESCE(SUM(COALESCE(fa.total_cuisine, 0)), 0),
    'encaissements', COALESCE(SUM(COALESCE(enc.total, 0)), 0),
    'ecart_cumule', COALESCE(SUM(CASE WHEN s.ecart IS NOT NULL THEN s.ecart ELSE 0 END), 0),
    'nb_ecarts', COUNT(*) FILTER (WHERE s.ecart IS NOT NULL AND s.ecart <> 0),
    'sessions_sans_comptage', COUNT(*) FILTER (
      WHERE NOT EXISTS (SELECT 1 FROM comptages_shift c WHERE c.session_id = s.id)
    ),
    'ecart_stock_valeur', COALESCE(SUM(st.ecart_valeur), 0)
  )
  INTO v_totaux
  FROM sessions_shift s
  LEFT JOIN LATERAL (
    SELECT SUM(ecart_valeur) AS ecart_valeur FROM comptages_shift WHERE session_id = s.id
  ) st ON TRUE
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
    SELECT SUM(e.montant) AS total FROM encaissements e WHERE e.session_id = s.id
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
  'Sessions de shift de l''établissement de l''appelant : métriques de passation et état du comptage physique.';

-- ============================================================================
-- 7. EXPORTS — colonnes de comptage
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
          'qte_ajustements', d.qte_ajustements,
          'valeur_ajustements', d.valeur_ajustements,
          'qte_cloture', d.qte_cloture,
          'valeur_cloture', d.valeur_cloture,
          'qte_comptee', d.qte_comptee,
          'ecart_qte_comptage', d.ecart_qte_comptage,
          'ecart_valeur_comptage', d.ecart_valeur_comptage,
          'compte',
            CASE WHEN d.compte_le IS NOT NULL THEN 'Oui' ELSE 'Non' END,
          'ecart_qte_jour', d.ecart_qte_jour,
          'ecart_valeur_jour', d.ecart_valeur_jour
        ) AS r,
        s.business_date AS sort_date,
        sh.ordre AS sort_shift,
        d.produit_nom AS produit
      FROM sessions_shift s
      JOIN shifts sh ON sh.id = s.shift_id
      CROSS JOIN LATERAL public.stock_session_detail(
        s.etablissement_id, s.ouverte_le, COALESCE(s.fermee_le, NOW()), s.business_date, s.id
      ) d
      WHERE s.etablissement_id = v_profile.etablissement_id
        AND s.business_date BETWEEN v_debut AND v_fin
        AND (v_session_id IS NULL OR s.id = v_session_id)
        AND (v_shift_nom IS NULL OR sh.nom = v_shift_nom)
        AND (d.qte_entrees <> 0 OR d.qte_vendues <> 0 OR d.qte_sorties_autres <> 0
             OR d.qte_ouverture <> 0 OR d.qte_cloture <> 0 OR d.compte_le IS NOT NULL)
    ) x;
  ELSE
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
          'qte_ajustements', COALESCE(SUM(d.qte_ajustements), 0),
          'valeur_ajustements', COALESCE(SUM(d.valeur_ajustements), 0),
          'qte_cloture', COALESCE(SUM(d.qte_cloture), 0),
          'valeur_cloture', COALESCE(SUM(d.valeur_cloture), 0),
          'qte_cloture_avant_comptage', COALESCE(SUM(d.qte_cloture - d.qte_ajustements), 0),
          'valeur_cloture_avant_comptage', COALESCE(SUM(d.valeur_cloture - d.valeur_ajustements), 0),
          'qte_comptee', COALESCE(SUM(d.qte_comptee) FILTER (WHERE d.compte_le IS NOT NULL), 0),
          'ecart_qte_comptage', COALESCE(SUM(d.ecart_qte_comptage), 0),
          'ecart_valeur_comptage', COALESCE(SUM(d.ecart_valeur_comptage), 0),
          'produits_comptes', COUNT(*) FILTER (WHERE d.compte_le IS NOT NULL),
          'produits_mouvementes', COUNT(*) FILTER (
            WHERE d.qte_entrees <> 0 OR d.qte_vendues <> 0 OR d.qte_sorties_autres <> 0
          )
        ) AS r,
        s.business_date AS sort_date,
        sh.ordre AS sort_shift
      FROM sessions_shift s
      JOIN shifts sh ON sh.id = s.shift_id
      CROSS JOIN LATERAL public.stock_session_detail(
        s.etablissement_id, s.ouverte_le, COALESCE(s.fermee_le, NOW()), s.business_date, s.id
      ) d
      WHERE s.etablissement_id = v_profile.etablissement_id
        AND s.business_date BETWEEN v_debut AND v_fin
        AND (v_session_id IS NULL OR s.id = v_session_id)
        AND (v_shift_nom IS NULL OR sh.nom = v_shift_nom)
      GROUP BY s.id, s.business_date, sh.nom, sh.heure_debut, sh.heure_fin, sh.ordre, s.statut
    ) x;
  END IF;

  SELECT jsonb_build_object(
    'sessions', COUNT(DISTINCT s.id),
    'qte_entrees', COALESCE(SUM(d.qte_entrees), 0),
    'valeur_entrees', COALESCE(SUM(d.valeur_entrees), 0),
    'qte_vendues', COALESCE(SUM(d.qte_vendues), 0),
    'valeur_vendues', COALESCE(SUM(d.valeur_vendues), 0),
    'qte_sorties_autres', COALESCE(SUM(d.qte_sorties_autres), 0),
    'valeur_sorties_autres', COALESCE(SUM(d.valeur_sorties_autres), 0),
    'valeur_cloture', COALESCE(SUM(d.valeur_cloture), 0),
    'qte_ajustements', COALESCE(SUM(d.qte_ajustements), 0),
    'valeur_ajustements', COALESCE(SUM(d.valeur_ajustements), 0),
    'ecart_qte_comptage', COALESCE(SUM(d.ecart_qte_comptage), 0),
    'ecart_valeur_comptage', COALESCE(SUM(d.ecart_valeur_comptage), 0),
    'produits_comptes', COUNT(*) FILTER (WHERE d.compte_le IS NOT NULL)
  )
  INTO v_totaux
  FROM sessions_shift s
  JOIN shifts sh ON sh.id = s.shift_id
  CROSS JOIN LATERAL public.stock_session_detail(
    s.etablissement_id, s.ouverte_le, COALESCE(s.fermee_le, NOW()), s.business_date, s.id
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

-- Le journal des sessions expose désormais l'écart de comptage de stock
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
      'stock_compte', CASE WHEN COALESCE(cs.nb, 0) > 0 THEN 'Oui' ELSE 'Non' END,
      'ecart_stock_qte', COALESCE(cs.ecart_qte, 0),
      'ecart_stock_valeur', COALESCE(cs.ecart_valeur, 0),
      'commentaire', COALESCE(s.commentaire, '')
    ) AS r,
    s.business_date AS sort_date,
    sh.ordre AS sort_shift
    FROM sessions_shift s
    JOIN shifts sh ON sh.id = s.shift_id
    LEFT JOIN profiles op ON op.id = s.ouverte_par
    LEFT JOIN profiles fp ON fp.id = s.fermee_par
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS nb, SUM(ecart_qte) AS ecart_qte, SUM(ecart_valeur) AS ecart_valeur
      FROM comptages_shift WHERE session_id = s.id
    ) cs ON TRUE
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
    'ecart_cumule', COALESCE(SUM(COALESCE(s.ecart, 0)), 0),
    'ecart_stock_valeur', COALESCE(SUM(COALESCE(cs.ecart_valeur, 0)), 0)
  )
  INTO v_totaux
  FROM sessions_shift s
  JOIN shifts sh ON sh.id = s.shift_id
  LEFT JOIN LATERAL (
    SELECT SUM(ecart_valeur) AS ecart_valeur FROM comptages_shift WHERE session_id = s.id
  ) cs ON TRUE
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

NOTIFY pgrst, 'reload schema';
