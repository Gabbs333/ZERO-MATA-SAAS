-- Migration: Exports P0 — socle comptable et dataset d'export
-- Description:
--   1. Paramétrage fiscal/devise/fuseau par établissement (TVA Cameroun 19,25 %)
--   2. Traçabilité des montants initiaux (factures / commande_items)
--   3. Valorisation des mouvements de stock (coût unitaire au moment du mouvement)
--   4. Clôtures de caisse (montant compté + écart)
--   5. Journalisation des exports + rétention 24 mois
--   6. Schéma des clôtures de stock journalières (rapport détaillé en P2)
--   7. Index de performance
--   8. RPC get_export_dataset(type, période, filtres)
-- Created: 2026-04-34

-- ============================================================================
-- 1. PARAMÉTRAGE ÉTABLISSEMENT
-- ============================================================================

ALTER TABLE public.etablissements
  ADD COLUMN IF NOT EXISTS taux_tva NUMERIC(5,2) NOT NULL DEFAULT 19.25;
ALTER TABLE public.etablissements
  ADD COLUMN IF NOT EXISTS prix_ttc BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.etablissements
  ADD COLUMN IF NOT EXISTS devise TEXT NOT NULL DEFAULT 'XAF';
ALTER TABLE public.etablissements
  ADD COLUMN IF NOT EXISTS fuseau_horaire TEXT NOT NULL DEFAULT 'Africa/Douala';

COMMENT ON COLUMN public.etablissements.taux_tva IS 'Taux de TVA appliqué (Cameroun : 19,25 %). 0 = franchise.';
COMMENT ON COLUMN public.etablissements.prix_ttc IS 'true si les prix saisis sont TTC (TVA incluse).';
COMMENT ON COLUMN public.etablissements.devise IS 'Devise ISO des montants (XAF pour la zone CEMAC).';
COMMENT ON COLUMN public.etablissements.fuseau_horaire IS 'Fuseau utilisé pour délimiter les journées comptables.';

-- ============================================================================
-- 2. MONTANTS INITIAUX (traçabilité en cas de retour / échange)
-- ============================================================================

ALTER TABLE public.factures ADD COLUMN IF NOT EXISTS montant_initial INTEGER;
ALTER TABLE public.commande_items ADD COLUMN IF NOT EXISTS quantite_initiale INTEGER;
ALTER TABLE public.commande_items ADD COLUMN IF NOT EXISTS montant_initial INTEGER;

UPDATE public.factures
SET montant_initial = montant_total
WHERE montant_initial IS NULL;

UPDATE public.commande_items
SET quantite_initiale = quantite,
    montant_initial = montant_ligne
WHERE quantite_initiale IS NULL OR montant_initial IS NULL;

CREATE OR REPLACE FUNCTION public.set_facture_montant_initial()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.montant_initial IS NULL THEN
    NEW.montant_initial := NEW.montant_total;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_facture_montant_initial ON public.factures;
CREATE TRIGGER trg_facture_montant_initial
  BEFORE INSERT ON public.factures
  FOR EACH ROW EXECUTE FUNCTION public.set_facture_montant_initial();

CREATE OR REPLACE FUNCTION public.set_commande_item_initial()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.quantite_initiale IS NULL THEN
    NEW.quantite_initiale := NEW.quantite;
  END IF;
  IF NEW.montant_initial IS NULL THEN
    NEW.montant_initial := NEW.montant_ligne;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_commande_item_initial ON public.commande_items;
CREATE TRIGGER trg_commande_item_initial
  BEFORE INSERT ON public.commande_items
  FOR EACH ROW EXECUTE FUNCTION public.set_commande_item_initial();

-- ============================================================================
-- 3. COÛT DES MOUVEMENTS DE STOCK
-- ============================================================================
-- Renseigne cout_unitaire avec le coût moyen courant du produit quand il est
-- absent (ventes, retours, échanges) afin de pouvoir valoriser le stock vendu.

CREATE OR REPLACE FUNCTION public.set_mouvement_stock_cout()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.cout_unitaire IS NULL THEN
    SELECT p.prix_achat INTO NEW.cout_unitaire
    FROM public.produits p
    WHERE p.id = NEW.produit_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mouvement_stock_cout ON public.mouvements_stock;
CREATE TRIGGER trg_mouvement_stock_cout
  BEFORE INSERT ON public.mouvements_stock
  FOR EACH ROW EXECUTE FUNCTION public.set_mouvement_stock_cout();

-- ============================================================================
-- 4. CLÔTURES DE CAISSE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.clotures_caisse (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  etablissement_id UUID NOT NULL REFERENCES public.etablissements(id) ON DELETE RESTRICT,
  date_cloture DATE NOT NULL,
  montant_theorique INTEGER NOT NULL DEFAULT 0,
  montant_compte INTEGER NOT NULL DEFAULT 0 CHECK (montant_compte >= 0),
  ecart INTEGER NOT NULL DEFAULT 0,
  commentaire TEXT,
  utilisateur_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  date_creation TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (etablissement_id, date_cloture)
);

CREATE INDEX IF NOT EXISTS idx_clotures_caisse_etab_date
  ON public.clotures_caisse(etablissement_id, date_cloture DESC);

ALTER TABLE public.clotures_caisse ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "patron_gerant_read_clotures_caisse" ON public.clotures_caisse;
CREATE POLICY "patron_gerant_read_clotures_caisse"
  ON public.clotures_caisse FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('patron', 'gerant')
        AND p.actif = true
        AND p.etablissement_id = clotures_caisse.etablissement_id
    )
  );

