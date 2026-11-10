-- Migration: Exports P1 — archivage Storage, rétention 24 mois, synthèse PDF
-- Description:
--   1. Bucket `exports` : privé, types MIME CSV/XLSX/PDF
--   2. RLS Storage cloisonnée par établissement (dossier = etablissement_id)
--   3. Suppression autorisée sur exports_journalises (purge des archives)
--   4. Rétention 24 mois : purge pilotée par date_purge_prevue
--   5. RPC get_synthese_periode() : agrégats de synthèse pour le PDF de clôture
-- Created: 2026-04-35

-- ============================================================================
-- 1. BUCKET D'ARCHIVAGE
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'exports',
  'exports',
  false,
  52428800,
  ARRAY[
    'text/csv',
    'application/pdf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  "public" = false,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY[
    'text/csv',
    'application/pdf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];

-- ============================================================================
-- 2. POLITIQUES STORAGE CLOISONNÉES PAR ÉTABLISSEMENT
-- ============================================================================
-- Convention de chemin : {etablissement_id}/{type_export}/{fichier}
-- Un patron/gerant ne peut lire, écrire ou supprimer que le dossier de son
-- propre établissement (les anciennes politiques autorisaient tout locataire).

DROP POLICY IF EXISTS "patron_gerant_can_upload_exports" ON storage.objects;
DROP POLICY IF EXISTS "patron_gerant_can_read_exports" ON storage.objects;
DROP POLICY IF EXISTS "patron_gerant_can_update_exports" ON storage.objects;
DROP POLICY IF EXISTS "patron_gerant_can_delete_exports" ON storage.objects;
DROP POLICY IF EXISTS "exports_insert_own_etablissement" ON storage.objects;
DROP POLICY IF EXISTS "exports_read_own_etablissement" ON storage.objects;
DROP POLICY IF EXISTS "exports_update_own_etablissement" ON storage.objects;
DROP POLICY IF EXISTS "exports_delete_own_etablissement" ON storage.objects;

CREATE POLICY "exports_insert_own_etablissement"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'exports'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('patron', 'gerant')
        AND p.actif = true
        AND p.etablissement_id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "exports_read_own_etablissement"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'exports'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('patron', 'gerant')
        AND p.actif = true
        AND p.etablissement_id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "exports_update_own_etablissement"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'exports'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('patron', 'gerant')
        AND p.actif = true
        AND p.etablissement_id::text = (storage.foldername(name))[1]
    )
  )
  WITH CHECK (
    bucket_id = 'exports'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('patron', 'gerant')
        AND p.actif = true
        AND p.etablissement_id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "exports_delete_own_etablissement"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'exports'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('patron', 'gerant')
        AND p.actif = true
        AND p.etablissement_id::text = (storage.foldername(name))[1]
    )
  );

-- ============================================================================
-- 3. PURGE DES ARCHIVES (rétention 24 mois)
-- ============================================================================

DROP POLICY IF EXISTS "patron_gerant_delete_exports" ON public.exports_journalises;
CREATE POLICY "patron_gerant_delete_exports"
  ON public.exports_journalises FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('patron', 'gerant')
        AND p.actif = true
        AND p.etablissement_id = exports_journalises.etablissement_id
    )
  );

-- Supprime les lignes de journal expirées. Les fichiers correspondants doivent
-- être supprimés via l'API Storage (le client le fait avant d'appeler cette
-- fonction) : une suppression SQL directe laisserait les objets orphelins.
DROP FUNCTION IF EXISTS public.cleanup_old_exports();

CREATE OR REPLACE FUNCTION public.cleanup_old_exports()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supprimes INTEGER := 0;
BEGIN
  DELETE FROM public.exports_journalises
  WHERE date_purge_prevue <= NOW();

  GET DIAGNOSTICS v_supprimes = ROW_COUNT;
  RETURN v_supprimes;
END;
$$;

COMMENT ON FUNCTION public.cleanup_old_exports() IS
  'Supprime les entrées de journal d''export arrivées à échéance (24 mois). Les fichiers du bucket doivent être retirés via l''API Storage.';

