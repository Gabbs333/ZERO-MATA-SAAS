-- Migration: Bibliothèque de tarifs réutilisables
-- Description:
--   Les tarifs contextuels (happy hour, week-end, saison, plage horaire)
--   étaient jusqu'ici définis produit par produit : il fallait ressaisir nom,
--   prix et conditions pour chaque produit visé.
--
--   Cette migration introduit la notion de MODÈLE DE TARIF :
--     * `tarifs_modeles` = la règle réutilisable (nom, prix, jours, heures,
--       dates, priorité) propre à un établissement ;
--     * `tarifs_specifiques.modele_id` = lien de provenance entre une règle
--       appliquée à un produit et le modèle dont elle est issue ;
--     * `appliquer_modele_tarif(modele, produits[])` = applique (crée ou met à
--       jour) la règle sur un ou plusieurs produits en un seul appel.
--
--   Choix de conception : le modèle est un GABARIT. L'application écrit une
--   copie sur chaque produit ; modifier un produit n'altère donc jamais le
--   modèle, et modifier le modèle n'altère pas les produits déjà tarifés.
--   Pour propager une modification, on réapplique le modèle (bouton dédié).
--
--   Aucun impact sur `get_prix_produit()` : la sémantique de tarification est
--   inchangée, `modele_id` n'est qu'une métadonnée de provenance.
--
--   Idempotente.
-- Created: 2026-04-45

-- ============================================================================
-- 1. TABLE DES MODÈLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tarifs_modeles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id UUID NOT NULL REFERENCES public.etablissements(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  prix_vente INTEGER NOT NULL CHECK (prix_vente >= 0),
  jours_semaine INTEGER[],
  heure_debut TIME,
  heure_fin TIME,
  date_debut DATE,
  date_fin DATE,
  priorite INTEGER NOT NULL DEFAULT 0,
  actif BOOLEAN NOT NULL DEFAULT TRUE,
  date_creation TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  date_mise_a_jour TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Un seul modèle par nom et par établissement : l'enregistrement depuis l'app
-- fait un upsert sur ce couple.
CREATE UNIQUE INDEX IF NOT EXISTS uq_tarifs_modeles_etab_nom
  ON public.tarifs_modeles (etablissement_id, nom);

CREATE INDEX IF NOT EXISTS idx_tarifs_modeles_etablissement
  ON public.tarifs_modeles (etablissement_id);

-- ============================================================================
-- 2. LIEN DEPUIS LES RÈGLES APPLIQUÉES
-- ============================================================================

ALTER TABLE public.tarifs_specifiques
  ADD COLUMN IF NOT EXISTS modele_id UUID REFERENCES public.tarifs_modeles(id) ON DELETE SET NULL;

-- NULL est distinct dans un index unique : plusieurs règles « manuelles »
-- (sans modèle) restent possibles pour un même produit, mais on ne peut avoir
-- qu'une seule règle issue d'un modèle donné.
CREATE UNIQUE INDEX IF NOT EXISTS uq_tarifs_specifiques_produit_modele
  ON public.tarifs_specifiques (produit_id, modele_id);

CREATE INDEX IF NOT EXISTS idx_tarifs_specifiques_modele
  ON public.tarifs_specifiques (modele_id);

-- ============================================================================
-- 3. SÉCURITÉ (RLS) — lecture pour les membres, écriture patron/gérant
-- ============================================================================

ALTER TABLE public.tarifs_modeles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tarifs_modeles_read ON public.tarifs_modeles;
CREATE POLICY tarifs_modeles_read ON public.tarifs_modeles
  FOR SELECT
  USING (
    etablissement_id IN (
      SELECT p.etablissement_id FROM public.profiles p WHERE p.id = auth.uid()
    )
    OR public.is_admin()
  );

DROP POLICY IF EXISTS tarifs_modeles_write ON public.tarifs_modeles;
CREATE POLICY tarifs_modeles_write ON public.tarifs_modeles
  FOR ALL
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.actif = TRUE
        AND p.role IN ('patron', 'gerant')
        AND p.etablissement_id = tarifs_modeles.etablissement_id
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.actif = TRUE
        AND p.role IN ('patron', 'gerant')
        AND p.etablissement_id = tarifs_modeles.etablissement_id
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarifs_modeles TO authenticated;

COMMENT ON TABLE public.tarifs_modeles IS
  'Bibliothèque de tarifs contextuels réutilisables (gabarits) par établissement.';

-- ============================================================================
-- 4. AMORÇAGE : UN MODÈLE PAR (ÉTABLISSEMENT, NOM) DÉJÀ UTILISÉ
-- ============================================================================

DO $seed_tarifs_modeles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.tarifs_modeles) THEN
    INSERT INTO public.tarifs_modeles (
      etablissement_id, nom, prix_vente, jours_semaine,
      heure_debut, heure_fin, date_debut, date_fin, priorite, actif
    )
    SELECT DISTINCT ON (t.etablissement_id, t.nom_tarif)
      t.etablissement_id,
      t.nom_tarif,
      t.prix_vente,
      t.jours_semaine,
      t.heure_debut,
      t.heure_fin,
      t.date_debut,
      t.date_fin,
      t.priorite,
      TRUE
    FROM public.tarifs_specifiques t
    WHERE t.etablissement_id IS NOT NULL
    ORDER BY t.etablissement_id, t.nom_tarif, t.date_creation DESC;
  END IF;