DROP POLICY IF EXISTS "patron_gerant_write_clotures_caisse" ON public.clotures_caisse;
CREATE POLICY "patron_gerant_write_clotures_caisse"
  ON public.clotures_caisse FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('patron', 'gerant')
        AND p.actif = true
        AND p.etablissement_id = clotures_caisse.etablissement_id
    )
  );

DROP POLICY IF EXISTS "patron_gerant_update_clotures_caisse" ON public.clotures_caisse;
CREATE POLICY "patron_gerant_update_clotures_caisse"
  ON public.clotures_caisse FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('patron', 'gerant')
        AND p.actif = true
        AND p.etablissement_id = clotures_caisse.etablissement_id
    )
  );

CREATE OR REPLACE FUNCTION public.enregistrer_cloture_caisse(
  p_date DATE,
  p_montant_compte INTEGER,
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
  v_tz TEXT;
  v_entrees_ventes BIGINT := 0;
  v_entrees_hors_ventes BIGINT := 0;
  v_sorties BIGINT := 0;
  v_encaissements BIGINT := 0;
  v_theorique BIGINT := 0;
  v_ecart INTEGER := 0;
  v_id UUID;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE id = v_uid;
  IF NOT FOUND OR v_profile.role NOT IN ('patron', 'gerant') OR v_profile.actif <> true THEN
    RAISE EXCEPTION 'Accès refusé.';
  END IF;
  IF v_profile.etablissement_id IS NULL THEN
    RAISE EXCEPTION 'Aucun établissement associé.';
  END IF;
  IF p_montant_compte IS NULL OR p_montant_compte < 0 THEN
    RAISE EXCEPTION 'Montant compté invalide.';
  END IF;

  IF p_date IS NULL THEN
    p_date := CURRENT_DATE;
  END IF;
  IF p_date > CURRENT_DATE THEN
    RAISE EXCEPTION 'La date de clôture ne peut pas être dans le futur.';
  END IF;

  SELECT COALESCE(fuseau_horaire, 'Africa/Douala') INTO v_tz
  FROM etablissements WHERE id = v_profile.etablissement_id;

  -- Les encaissements de vente sont déjà répercutés dans mouvements_caisse par
  -- le trigger record_encaissement_mouvement_caisse (encaissement_id non NULL).
  -- On les isole pour ne pas les compter deux fois.
  SELECT
    COALESCE(SUM(CASE WHEN type = 'entree' AND encaissement_id IS NOT NULL THEN montant END), 0),
    COALESCE(SUM(CASE WHEN type = 'entree' AND encaissement_id IS NULL THEN montant END), 0),
    COALESCE(SUM(CASE WHEN type = 'sortie' THEN montant END), 0)
  INTO v_entrees_ventes, v_entrees_hors_ventes, v_sorties
  FROM mouvements_caisse
  WHERE etablissement_id = v_profile.etablissement_id
    AND (date_creation AT TIME ZONE v_tz)::date = p_date;

  SELECT COALESCE(SUM(e.montant), 0)
  INTO v_encaissements
  FROM encaissements e
  WHERE e.etablissement_id = v_profile.etablissement_id
    AND (e.date_encaissement AT TIME ZONE v_tz)::date = p_date;

  -- Source de vérité des ventes : la table encaissements. On ne reprend que
  -- les entrées de caisse qui ne sont pas des ventes.
  v_theorique := v_entrees_hors_ventes + v_encaissements - v_sorties;
  v_ecart := p_montant_compte - v_theorique;

  INSERT INTO clotures_caisse (
    etablissement_id, date_cloture, montant_theorique, montant_compte,
    ecart, commentaire, utilisateur_id
  ) VALUES (
    v_profile.etablissement_id, p_date, v_theorique, p_montant_compte,
    v_ecart, p_commentaire, v_uid
  )
  ON CONFLICT (etablissement_id, date_cloture) DO UPDATE
  SET montant_theorique = EXCLUDED.montant_theorique,
      montant_compte = EXCLUDED.montant_compte,
      ecart = EXCLUDED.ecart,
      commentaire = EXCLUDED.commentaire,
      utilisateur_id = EXCLUDED.utilisateur_id,
      date_creation = NOW()
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_id,
    'date_cloture', p_date,
    'entrees', v_entrees_hors_ventes + v_encaissements,
    'entrees_hors_ventes', v_entrees_hors_ventes,
    'sorties', v_sorties,
    'encaissements', v_encaissements,
    'montant_theorique', v_theorique,
    'montant_compte', p_montant_compte,
    'ecart', v_ecart
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.enregistrer_cloture_caisse(DATE, INTEGER, TEXT) TO authenticated;

-- ============================================================================
-- 5. JOURNALISATION DES EXPORTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.exports_journalises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  etablissement_id UUID NOT NULL REFERENCES public.etablissements(id) ON DELETE RESTRICT,
  type_export TEXT NOT NULL,
  periode_debut TIMESTAMPTZ NOT NULL,
  periode_fin TIMESTAMPTZ NOT NULL,
  filtres JSONB NOT NULL DEFAULT '{}'::jsonb,
  format TEXT NOT NULL CHECK (format IN ('csv', 'xlsx', 'pdf', 'zip')),
  storage_path TEXT,
  sha256 TEXT,
  taille_octets BIGINT,
  nb_lignes INTEGER,
  statut TEXT NOT NULL DEFAULT 'genere' CHECK (statut IN ('genere', 'archive', 'echec')),
  message_erreur TEXT,
  utilisateur_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  date_creation TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  date_purge_prevue TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 months')
);

