-- Migration: Exports contextuels — journal des factures
-- Description:
--   1. get_export_factures() : une ligne par facture (utile depuis l'écran
--      Transactions / Factures), avec filtre statut et département.
--   2. get_export_dataset() : routage du type journal_factures.
-- Created: 2026-04-40
--
-- Filtres acceptés dans p_filtres :
--   departement : 'bar' | 'cuisine'
--   statut      : 'payee' | 'partielle' | 'impayee' | 'credit' | 'impayee_hors_credit'

CREATE OR REPLACE FUNCTION public.get_export_factures(
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
  v_statut TEXT := NULLIF(LOWER(p_filtres->>'statut'), '');
  v_debut_date DATE;
  v_fin_date DATE;
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
  v_debut_date := (p_date_debut AT TIME ZONE v_tz)::date;
  v_fin_date := (p_date_fin AT TIME ZONE v_tz)::date;

  SELECT COALESCE(jsonb_agg(r ORDER BY s.sort_ts DESC, s.numero), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT jsonb_build_object(
      'date', to_char(f.date_generation AT TIME ZONE v_tz, 'DD/MM/YYYY HH24:MI'),
      'numero_facture', f.numero_facture,
      'numero_commande', COALESCE(c.numero_commande, '—'),
      'departement',
        CASE
          WHEN f.numero_facture LIKE '%-CUI' THEN 'Cuisine'
          WHEN f.numero_facture LIKE '%-BAR' THEN 'Bar'
          ELSE 'Global'
        END,
      'client', COALESCE(NULLIF(TRIM(CONCAT_WS(' ', cl.prenom, cl.nom)), ''), ''),
      'telephone', COALESCE(cl.telephone, ''),
      'agent', COALESCE(NULLIF(TRIM(CONCAT_WS(' ', sp.prenom, sp.nom)), ''), '—'),
      'montant_initial', COALESCE(f.montant_initial, f.montant_total),
      'montant_total', f.montant_total,
      'montant_paye', f.montant_paye,
      'montant_restant', f.montant_restant,
      'statut',
        CASE f.statut
          WHEN 'payee' THEN 'Payée'
          WHEN 'partiellement_payee' THEN 'Partiellement payée'
          WHEN 'en_attente_paiement' THEN 'Impayée'
          ELSE COALESCE(f.statut, '—')
        END,
      'vente_a_credit', CASE WHEN f.credit_sur THEN 'Oui' ELSE 'Non' END,
      'date_paiement_complet',
        CASE WHEN f.date_paiement_complet IS NOT NULL
             THEN to_char(f.date_paiement_complet AT TIME ZONE v_tz, 'DD/MM/YYYY HH24:MI')
             ELSE '' END
    ) AS r,
    f.date_generation AS sort_ts,
    f.numero_facture AS numero
    FROM factures f
    LEFT JOIN commandes c ON c.id = f.commande_id
    LEFT JOIN clients cl ON cl.id = c.client_id
    LEFT JOIN profiles sp ON sp.id = c.serveuse_id
    WHERE f.etablissement_id = v_profile.etablissement_id
      AND f.date_generation >= p_date_debut
      AND f.date_generation <= p_date_fin
      AND (
        v_dept IS NULL
        OR (v_dept = 'cuisine' AND f.numero_facture LIKE '%-CUI')
        OR (v_dept = 'bar' AND f.numero_facture LIKE '%-BAR')
      )
      AND (
        v_statut IS NULL
        OR (v_statut = 'payee' AND f.statut = 'payee')
        OR (v_statut = 'partielle' AND f.statut = 'partiellement_payee')
        OR (v_statut = 'impayee' AND f.statut <> 'payee')
        OR (v_statut = 'credit' AND f.credit_sur = true)
        OR (v_statut = 'impayee_hors_credit' AND f.statut <> 'payee' AND f.credit_sur = false)
      )
  ) s;

  SELECT jsonb_build_object(
    'factures', COALESCE(COUNT(*), 0),
    'factures_impayees', COALESCE(SUM(CASE WHEN f.statut <> 'payee' THEN 1 ELSE 0 END), 0),
    'montant_initial', COALESCE(SUM(COALESCE(f.montant_initial, f.montant_total)), 0),
    'montant_total', COALESCE(SUM(f.montant_total), 0),
    'montant_paye', COALESCE(SUM(f.montant_paye), 0),
    'montant_restant', COALESCE(SUM(f.montant_restant), 0),
    'ventes_a_credit', COALESCE(SUM(CASE WHEN f.credit_sur THEN f.montant_restant ELSE 0 END), 0)
  )
  INTO v_totaux
  FROM factures f
  WHERE f.etablissement_id = v_profile.etablissement_id
    AND f.date_generation >= p_date_debut
    AND f.date_generation <= p_date_fin
    AND (
      v_dept IS NULL
      OR (v_dept = 'cuisine' AND f.numero_facture LIKE '%-CUI')
      OR (v_dept = 'bar' AND f.numero_facture LIKE '%-BAR')
    )
    AND (
      v_statut IS NULL
      OR (v_statut = 'payee' AND f.statut = 'payee')
      OR (v_statut = 'partielle' AND f.statut = 'partiellement_payee')
      OR (v_statut = 'impayee' AND f.statut <> 'payee')
      OR (v_statut = 'credit' AND f.credit_sur = true)
      OR (v_statut = 'impayee_hors_credit' AND f.statut <> 'payee' AND f.credit_sur = false)
    );

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

GRANT EXECUTE ON FUNCTION public.get_export_factures(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, JSONB) TO authenticated;

COMMENT ON FUNCTION public.get_export_factures(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, JSONB) IS
  'Journal des factures (une ligne par facture) pour l''établissement de l''appelant.';

-- ============================================================================
-- ROUTAGE
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

  IF to_regprocedure('public.get_export_dataset_core(text,timestamptz,timestamptz,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'Fonction get_export_dataset_core absente : exécutez la migration 20260436.';
  END IF;

  RETURN public.get_export_dataset_core(p_type, p_date_debut, p_date_fin, p_filtres);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_export_dataset(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, JSONB) TO authenticated;

NOTIFY pgrst, 'reload schema';
