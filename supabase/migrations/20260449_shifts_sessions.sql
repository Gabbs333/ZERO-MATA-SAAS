-- Migration: Shifts — fondations (journée d'exploitation, shifts, sessions, passation)
-- Description:
--   Phase 0 + 1 + 2 du plan « shifts ».
--
--   1. `etablissements.heure_debut_journee` : début de la journée d'exploitation
--      (défaut 00:00 = comportement actuel inchangé). `business_date()` en dérive
--      la date métier d'un horodatage : un shift 18h→06h reste rattaché à la
--      journée où il a commencé.
--   2. `shifts` : définitions (Matin / Soir / Nuit, personnalisables).
--   3. `sessions_shift` : instances ouvertes/fermées par le comptoir, avec fond
--      de caisse, montant compté et écart (rapport de passation).
--   4. `session_id` (nullable) sur commandes, encaissements, mouvements_caisse
--      et mouvements_stock, renseigné automatiquement par trigger depuis la
--      session ouverte. Aucune saisie supplémentaire pour l'agent.
--   5. RPC : ouverture / fermeture de session, session active, solde de session.
--
--   Non destructif : aucune donnée historique n'est réécrite (session_id NULL).
--   Le `clotures_caisse` journalier reste inchangé.
--
--   Idempotente.
-- Created: 2026-04-49

-- ============================================================================
-- 1. JOURNÉE D'EXPLOITATION
-- ============================================================================

ALTER TABLE public.etablissements
  ADD COLUMN IF NOT EXISTS heure_debut_journee TIME NOT NULL DEFAULT '00:00';

COMMENT ON COLUMN public.etablissements.heure_debut_journee IS
  'Heure de début de la journée d''exploitation (ex. 06:00 pour un 24/24). 00:00 = journée calendaire.';

CREATE OR REPLACE FUNCTION public.business_date(
  p_at TIMESTAMPTZ,
  p_etablissement_id UUID
)
RETURNS DATE
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_at IS NULL OR p_etablissement_id IS NULL THEN NULL
    WHEN (p_at AT TIME ZONE COALESCE(e.fuseau_horaire, 'Africa/Douala'))::time
         >= COALESCE(e.heure_debut_journee, '00:00'::time)
      THEN (p_at AT TIME ZONE COALESCE(e.fuseau_horaire, 'Africa/Douala'))::date
    ELSE (p_at AT TIME ZONE COALESCE(e.fuseau_horaire, 'Africa/Douala'))::date - 1
  END
  FROM etablissements e
  WHERE e.id = p_etablissement_id;
$$;

GRANT EXECUTE ON FUNCTION public.business_date(TIMESTAMPTZ, UUID) TO authenticated;

-- ============================================================================
-- 2. DÉFINITIONS DES SHIFTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id UUID NOT NULL REFERENCES public.etablissements(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  heure_debut TIME NOT NULL,
  heure_fin TIME NOT NULL,
  traverse_minuit BOOLEAN NOT NULL DEFAULT FALSE,
  ordre INTEGER NOT NULL DEFAULT 0,
  actif BOOLEAN NOT NULL DEFAULT TRUE,
  date_creation TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (etablissement_id, nom)
);

CREATE INDEX IF NOT EXISTS idx_shifts_etablissement
  ON public.shifts (etablissement_id, ordre);

CREATE OR REPLACE FUNCTION public.set_shift_traverse_minuit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.traverse_minuit := (NEW.heure_fin <= NEW.heure_debut);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shift_traverse_minuit ON public.shifts;
CREATE TRIGGER trg_shift_traverse_minuit
  BEFORE INSERT OR UPDATE ON public.shifts
  FOR EACH ROW EXECUTE FUNCTION public.set_shift_traverse_minuit();

ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shifts_read ON public.shifts;
CREATE POLICY shifts_read ON public.shifts
  FOR SELECT
  USING (
    etablissement_id IN (SELECT p.etablissement_id FROM public.profiles p WHERE p.id = auth.uid())
    OR public.is_admin()
  );

DROP POLICY IF EXISTS shifts_write ON public.shifts;
CREATE POLICY shifts_write ON public.shifts
  FOR ALL
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.actif = TRUE
        AND p.role IN ('patron', 'gerant')
        AND p.etablissement_id = shifts.etablissement_id
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.actif = TRUE
        AND p.role IN ('patron', 'gerant')
        AND p.etablissement_id = shifts.etablissement_id
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shifts TO authenticated;

-- Amorçage : Matin / Soir / Nuit pour chaque établissement qui n'en a aucun
CREATE OR REPLACE FUNCTION public.seed_shifts_for_etablissement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM shifts s WHERE s.etablissement_id = NEW.id) THEN
    INSERT INTO shifts (etablissement_id, nom, heure_debut, heure_fin, ordre) VALUES
      (NEW.id, 'Matin', '06:00', '14:00', 1),
      (NEW.id, 'Soir',  '14:00', '22:00', 2),
      (NEW.id, 'Nuit',  '22:00', '06:00', 3);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_shifts ON public.etablissements;