-- ============================================================================
-- 4. SYNTHÈSE DE PÉRIODE (support du PDF de clôture)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_synthese_periode(
  p_date_debut TIMESTAMPTZ,
  p_date_fin TIMESTAMPTZ
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

  v_ca INTEGER := 0;
  v_ca_initial INTEGER := 0;
  v_paye INTEGER := 0;
  v_restant INTEGER := 0;
  v_credit INTEGER := 0;
  v_impaye INTEGER := 0;
  v_nb_factures INTEGER := 0;
  v_nb_impayees INTEGER := 0;

  v_ca_bar INTEGER := 0;
  v_ca_cuisine INTEGER := 0;
  v_ca_global INTEGER := 0;

  v_enc_total INTEGER := 0;
  v_enc_especes INTEGER := 0;
  v_enc_mm INTEGER := 0;
  v_enc_carte INTEGER := 0;
  v_enc_cheque INTEGER := 0;
  v_enc_ventes INTEGER := 0;
  v_enc_credit_reglements INTEGER := 0;

  v_caisse_entrees INTEGER := 0;
  v_caisse_sorties INTEGER := 0;
  v_caisse_solde INTEGER := 0;
  v_clotures_nb INTEGER := 0;
  v_cloture_ecart INTEGER := 0;

  v_retours_montant INTEGER := 0;
  v_retours_nb INTEGER := 0;

  v_ech_retourne INTEGER := 0;
  v_ech_ajoute INTEGER := 0;
  v_ech_difference INTEGER := 0;
  v_ech_nb INTEGER := 0;

  v_cogs INTEGER := 0;
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
  v_taux := COALESCE(v_etab.taux_tva, 19.25);
  v_prix_ttc := COALESCE(v_etab.prix_ttc, true);
  v_tz := COALESCE(v_etab.fuseau_horaire, 'Africa/Douala');

  -- --------------------------------------------------------------------------
  -- Factures de la période
  -- --------------------------------------------------------------------------
  SELECT
    COALESCE(SUM(f.montant_total), 0),
    COALESCE(SUM(COALESCE(f.montant_initial, f.montant_total)), 0),
    COALESCE(SUM(f.montant_paye), 0),
    COALESCE(SUM(f.montant_restant), 0),
    COALESCE(SUM(CASE WHEN f.credit_sur THEN f.montant_restant ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN NOT f.credit_sur THEN f.montant_restant ELSE 0 END), 0),
    COUNT(*),
    COUNT(*) FILTER (WHERE f.statut <> 'payee')
  INTO
    v_ca, v_ca_initial, v_paye, v_restant, v_credit, v_impaye, v_nb_factures, v_nb_impayees
  FROM factures f
  WHERE f.etablissement_id = v_profile.etablissement_id
    AND f.date_generation >= p_date_debut
    AND f.date_generation <= p_date_fin;

  -- Répartition par département (factures scindées -BAR / -CUI)
  SELECT
    COALESCE(SUM(CASE WHEN f.numero_facture LIKE '%-BAR' THEN f.montant_total ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN f.numero_facture LIKE '%-CUI' THEN f.montant_total ELSE 0 END), 0),
    COALESCE(SUM(CASE
      WHEN f.numero_facture NOT LIKE '%-BAR' AND f.numero_facture NOT LIKE '%-CUI'
        THEN f.montant_total ELSE 0 END), 0)
  INTO v_ca_bar, v_ca_cuisine, v_ca_global
  FROM factures f
  WHERE f.etablissement_id = v_profile.etablissement_id
    AND f.date_generation >= p_date_debut
    AND f.date_generation <= p_date_fin;

  -- --------------------------------------------------------------------------
  -- Encaissements de la période
  -- --------------------------------------------------------------------------
  SELECT
    COALESCE(SUM(e.montant), 0),
    COALESCE(SUM(CASE WHEN e.mode_paiement = 'especes' THEN e.montant ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN e.mode_paiement = 'mobile_money' THEN e.montant ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN e.mode_paiement IN ('carte_bancaire', 'carte') THEN e.montant ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN e.mode_paiement = 'cheque' THEN e.montant ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN COALESCE(e.reference, '') NOT LIKE 'CREDIT-%' THEN e.montant ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN COALESCE(e.reference, '') LIKE 'CREDIT-%' THEN e.montant ELSE 0 END), 0)
  INTO
    v_enc_total, v_enc_especes, v_enc_mm, v_enc_carte, v_enc_cheque,
    v_enc_ventes, v_enc_credit_reglements
  FROM encaissements e
  WHERE e.etablissement_id = v_profile.etablissement_id
    AND e.date_encaissement >= p_date_debut
    AND e.date_encaissement <= p_date_fin;

  -- --------------------------------------------------------------------------
  -- Caisse : mouvements hors ventes (les ventes sont déjà dans encaissements)
  -- --------------------------------------------------------------------------
  SELECT
    COALESCE(SUM(CASE WHEN m.type = 'entree' AND m.encaissement_id IS NULL THEN m.montant ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN m.type = 'sortie' THEN m.montant ELSE 0 END), 0)
  INTO v_caisse_entrees, v_caisse_sorties
  FROM mouvements_caisse m
  WHERE m.etablissement_id = v_profile.etablissement_id
    AND m.date_creation >= p_date_debut
    AND m.date_creation <= p_date_fin;

  v_caisse_solde := v_caisse_entrees + v_enc_total - v_caisse_sorties;

  SELECT COUNT(*), COALESCE(SUM(cc.ecart), 0)
  INTO v_clotures_nb, v_cloture_ecart
  FROM clotures_caisse cc
  WHERE cc.etablissement_id = v_profile.etablissement_id
    AND cc.date_cloture >= (p_date_debut AT TIME ZONE v_tz)::date
    AND cc.date_cloture <= (p_date_fin AT TIME ZONE v_tz)::date;

  -- --------------------------------------------------------------------------
  -- Retours et échanges
  -- --------------------------------------------------------------------------
  SELECT COALESCE(SUM(r.montant_total_retour), 0), COUNT(*)
  INTO v_retours_montant, v_retours_nb
  FROM retours r
  WHERE r.etablissement_id = v_profile.etablissement_id
    AND r.date_retour >= p_date_debut
    AND r.date_retour <= p_date_fin;

  SELECT
    COALESCE(SUM(e.montant_retourne), 0),
    COALESCE(SUM(e.montant_ajoute), 0),
    COALESCE(SUM(e.difference_montant), 0),
    COUNT(*)
  INTO v_ech_retourne, v_ech_ajoute, v_ech_difference, v_ech_nb
  FROM echanges e
  WHERE e.etablissement_id = v_profile.etablissement_id
    AND e.date_echange >= p_date_debut
    AND e.date_echange <= p_date_fin;

  -- --------------------------------------------------------------------------
  -- Valorisation du stock vendu (COGS)
  -- --------------------------------------------------------------------------
  SELECT COALESCE(SUM(ms.quantite * COALESCE(ms.cout_unitaire, p.prix_achat, 0)), 0)
  INTO v_cogs
  FROM mouvements_stock ms
  JOIN produits p ON p.id = ms.produit_id
  WHERE ms.etablissement_id = v_profile.etablissement_id
    AND ms.type = 'sortie'
    AND ms.type_reference = 'commande'
    AND ms.date_creation >= p_date_debut
    AND ms.date_creation <= p_date_fin;

  RETURN jsonb_build_object(
    'meta', jsonb_build_object(
      'etablissement_nom', v_etab.nom,
      'date_debut', p_date_debut,
      'date_fin', p_date_fin,
      'devise', COALESCE(v_etab.devise, 'XAF'),
      'taux_tva', v_taux,
      'prix_ttc', v_prix_ttc,
      'fuseau_horaire', v_tz,
      'genere_le', NOW(),
      'genere_par', COALESCE(NULLIF(TRIM(CONCAT_WS(' ', v_profile.prenom, v_profile.nom)), ''), v_profile.role)
    ),
    'ventes', jsonb_build_object(
      'chiffre_affaires', v_ca,
      'montant_initial', v_ca_initial,
      'montant_paye', v_paye,
      'montant_restant', v_restant,
      'base_ht', public.calc_base_ht(v_ca, v_taux, v_prix_ttc),
      'tva', public.calc_tva(v_ca, v_taux, v_prix_ttc),
      'nb_factures', v_nb_factures,
      'bar', v_ca_bar,
      'cuisine', v_ca_cuisine,
      'global', v_ca_global
    ),
    'encaissements', jsonb_build_object(
      'total', v_enc_total,
      'ventes', v_enc_ventes,
      'reglements_credit', v_enc_credit_reglements,
      'especes', v_enc_especes,
      'mobile_money', v_enc_mm,
      'carte_bancaire', v_enc_carte,
      'cheque', v_enc_cheque
    ),
    'credits', jsonb_build_object(
      'ventes_a_credit', v_credit,
      'factures_impayees', v_impaye,
      'nb_factures_impayees', v_nb_impayees,
      'reste_a_encaisser', v_restant
    ),
    'caisse', jsonb_build_object(
      'entrees_hors_ventes', v_caisse_entrees,
      'sorties', v_caisse_sorties,
      'solde_theorique', v_caisse_solde,
      'clotures', v_clotures_nb,
      'ecart_total', v_cloture_ecart
    ),
    'retours', jsonb_build_object(
      'montant', v_retours_montant,
      'nb', v_retours_nb
    ),
    'echanges', jsonb_build_object(
      'montant_retourne', v_ech_retourne,
      'montant_ajoute', v_ech_ajoute,
      'difference', v_ech_difference,
      'nb', v_ech_nb
    ),
    'stock', jsonb_build_object(
      'valeur_vendue', v_cogs
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_synthese_periode(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

COMMENT ON FUNCTION public.get_synthese_periode(TIMESTAMPTZ, TIMESTAMPTZ) IS
  'Agrégats de synthèse (ventes, encaissements, crédits, caisse, retours, échanges, valorisation du stock vendu) pour l''établissement de l''appelant.';

NOTIFY pgrst, 'reload schema';