CREATE INDEX IF NOT EXISTS idx_exports_journalises_etab_date
  ON public.exports_journalises(etablissement_id, date_creation DESC);
CREATE INDEX IF NOT EXISTS idx_exports_journalises_purge
  ON public.exports_journalises(date_purge_prevue);

ALTER TABLE public.exports_journalises ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "patron_gerant_read_exports" ON public.exports_journalises;
CREATE POLICY "patron_gerant_read_exports"
  ON public.exports_journalises FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('patron', 'gerant')
        AND p.actif = true
        AND p.etablissement_id = exports_journalises.etablissement_id
    )
  );

DROP POLICY IF EXISTS "patron_gerant_insert_exports" ON public.exports_journalises;
CREATE POLICY "patron_gerant_insert_exports"
  ON public.exports_journalises FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('patron', 'gerant')
        AND p.actif = true
        AND p.etablissement_id = exports_journalises.etablissement_id
    )
  );

-- ============================================================================
-- 6. CLÔTURES DE STOCK JOURNALIÈRES (schéma — rapport détaillé en P2)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.clotures_stock_journalieres (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  etablissement_id UUID NOT NULL REFERENCES public.etablissements(id) ON DELETE RESTRICT,
  date_cloture DATE NOT NULL,
  produit_id UUID NOT NULL REFERENCES public.produits(id) ON DELETE RESTRICT,
  quantite_ouverture INTEGER NOT NULL DEFAULT 0,
  cout_ouverture INTEGER NOT NULL DEFAULT 0,
  qte_entrees INTEGER NOT NULL DEFAULT 0,
  valeur_entrees INTEGER NOT NULL DEFAULT 0,
  qte_sorties_ventes INTEGER NOT NULL DEFAULT 0,
  valeur_sorties_ventes INTEGER NOT NULL DEFAULT 0,
  qte_sorties_autres INTEGER NOT NULL DEFAULT 0,
  valeur_sorties_autres INTEGER NOT NULL DEFAULT 0,
  quantite_theorique INTEGER NOT NULL DEFAULT 0,
  quantite_reelle INTEGER NOT NULL DEFAULT 0,
  cout_fin INTEGER NOT NULL DEFAULT 0,
  valeur_theorique INTEGER NOT NULL DEFAULT 0,
  valeur_reelle INTEGER NOT NULL DEFAULT 0,
  ecart_qte INTEGER NOT NULL DEFAULT 0,
  ecart_valeur INTEGER NOT NULL DEFAULT 0,
  utilisateur_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  date_creation TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (etablissement_id, date_cloture, produit_id)
);

CREATE INDEX IF NOT EXISTS idx_clotures_stock_etab_date
  ON public.clotures_stock_journalieres(etablissement_id, date_cloture DESC);

ALTER TABLE public.clotures_stock_journalieres ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "patron_gerant_read_clotures_stock" ON public.clotures_stock_journalieres;
CREATE POLICY "patron_gerant_read_clotures_stock"
  ON public.clotures_stock_journalieres FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('patron', 'gerant')
        AND p.actif = true
        AND p.etablissement_id = clotures_stock_journalieres.etablissement_id
    )
  );

-- ============================================================================
-- 7. INDEX DE PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_factures_etab_date_generation
  ON public.factures(etablissement_id, date_generation DESC);
CREATE INDEX IF NOT EXISTS idx_encaissements_etab_date_mode
  ON public.encaissements(etablissement_id, date_encaissement DESC, mode_paiement);
CREATE INDEX IF NOT EXISTS idx_mouvements_stock_etab_date_produit
  ON public.mouvements_stock(etablissement_id, date_creation DESC, produit_id);
CREATE INDEX IF NOT EXISTS idx_retours_etab_date
  ON public.retours(etablissement_id, date_retour DESC);
CREATE INDEX IF NOT EXISTS idx_echanges_etab_date
  ON public.echanges(etablissement_id, date_echange DESC);

-- ============================================================================
-- 8. VENTILATION TVA (helpers)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.calc_base_ht(
  p_montant INTEGER,
  p_taux NUMERIC,
  p_prix_ttc BOOLEAN
)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN COALESCE(p_prix_ttc, true) AND COALESCE(p_taux, 0) > 0
      THEN ROUND(p_montant * 100.0 / (100.0 + p_taux))::INTEGER
    ELSE p_montant
  END;
$$;

CREATE OR REPLACE FUNCTION public.calc_tva(
  p_montant INTEGER,
  p_taux NUMERIC,
  p_prix_ttc BOOLEAN
)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_montant - public.calc_base_ht(p_montant, p_taux, p_prix_ttc);
$$;