CREATE TRIGGER trg_seed_shifts
  AFTER INSERT ON public.etablissements
  FOR EACH ROW EXECUTE FUNCTION public.seed_shifts_for_etablissement();

DO $seed_shifts$
DECLARE
  e RECORD;
BEGIN
  FOR e IN SELECT id FROM public.etablissements LOOP
    IF NOT EXISTS (SELECT 1 FROM public.shifts s WHERE s.etablissement_id = e.id) THEN
      INSERT INTO public.shifts (etablissement_id, nom, heure_debut, heure_fin, ordre)
      VALUES
        (e.id, 'Matin', '06:00', '14:00', 1),
        (e.id, 'Soir',  '14:00', '22:00', 2),
        (e.id, 'Nuit',  '22:00', '06:00', 3);
    END IF;
  END LOOP;
END
$seed_shifts$;

-- ============================================================================
-- 3. SESSIONS DE SHIFT
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sessions_shift (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id UUID NOT NULL REFERENCES public.etablissements(id) ON DELETE CASCADE,
  shift_id UUID NOT NULL REFERENCES public.shifts(id) ON DELETE RESTRICT,
  business_date DATE NOT NULL,
  ouverte_le TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fermee_le TIMESTAMPTZ,
  ouverte_par UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  fermee_par UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  fond_initial INTEGER NOT NULL DEFAULT 0 CHECK (fond_initial >= 0),
  montant_compte INTEGER CHECK (montant_compte IS NULL OR montant_compte >= 0),
  ecart INTEGER,
  statut TEXT NOT NULL DEFAULT 'ouverte' CHECK (statut IN ('ouverte', 'fermee')),
  commentaire TEXT,
  date_creation TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Une seule session ouverte par établissement
CREATE UNIQUE INDEX IF NOT EXISTS uq_sessions_shift_ouverte
  ON public.sessions_shift (etablissement_id)
  WHERE statut = 'ouverte';

CREATE INDEX IF NOT EXISTS idx_sessions_shift_etab_date
  ON public.sessions_shift (etablissement_id, business_date DESC);

ALTER TABLE public.sessions_shift ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sessions_shift_read ON public.sessions_shift;
CREATE POLICY sessions_shift_read ON public.sessions_shift
  FOR SELECT
  USING (
    etablissement_id IN (SELECT p.etablissement_id FROM public.profiles p WHERE p.id = auth.uid())
    OR public.is_admin()
  );

DROP POLICY IF EXISTS sessions_shift_write ON public.sessions_shift;
CREATE POLICY sessions_shift_write ON public.sessions_shift
  FOR ALL
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.actif = TRUE
        AND p.role IN ('comptoir', 'patron', 'gerant')
        AND p.etablissement_id = sessions_shift.etablissement_id
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.actif = TRUE
        AND p.role IN ('comptoir', 'patron', 'gerant')
        AND p.etablissement_id = sessions_shift.etablissement_id
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions_shift TO authenticated;

-- ============================================================================
-- 4. ESTAMPILLAGE AUTOMATIQUE DES TRANSACTIONS
-- ============================================================================

ALTER TABLE public.commandes        ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES public.sessions_shift(id) ON DELETE SET NULL;
ALTER TABLE public.encaissements    ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES public.sessions_shift(id) ON DELETE SET NULL;
ALTER TABLE public.mouvements_caisse ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES public.sessions_shift(id) ON DELETE SET NULL;
ALTER TABLE public.mouvements_stock ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES public.sessions_shift(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_commandes_session        ON public.commandes (session_id);
CREATE INDEX IF NOT EXISTS idx_encaissements_session    ON public.encaissements (session_id);
CREATE INDEX IF NOT EXISTS idx_mouvements_caisse_session ON public.mouvements_caisse (session_id);
CREATE INDEX IF NOT EXISTS idx_mouvements_stock_session ON public.mouvements_stock (session_id);

CREATE OR REPLACE FUNCTION public.stamp_session_shift()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.session_id IS NULL AND NEW.etablissement_id IS NOT NULL THEN
    SELECT s.id INTO NEW.session_id
    FROM sessions_shift s
    WHERE s.etablissement_id = NEW.etablissement_id
      AND s.statut = 'ouverte'
    ORDER BY s.ouverte_le DESC
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_session_commandes ON public.commandes;
CREATE TRIGGER trg_stamp_session_commandes
  BEFORE INSERT ON public.commandes
  FOR EACH ROW EXECUTE FUNCTION public.stamp_session_shift();

DROP TRIGGER IF EXISTS trg_stamp_session_encaissements ON public.encaissements;
CREATE TRIGGER trg_stamp_session_encaissements
  BEFORE INSERT ON public.encaissements
  FOR EACH ROW EXECUTE FUNCTION public.stamp_session_shift();

DROP TRIGGER IF EXISTS trg_stamp_session_mouvements_caisse ON public.mouvements_caisse;
CREATE TRIGGER trg_stamp_session_mouvements_caisse
  BEFORE INSERT ON public.mouvements_caisse
  FOR EACH ROW EXECUTE FUNCTION public.stamp_session_shift();

DROP TRIGGER IF EXISTS trg_stamp_session_mouvements_stock ON public.mouvements_stock;
CREATE TRIGGER trg_stamp_session_mouvements_stock
  BEFORE INSERT ON public.mouvements_stock
  FOR EACH ROW EXECUTE FUNCTION public.stamp_session_shift();

-- ============================================================================
-- 5. RPC : SESSION ACTIVE
-- ============================================================================

CREATE OR REPLACE FUNCTION public.session_shift_active()
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_etab UUID;
  v_session RECORD;
  v_shift RECORD;
  v_ventes BIGINT := 0;
  v_encaissements BIGINT := 0;
BEGIN
  SELECT etablissement_id INTO v_etab FROM profiles WHERE id = auth.uid();
  IF v_etab IS NULL THEN
    RETURN json_build_object('session', NULL);
  END IF;

  SELECT * INTO v_session
  FROM sessions_shift
  WHERE etablissement_id = v_etab AND statut = 'ouverte'
  ORDER BY ouverte_le DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('session', NULL);
  END IF;

  SELECT * INTO v_shift FROM shifts WHERE id = v_session.shift_id;

  SELECT COALESCE(SUM(montant), 0) INTO v_encaissements
  FROM encaissements WHERE session_id = v_session.id;

  SELECT COALESCE(SUM(f.montant_total), 0) INTO v_ventes
  FROM factures f
  JOIN commandes c ON c.id = f.commande_id
  WHERE c.session_id = v_session.id;

  RETURN json_build_object(
    'session', json_build_object(
      'id', v_session.id,
      'business_date', v_session.business_date,
      'ouverte_le', v_session.ouverte_le,
      'fond_initial', v_session.fond_initial,
      'ouverte_par', v_session.ouverte_par
    ),
    'shift', json_build_object(
      'id', v_shift.id,
      'nom', v_shift.nom,
      'heure_debut', v_shift.heure_debut,
      'heure_fin', v_shift.heure_fin,
      'traverse_minuit', v_shift.traverse_minuit
    ),
    'ventes', v_ventes,
    'encaissements', v_encaissements
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.session_shift_active() TO authenticated;

-- ============================================================================
-- 6. RPC : OUVRIR / FERMER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.ouvrir_session_shift(
  p_shift_id UUID,
  p_fond_initial INTEGER DEFAULT 0
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_profile RECORD;
  v_shift RECORD;
  v_session RECORD;
  v_open UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Non authentifié.';
  END IF;

  SELECT role, etablissement_id, actif INTO v_profile FROM profiles WHERE id = v_uid;
  IF NOT FOUND
     OR v_profile.role NOT IN ('comptoir', 'gerant', 'patron')
     OR COALESCE(v_profile.actif, true) <> true THEN
    RAISE EXCEPTION 'Accès refusé.';
  END IF;

  IF COALESCE(p_fond_initial, 0) < 0 THEN
    RAISE EXCEPTION 'Le fond de caisse ne peut pas être négatif.';
  END IF;

  SELECT * INTO v_shift FROM shifts WHERE id = p_shift_id;
  IF NOT FOUND OR v_shift.etablissement_id <> v_profile.etablissement_id THEN
    RAISE EXCEPTION 'Shift introuvable pour cet établissement.';
  END IF;
  IF NOT v_shift.actif THEN
    RAISE EXCEPTION 'Ce shift est désactivé.';
  END IF;

  SELECT id INTO v_open
  FROM sessions_shift
  WHERE etablissement_id = v_profile.etablissement_id AND statut = 'ouverte'
  LIMIT 1;

  IF v_open IS NOT NULL THEN
    RAISE EXCEPTION 'Une session est déjà ouverte. Clôturez-la avant d''en ouvrir une nouvelle.';
  END IF;

  INSERT INTO sessions_shift (
    etablissement_id, shift_id, business_date, ouverte_par, fond_initial
  ) VALUES (
    v_profile.etablissement_id,
    v_shift.id,
    public.business_date(NOW(), v_profile.etablissement_id),
    v_uid,
    COALESCE(p_fond_initial, 0)
  )
  RETURNING * INTO v_session;

  RETURN json_build_object(
    'success', true,
    'session', row_to_json(v_session),
    'shift_nom', v_shift.nom
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ouvrir_session_shift(UUID, INTEGER) TO authenticated;

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
    COALESCE(SUM(f.montant_total), 0),
    COALESCE(SUM(CASE WHEN f.numero_facture LIKE '%-BAR' THEN f.montant_total ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN f.numero_facture LIKE '%-CUI' THEN f.montant_total ELSE 0 END), 0),
    COUNT(DISTINCT c.id)
  INTO v_ca, v_ca_bar, v_ca_cuisine, v_nb_commandes
  FROM factures f
  JOIN commandes c ON c.id = f.commande_id
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

CREATE OR REPLACE FUNCTION public.fermer_session_shift(
  p_session_id UUID,
  p_montant_compte INTEGER,
  p_commentaire TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_profile RECORD;
  v_session RECORD;
  v_enc BIGINT := 0;
  v_entrees BIGINT := 0;
  v_sorties BIGINT := 0;
  v_theorique BIGINT := 0;
  v_ecart INTEGER := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Non authentifié.';
  END IF;

  SELECT role, etablissement_id, actif INTO v_profile FROM profiles WHERE id = v_uid;
  IF NOT FOUND
     OR v_profile.role NOT IN ('comptoir', 'gerant', 'patron')
     OR COALESCE(v_profile.actif, true) <> true THEN
    RAISE EXCEPTION 'Accès refusé.';
  END IF;

  IF p_montant_compte IS NULL OR p_montant_compte < 0 THEN
    RAISE EXCEPTION 'Montant compté invalide.';
  END IF;

  SELECT * INTO v_session FROM sessions_shift WHERE id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session introuvable.';
  END IF;
  IF v_session.etablissement_id <> v_profile.etablissement_id THEN
    RAISE EXCEPTION 'Session d''un autre établissement.';
  END IF;
  IF v_session.statut <> 'ouverte' THEN
    RAISE EXCEPTION 'Cette session est déjà fermée.';
  END IF;

  SELECT COALESCE(SUM(montant), 0) INTO v_enc
  FROM encaissements WHERE session_id = p_session_id;

  SELECT
    COALESCE(SUM(CASE WHEN type = 'entree' AND encaissement_id IS NULL THEN montant END), 0),
    COALESCE(SUM(CASE WHEN type = 'sortie' AND encaissement_id IS NULL THEN montant END), 0)
  INTO v_entrees, v_sorties
  FROM mouvements_caisse WHERE session_id = p_session_id;

  v_theorique := v_session.fond_initial + v_enc + v_entrees - v_sorties;
  v_ecart := p_montant_compte - v_theorique;

  UPDATE sessions_shift
  SET statut = 'fermee',
      fermee_le = NOW(),
      fermee_par = v_uid,
      montant_compte = p_montant_compte,
      ecart = v_ecart,
      commentaire = NULLIF(BTRIM(COALESCE(p_commentaire, '')), '')
  WHERE id = p_session_id;

  RETURN json_build_object(
    'success', true,
    'session_id', p_session_id,
    'solde_theorique', v_theorique,
    'montant_compte', p_montant_compte,
    'ecart', v_ecart
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fermer_session_shift(UUID, INTEGER, TEXT) TO authenticated;

COMMENT ON FUNCTION public.fermer_session_shift(UUID, INTEGER, TEXT) IS
  'Clôture une session de shift : calcule le théorique, l''écart de caisse et fige la session (rapport de passation).';

NOTIFY pgrst, 'reload schema';