END
$seed_tarifs_modeles$;

-- Rattachement des règles strictement identiques à un modèle (nom + prix).
UPDATE public.tarifs_specifiques t
SET modele_id = m.id
FROM public.tarifs_modeles m
WHERE t.modele_id IS NULL
  AND t.etablissement_id = m.etablissement_id
  AND t.nom_tarif = m.nom
  AND t.prix_vente = m.prix_vente;

-- ============================================================================
-- 5. APPLICATION D'UN MODÈLE À UN OU PLUSIEURS PRODUITS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.appliquer_modele_tarif(
  p_modele_id UUID,
  p_produit_ids UUID[] DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_profile RECORD;
  v_modele RECORD;
  v_ids UUID[];
  v_count INTEGER := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Non authentifié.';
  END IF;

  SELECT role, etablissement_id, actif INTO v_profile
  FROM profiles WHERE id = v_uid;

  IF NOT FOUND
     OR v_profile.role NOT IN ('patron', 'gerant')
     OR COALESCE(v_profile.actif, true) <> true THEN
    RAISE EXCEPTION 'Accès refusé.';
  END IF;

  SELECT * INTO v_modele FROM tarifs_modeles WHERE id = p_modele_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Modèle de tarif introuvable.';
  END IF;

  IF v_modele.etablissement_id <> v_profile.etablissement_id THEN
    RAISE EXCEPTION 'Ce modèle appartient à un autre établissement.';
  END IF;

  IF p_produit_ids IS NULL OR array_length(p_produit_ids, 1) IS NULL THEN
    -- Sans liste explicite : on réapplique aux produits déjà liés au modèle.
    SELECT array_agg(DISTINCT t.produit_id) INTO v_ids
    FROM tarifs_specifiques t
    WHERE t.modele_id = p_modele_id;
  ELSE
    SELECT array_agg(DISTINCT p.id) INTO v_ids
    FROM produits p
    WHERE p.id = ANY (p_produit_ids)
      AND p.etablissement_id = v_modele.etablissement_id;
  END IF;

  IF v_ids IS NULL THEN
    RETURN json_build_object('success', true, 'produits', 0);
  END IF;

  INSERT INTO tarifs_specifiques (
    etablissement_id, produit_id, modele_id, nom_tarif, prix_vente,
    jours_semaine, heure_debut, heure_fin, date_debut, date_fin,
    priorite, actif
  )
  SELECT
    v_modele.etablissement_id, x.produit_id, v_modele.id, v_modele.nom,
    v_modele.prix_vente, v_modele.jours_semaine, v_modele.heure_debut,
    v_modele.heure_fin, v_modele.date_debut, v_modele.date_fin,
    v_modele.priorite, v_modele.actif
  FROM unnest(v_ids) AS x(produit_id)
  ON CONFLICT (produit_id, modele_id) DO UPDATE
  SET nom_tarif    = EXCLUDED.nom_tarif,
      prix_vente   = EXCLUDED.prix_vente,
      jours_semaine = EXCLUDED.jours_semaine,
      heure_debut  = EXCLUDED.heure_debut,
      heure_fin    = EXCLUDED.heure_fin,
      date_debut   = EXCLUDED.date_debut,
      date_fin     = EXCLUDED.date_fin,
      priorite     = EXCLUDED.priorite,
      actif        = EXCLUDED.actif;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN json_build_object('success', true, 'produits', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.appliquer_modele_tarif(UUID, UUID[]) TO authenticated;

COMMENT ON FUNCTION public.appliquer_modele_tarif(UUID, UUID[]) IS
  'Applique (crée ou met à jour) un modèle de tarif sur une liste de produits. Sans liste, réapplique aux produits déjà liés.';

NOTIFY pgrst, 'reload schema';