GRANT EXECUTE ON FUNCTION public.calc_base_ht(INTEGER, NUMERIC, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calc_tva(INTEGER, NUMERIC, BOOLEAN) TO authenticated;

-- ============================================================================
-- 9. RPC : DATASET D'EXPORT
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
DECLARE
  v_uid UUID := auth.uid();
  v_profile RECORD;
  v_etab RECORD;
  v_taux NUMERIC(5,2);
  v_prix_ttc BOOLEAN;
  v_tz TEXT;
  v_dept TEXT := NULLIF(LOWER(p_filtres->>'departement'), '');
  v_canal TEXT := NULLIF(LOWER(p_filtres->>'canal'), '');
  v_agent UUID := NULLIF(p_filtres->>'agent_id', '')::UUID;
  v_debut_date DATE;
  v_fin_date DATE;
  v_rows JSONB := '[]'::jsonb;
  v_totaux JSONB := '{}'::jsonb;
  v_meta JSONB;
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
    RAISE EXCEPTION 'Période obligatoire (date de début et de fin).';
  END IF;
  IF p_date_debut > p_date_fin THEN
    RAISE EXCEPTION 'Période invalide.';
  END IF;

  SELECT * INTO v_etab FROM etablissements WHERE id = v_profile.etablissement_id;
  v_taux := COALESCE(v_etab.taux_tva, 19.25);
  v_prix_ttc := COALESCE(v_etab.prix_ttc, true);
  v_tz := COALESCE(v_etab.fuseau_horaire, 'Africa/Douala');
  v_debut_date := (p_date_debut AT TIME ZONE v_tz)::date;
  v_fin_date := (p_date_fin AT TIME ZONE v_tz)::date;

  -- ==========================================================================
  -- JOURNAL DES VENTES (1 ligne / article facturé)
  -- ==========================================================================
  IF p_type = 'journal_ventes' THEN
    SELECT COALESCE(jsonb_agg(r ORDER BY s.sort_ts DESC, (r->>'numero_facture'), (r->>'produit')), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT jsonb_build_object(
        'date', to_char(f.date_generation AT TIME ZONE v_tz, 'DD/MM/YYYY HH24:MI'),
        'numero_commande', c.numero_commande,
        'numero_facture', f.numero_facture,
        'departement', CASE WHEN p.categorie = 'nourriture' THEN 'Cuisine' ELSE 'Bar' END,
        'canal', CASE WHEN c.canal = 'comptoir' THEN 'Comptoir' ELSE 'Salle' END,
        'type_service', CASE WHEN c.type_service = 'emporter' THEN 'À emporter' ELSE 'Sur place' END,
        'table', COALESCE(t.numero::text, '—'),
        'produit', ci.nom_produit,
        'categorie', p.categorie,
        'quantite_facturee', COALESCE(ci.quantite_initiale, ci.quantite),
        'quantite_retournee', GREATEST(COALESCE(ci.quantite_initiale, ci.quantite) - ci.quantite, 0),
        'prix_unitaire', ci.prix_unitaire,
        'montant_initial', COALESCE(ci.montant_initial, ci.montant_ligne),
        'montant_net', ci.montant_ligne,
        'statut_reglement',
          CASE f.statut
            WHEN 'payee' THEN 'Payée'
            WHEN 'partiellement_payee' THEN 'Partiellement payée'
            WHEN 'en_attente_paiement' THEN 'Impayée'
            ELSE COALESCE(f.statut, '—')
          END,
        'vente_a_credit', CASE WHEN f.credit_sur THEN 'Oui' ELSE 'Non' END,
        'agent', COALESCE(NULLIF(TRIM(CONCAT_WS(' ', sp.prenom, sp.nom)), ''), '—'),
        'valideur', COALESCE(NULLIF(TRIM(CONCAT_WS(' ', vp.prenom, vp.nom)), ''), '—'),
        'montant_ttc', ci.montant_ligne,
        'base_ht', public.calc_base_ht(ci.montant_ligne, v_taux, v_prix_ttc),
        'tva', public.calc_tva(ci.montant_ligne, v_taux, v_prix_ttc)
      ) AS r,
      f.date_generation AS sort_ts
      FROM factures f
      JOIN commandes c ON c.id = f.commande_id
      JOIN commande_items ci ON ci.commande_id = c.id
      JOIN produits p ON p.id = ci.produit_id
      LEFT JOIN tables t ON t.id = c.table_id
      LEFT JOIN profiles sp ON sp.id = c.serveuse_id
      LEFT JOIN profiles vp ON vp.id = c.validateur_id
      WHERE f.etablissement_id = v_profile.etablissement_id
        AND f.date_generation >= p_date_debut
        AND f.date_generation <= p_date_fin
        -- Les factures sont scindées Bar / Cuisine : ne rattacher à chaque
        -- facture que les articles de son département, sinon double comptage.
        AND (
          (f.numero_facture LIKE '%-CUI' AND p.categorie = 'nourriture')
          OR (f.numero_facture LIKE '%-BAR' AND p.categorie <> 'nourriture')
          OR (
            f.numero_facture NOT LIKE '%-CUI'
            AND f.numero_facture NOT LIKE '%-BAR'
          )
        )
        AND (
          v_dept IS NULL
          OR (CASE WHEN p.categorie = 'nourriture' THEN 'cuisine' ELSE 'bar' END) = v_dept
        )
        AND (v_canal IS NULL OR c.canal = v_canal)
        AND (v_agent IS NULL OR c.serveuse_id = v_agent)
    ) s;

    SELECT jsonb_build_object(
      'montant_initial', COALESCE(SUM(COALESCE(ci.montant_initial, ci.montant_ligne)), 0),
      'montant_net', COALESCE(SUM(ci.montant_ligne), 0),
      'base_ht', COALESCE(SUM(public.calc_base_ht(ci.montant_ligne, v_taux, v_prix_ttc)), 0),
      'tva', COALESCE(SUM(public.calc_tva(ci.montant_ligne, v_taux, v_prix_ttc)), 0),
      'lignes', COUNT(*)
    )
    INTO v_totaux
    FROM factures f
    JOIN commandes c ON c.id = f.commande_id
    JOIN commande_items ci ON ci.commande_id = c.id
    JOIN produits p ON p.id = ci.produit_id
    WHERE f.etablissement_id = v_profile.etablissement_id
      AND f.date_generation >= p_date_debut
      AND f.date_generation <= p_date_fin
      AND (
        (f.numero_facture LIKE '%-CUI' AND p.categorie = 'nourriture')
        OR (f.numero_facture LIKE '%-BAR' AND p.categorie <> 'nourriture')
        OR (
          f.numero_facture NOT LIKE '%-CUI'
          AND f.numero_facture NOT LIKE '%-BAR'
        )
      )
      AND (
        v_dept IS NULL
        OR (CASE WHEN p.categorie = 'nourriture' THEN 'cuisine' ELSE 'bar' END) = v_dept
      )
      AND (v_canal IS NULL OR c.canal = v_canal)
      AND (v_agent IS NULL OR c.serveuse_id = v_agent);

  -- ==========================================================================
  -- JOURNAL DES ENCAISSEMENTS
  -- ==========================================================================
  ELSIF p_type = 'journal_encaissements' THEN
    SELECT COALESCE(jsonb_agg(r ORDER BY s.sort_ts DESC, (r->>'numero_facture')), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT jsonb_build_object(
        'date', to_char(e.date_encaissement AT TIME ZONE v_tz, 'DD/MM/YYYY HH24:MI'),
        'numero_facture', f.numero_facture,
        'numero_commande', COALESCE(c.numero_commande, '—'),
        'departement',
          CASE
            WHEN f.numero_facture LIKE '%-CUI' THEN 'Cuisine'
            WHEN f.numero_facture LIKE '%-BAR' THEN 'Bar'
            ELSE 'Global'
          END,
        'type_operation',
          CASE
            WHEN e.montant < 0 THEN 'Remboursement'
            WHEN COALESCE(e.reference, '') LIKE 'CREDIT-%' THEN 'Règlement crédit'
            ELSE 'Vente'
          END,
        'mode_paiement',
          CASE e.mode_paiement
            WHEN 'especes' THEN 'Espèces'
            WHEN 'mobile_money' THEN 'Mobile Money'
            WHEN 'carte_bancaire' THEN 'Carte bancaire'
            WHEN 'carte' THEN 'Carte bancaire'
            WHEN 'cheque' THEN 'Chèque'
            ELSE COALESCE(e.mode_paiement, '—')
          END,
        'reference', COALESCE(e.reference, ''),
        'montant_ttc', e.montant,
        'base_ht', public.calc_base_ht(e.montant, v_taux, v_prix_ttc),
        'tva', public.calc_tva(e.montant, v_taux, v_prix_ttc),
        'agent', COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.prenom, u.nom)), ''), '—')
      ) AS r,
      e.date_encaissement AS sort_ts
      FROM encaissements e
      JOIN factures f ON f.id = e.facture_id
      LEFT JOIN commandes c ON c.id = f.commande_id
      LEFT JOIN profiles u ON u.id = e.utilisateur_id
      WHERE f.etablissement_id = v_profile.etablissement_id
        AND e.date_encaissement >= p_date_debut
        AND e.date_encaissement <= p_date_fin
        AND (v_agent IS NULL OR e.utilisateur_id = v_agent)
        AND (
          v_dept IS NULL
          OR (v_dept = 'cuisine' AND f.numero_facture LIKE '%-CUI')
          OR (v_dept = 'bar' AND f.numero_facture LIKE '%-BAR')
        )
    ) s;

    SELECT jsonb_build_object(
      'montant_ttc', COALESCE(SUM(e.montant), 0),
      'base_ht', COALESCE(SUM(public.calc_base_ht(e.montant, v_taux, v_prix_ttc)), 0),
      'tva', COALESCE(SUM(public.calc_tva(e.montant, v_taux, v_prix_ttc)), 0),
      'remboursements', COALESCE(SUM(CASE WHEN e.montant < 0 THEN e.montant ELSE 0 END), 0),
      'lignes', COUNT(*)
    )
    INTO v_totaux
    FROM encaissements e
    JOIN factures f ON f.id = e.facture_id
    WHERE f.etablissement_id = v_profile.etablissement_id
      AND e.date_encaissement >= p_date_debut
      AND e.date_encaissement <= p_date_fin
      AND (v_agent IS NULL OR e.utilisateur_id = v_agent)
      AND (
        v_dept IS NULL
        OR (v_dept = 'cuisine' AND f.numero_facture LIKE '%-CUI')
        OR (v_dept = 'bar' AND f.numero_facture LIKE '%-BAR')
      );

  -- ==========================================================================
  -- JOURNAL DE CAISSE
  -- ==========================================================================
  ELSIF p_type = 'journal_caisse' THEN
    SELECT COALESCE(jsonb_agg(r ORDER BY s.sort_ts DESC), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT jsonb_build_object(
        'date', to_char(m.date_creation AT TIME ZONE v_tz, 'DD/MM/YYYY HH24:MI'),
        'type', CASE WHEN m.type = 'entree' THEN 'Entrée' ELSE 'Sortie' END,
        'origine', CASE WHEN m.encaissement_id IS NOT NULL THEN 'Vente encaissée' ELSE 'Mouvement manuel' END,
        'numero_facture', COALESCE(f.numero_facture, ''),
        'montant', m.montant,
        'mode_paiement',
          CASE m.mode_paiement
            WHEN 'especes' THEN 'Espèces'
            WHEN 'mobile_money' THEN 'Mobile Money'
            WHEN 'carte_bancaire' THEN 'Carte bancaire'
            WHEN 'carte' THEN 'Carte bancaire'
            WHEN 'cheque' THEN 'Chèque'
            WHEN 'virement' THEN 'Virement'
            ELSE COALESCE(m.mode_paiement, '—')
          END,
        'motif', m.motif,
        'commentaire', COALESCE(m.commentaire, ''),
        'agent', COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.prenom, u.nom)), ''), '—')
      ) AS r,
      m.date_creation AS sort_ts
      FROM mouvements_caisse m
      LEFT JOIN profiles u ON u.id = m.utilisateur_id
      LEFT JOIN encaissements en ON en.id = m.encaissement_id
      LEFT JOIN factures f ON f.id = en.facture_id
      WHERE m.etablissement_id = v_profile.etablissement_id
        AND m.date_creation >= p_date_debut
        AND m.date_creation <= p_date_fin
        AND (v_agent IS NULL OR m.utilisateur_id = v_agent)
        AND (
          v_dept IS NULL
          OR m.encaissement_id IS NULL
          OR (v_dept = 'cuisine' AND f.numero_facture LIKE '%-CUI')
          OR (v_dept = 'bar' AND f.numero_facture LIKE '%-BAR')
        )
    ) s;

    SELECT jsonb_build_object(
      'entrees', COALESCE(SUM(CASE WHEN m.type = 'entree' THEN m.montant ELSE 0 END), 0),
      'sorties', COALESCE(SUM(CASE WHEN m.type = 'sortie' THEN m.montant ELSE 0 END), 0),
      'dont_ventes', COALESCE(SUM(CASE WHEN m.type = 'entree' AND m.encaissement_id IS NOT NULL THEN m.montant ELSE 0 END), 0),
      'lignes', COUNT(*)
    )
    INTO v_totaux
    FROM mouvements_caisse m
    LEFT JOIN encaissements en ON en.id = m.encaissement_id
    LEFT JOIN factures f ON f.id = en.facture_id
    WHERE m.etablissement_id = v_profile.etablissement_id
      AND m.date_creation >= p_date_debut
      AND m.date_creation <= p_date_fin
      AND (v_agent IS NULL OR m.utilisateur_id = v_agent)
      AND (
        v_dept IS NULL
        OR m.encaissement_id IS NULL
        OR (v_dept = 'cuisine' AND f.numero_facture LIKE '%-CUI')
        OR (v_dept = 'bar' AND f.numero_facture LIKE '%-BAR')
      );

  -- ==========================================================================
  -- JOURNAL DES VENTES À CRÉDIT
  -- ==========================================================================
  ELSIF p_type = 'journal_ventes_credit' THEN
    SELECT COALESCE(jsonb_agg(r ORDER BY s.sort_ts DESC), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT jsonb_build_object(
        'date', to_char(f.date_generation AT TIME ZONE v_tz, 'DD/MM/YYYY HH24:MI'),
        'numero_facture', f.numero_facture,
        'numero_commande', COALESCE(c.numero_commande, '—'),
        'client', COALESCE(NULLIF(TRIM(CONCAT_WS(' ', cl.prenom, cl.nom)), ''), 'Client comptoir'),
        'telephone', COALESCE(cl.telephone, ''),
        'montant_total', COALESCE(f.montant_initial, f.montant_total),
        'montant_paye', f.montant_paye,
        'montant_restant', f.montant_restant,
        'statut_reglement',
          CASE f.statut
            WHEN 'payee' THEN 'Payée'
            WHEN 'partiellement_payee' THEN 'Partiellement payée'
            WHEN 'en_attente_paiement' THEN 'Impayée'
            ELSE COALESCE(f.statut, '—')
          END,
        'date_paiement_complet', CASE WHEN f.date_paiement_complet IS NOT NULL
          THEN to_char(f.date_paiement_complet AT TIME ZONE v_tz, 'DD/MM/YYYY HH24:MI') ELSE '' END,
        'agent', COALESCE(NULLIF(TRIM(CONCAT_WS(' ', sp.prenom, sp.nom)), ''), '—')
      ) AS r,
      f.date_generation AS sort_ts
      FROM factures f
      LEFT JOIN commandes c ON c.id = f.commande_id
      LEFT JOIN clients cl ON cl.id = c.client_id
      LEFT JOIN profiles sp ON sp.id = c.serveuse_id
      WHERE f.etablissement_id = v_profile.etablissement_id
        AND f.credit_sur = true
        AND f.date_generation >= p_date_debut
        AND f.date_generation <= p_date_fin
        AND (
          v_dept IS NULL
          OR (v_dept = 'cuisine' AND f.numero_facture LIKE '%-CUI')
          OR (v_dept = 'bar' AND f.numero_facture LIKE '%-BAR')
        )
    ) s;

    SELECT jsonb_build_object(
      'montant_total', COALESCE(SUM(COALESCE(f.montant_initial, f.montant_total)), 0),
      'montant_paye', COALESCE(SUM(f.montant_paye), 0),
      'montant_restant', COALESCE(SUM(f.montant_restant), 0),
      'factures', COUNT(*)
    )
    INTO v_totaux
    FROM factures f
    WHERE f.etablissement_id = v_profile.etablissement_id
      AND f.credit_sur = true
      AND f.date_generation >= p_date_debut
      AND f.date_generation <= p_date_fin
      AND (
        v_dept IS NULL
        OR (v_dept = 'cuisine' AND f.numero_facture LIKE '%-CUI')
        OR (v_dept = 'bar' AND f.numero_facture LIKE '%-BAR')
      );

  -- ==========================================================================
  -- JOURNAL DES RETOURS
  -- ==========================================================================
  ELSIF p_type = 'journal_retours' THEN
    SELECT COALESCE(jsonb_agg(r ORDER BY s.sort_ts DESC), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT jsonb_build_object(
        'date', to_char(r.date_retour AT TIME ZONE v_tz, 'DD/MM/YYYY HH24:MI'),
        'numero_retour', r.numero_retour,
        'numero_facture', COALESCE(f.numero_facture, '—'),
        'numero_commande', COALESCE(c.numero_commande, '—'),
        'produit', ri.nom_produit,
        'categorie', COALESCE(p.categorie, '—'),
        'departement', CASE WHEN p.categorie = 'nourriture' THEN 'Cuisine' ELSE 'Bar' END,
        'quantite', ri.quantite_retournee,
        'prix_unitaire', ri.prix_unitaire,
        'montant_ttc', ri.montant_ligne,
        'base_ht', public.calc_base_ht(ri.montant_ligne, v_taux, v_prix_ttc),
        'tva', public.calc_tva(ri.montant_ligne, v_taux, v_prix_ttc),
        'motif', COALESCE(r.motif, ''),
        'valide_par', COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.prenom, u.nom)), ''), '—')
      ) AS r,
      r.date_retour AS sort_ts
      FROM retours r
      JOIN retour_items ri ON ri.retour_id = r.id
      LEFT JOIN factures f ON f.id = r.facture_id
      LEFT JOIN commandes c ON c.id = r.commande_id
      LEFT JOIN produits p ON p.id = ri.produit_id
      LEFT JOIN profiles u ON u.id = r.utilisateur_id
      WHERE r.etablissement_id = v_profile.etablissement_id
        AND r.date_retour >= p_date_debut
        AND r.date_retour <= p_date_fin
        AND (
          v_dept IS NULL
          OR (CASE WHEN p.categorie = 'nourriture' THEN 'cuisine' ELSE 'bar' END) = v_dept
        )
    ) s;

    SELECT jsonb_build_object(
      'montant_ttc', COALESCE(SUM(ri.montant_ligne), 0),
      'base_ht', COALESCE(SUM(public.calc_base_ht(ri.montant_ligne, v_taux, v_prix_ttc)), 0),
      'tva', COALESCE(SUM(public.calc_tva(ri.montant_ligne, v_taux, v_prix_ttc)), 0),
      'quantite', COALESCE(SUM(ri.quantite_retournee), 0),
      'lignes', COUNT(*)
    )
    INTO v_totaux
    FROM retours r
    JOIN retour_items ri ON ri.retour_id = r.id
    LEFT JOIN produits p ON p.id = ri.produit_id
    WHERE r.etablissement_id = v_profile.etablissement_id
      AND r.date_retour >= p_date_debut
      AND r.date_retour <= p_date_fin
      AND (
        v_dept IS NULL
        OR (CASE WHEN p.categorie = 'nourriture' THEN 'cuisine' ELSE 'bar' END) = v_dept
      );

  -- ==========================================================================
  -- JOURNAL DES ÉCHANGES
  -- ==========================================================================
  ELSIF p_type = 'journal_echanges' THEN
    SELECT COALESCE(jsonb_agg(r ORDER BY s.sort_ts DESC), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT jsonb_build_object(
        'date', to_char(e.date_echange AT TIME ZONE v_tz, 'DD/MM/YYYY HH24:MI'),
        'numero_echange', e.numero_echange,
        'numero_facture', COALESCE(f.numero_facture, '—'),
        'numero_commande', COALESCE(c.numero_commande, '—'),
        'montant_retourne', e.montant_retourne,
        'montant_ajoute', e.montant_ajoute,
        'difference', e.difference_montant,
        'articles_sortants', COALESCE((
          SELECT STRING_AGG(s.nom_produit || ' x' || s.quantite_retournee, ' ; ')
          FROM echange_items_sortants s WHERE s.echange_id = e.id
        ), ''),
        'articles_entrants', COALESCE((
          SELECT STRING_AGG(en.nom_produit || ' x' || en.quantite_ajoutee, ' ; ')
          FROM echange_items_entrants en WHERE en.echange_id = e.id
        ), ''),
        'motif', COALESCE(e.motif, ''),
        'agent', COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.prenom, u.nom)), ''), '—')
      ) AS r,
      e.date_echange AS sort_ts
      FROM echanges e
      LEFT JOIN factures f ON f.id = e.facture_id
      LEFT JOIN commandes c ON c.id = e.commande_id
      LEFT JOIN profiles u ON u.id = e.utilisateur_id
      WHERE e.etablissement_id = v_profile.etablissement_id
        AND e.date_echange >= p_date_debut
        AND e.date_echange <= p_date_fin
    ) s;

    SELECT jsonb_build_object(
      'montant_retourne', COALESCE(SUM(e.montant_retourne), 0),
      'montant_ajoute', COALESCE(SUM(e.montant_ajoute), 0),
      'difference', COALESCE(SUM(e.difference_montant), 0),
      'echanges', COUNT(*)
    )
    INTO v_totaux
    FROM echanges e
    WHERE e.etablissement_id = v_profile.etablissement_id
      AND e.date_echange >= p_date_debut
      AND e.date_echange <= p_date_fin;

  -- ==========================================================================
  -- RAPPORT DE CAISSE JOURNALIER
  -- ==========================================================================
  ELSIF p_type = 'rapport_caisse_journalier' THEN
    SELECT COALESCE(jsonb_agg(r ORDER BY s.sort_ts), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT jsonb_build_object(
        'date', to_char(j.d, 'DD/MM/YYYY'),
        'entrees_caisse', mc.entrees,
        'entrees_hors_ventes', mc.entrees_hors_ventes,
        'sorties_caisse', mc.sorties,
        'ventes_encaissees', enc.total,
        'especes', enc.especes,
        'mobile_money', enc.mobile_money,
        'carte_bancaire', enc.carte,
        'cheque', enc.cheque,
        'ventes_a_credit', cr.total,
        'montant_theorique', mc.entrees_hors_ventes + enc.total - mc.sorties,
        'montant_compte', COALESCE(cc.montant_compte, 0),
        'ecart', COALESCE(cc.ecart, 0),
        'commentaire', COALESCE(cc.commentaire, '')
      ) AS r,
      j.d AS sort_ts
      FROM (
        SELECT (generate_series(v_debut_date, v_fin_date, INTERVAL '1 day'))::date AS d
      ) j
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(SUM(CASE WHEN m.type = 'entree' THEN m.montant END), 0) AS entrees,
          COALESCE(SUM(CASE WHEN m.type = 'entree' AND m.encaissement_id IS NULL THEN m.montant END), 0) AS entrees_hors_ventes,
          COALESCE(SUM(CASE WHEN m.type = 'sortie' THEN m.montant END), 0) AS sorties
        FROM mouvements_caisse m
        WHERE m.etablissement_id = v_profile.etablissement_id
          AND (m.date_creation AT TIME ZONE v_tz)::date = j.d
      ) mc ON true
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(SUM(e.montant), 0) AS total,
          COALESCE(SUM(CASE WHEN e.mode_paiement = 'especes' THEN e.montant END), 0) AS especes,
          COALESCE(SUM(CASE WHEN e.mode_paiement = 'mobile_money' THEN e.montant END), 0) AS mobile_money,
          COALESCE(SUM(CASE WHEN e.mode_paiement IN ('carte_bancaire', 'carte') THEN e.montant END), 0) AS carte,
          COALESCE(SUM(CASE WHEN e.mode_paiement = 'cheque' THEN e.montant END), 0) AS cheque
        FROM encaissements e
        WHERE e.etablissement_id = v_profile.etablissement_id
          AND (e.date_encaissement AT TIME ZONE v_tz)::date = j.d
      ) enc ON true
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(COALESCE(f.montant_initial, f.montant_total)), 0) AS total
        FROM factures f
        WHERE f.etablissement_id = v_profile.etablissement_id
          AND f.credit_sur = true
          AND (f.date_generation AT TIME ZONE v_tz)::date = j.d
      ) cr ON true
      LEFT JOIN clotures_caisse cc
        ON cc.etablissement_id = v_profile.etablissement_id
       AND cc.date_cloture = j.d
    ) s;

    SELECT jsonb_build_object(
      'entrees_caisse', COALESCE(SUM((r->>'entrees_caisse')::numeric), 0),
      'sorties_caisse', COALESCE(SUM((r->>'sorties_caisse')::numeric), 0),
      'ventes_encaissees', COALESCE(SUM((r->>'ventes_encaissees')::numeric), 0),
      'especes', COALESCE(SUM((r->>'especes')::numeric), 0),
      'mobile_money', COALESCE(SUM((r->>'mobile_money')::numeric), 0),
      'carte_bancaire', COALESCE(SUM((r->>'carte_bancaire')::numeric), 0),
      'cheque', COALESCE(SUM((r->>'cheque')::numeric), 0),
      'ventes_a_credit', COALESCE(SUM((r->>'ventes_a_credit')::numeric), 0),
      'ecart_total', COALESCE(SUM((r->>'ecart')::numeric), 0),
      'jours', jsonb_array_length(v_rows)
    )
    INTO v_totaux
    FROM jsonb_array_elements(v_rows) AS r;

  ELSE
    RAISE EXCEPTION 'Type d''export inconnu : %', p_type;
  END IF;

  v_meta := jsonb_build_object(
    'type', p_type,
    'etablissement_id', v_etab.id,
    'etablissement_nom', v_etab.nom,
    'date_debut', p_date_debut,
    'date_fin', p_date_fin,
    'devise', COALESCE(v_etab.devise, 'XAF'),
    'taux_tva', v_taux,
    'prix_ttc', v_prix_ttc,
    'fuseau_horaire', v_tz,
    'genere_le', NOW(),
    'genere_par', COALESCE(NULLIF(TRIM(CONCAT_WS(' ', v_profile.prenom, v_profile.nom)), ''), v_profile.role),
    'filtres', COALESCE(p_filtres, '{}'::jsonb)
  );

  RETURN jsonb_build_object(
    'meta', v_meta,
    'rows', v_rows,
    'totaux', v_totaux
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_export_dataset(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, JSONB) TO authenticated;

COMMENT ON FUNCTION public.get_export_dataset(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, JSONB) IS
  'Retourne le dataset JSON (meta + rows + totaux) d''un export comptable pour l''établissement de l''appelant. Types : journal_ventes, journal_encaissements, journal_caisse, journal_ventes_credit, journal_retours, journal_echanges, rapport_caisse_journalier.';

NOTIFY pgrst, 'reload schema';
