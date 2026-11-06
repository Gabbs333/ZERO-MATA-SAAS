-- Migration: Fiabilisation des statistiques « plats servis »
-- Description:
--   La vue plats_servis_journalier s'appuyait uniquement sur commandes.date_validation.
--   Or certaines commandes validées (anciennes, imports, validation client) ont
--   date_validation NULL → elles étaient exclues et le compteur restait à 0.
--   La vue retombe désormais sur date_creation et tolère la casse sur la catégorie.
-- Created: 2026-04-33

CREATE OR REPLACE VIEW plats_servis_journalier AS
SELECT
  DATE(COALESCE(c.date_validation, c.date_creation)) AS jour,
  p.id AS produit_id,
  p.nom AS produit_nom,
  c.etablissement_id,
  SUM(ci.quantite) AS quantite_servie,
  SUM(ci.montant_ligne) AS chiffre_affaires,
  COUNT(DISTINCT c.id) AS nombre_commandes_concernees
FROM commande_items ci
JOIN commandes c ON ci.commande_id = c.id
JOIN produits p ON ci.produit_id = p.id
WHERE c.statut = 'validee'
  AND LOWER(BTRIM(p.categorie)) = 'nourriture'
GROUP BY DATE(COALESCE(c.date_validation, c.date_creation)), p.id, p.nom, c.etablissement_id
ORDER BY jour DESC, quantite_servie DESC;

-- ============================================================================
-- FONCTION : Statistiques des plats servis (inchangée sur le contrat)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_plats_servis_stats(
  p_date_debut TIMESTAMPTZ DEFAULT NULL,
  p_date_fin TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_etablissement_id UUID;
  v_result JSON;
BEGIN
  SELECT etablissement_id INTO v_etablissement_id
  FROM profiles
  WHERE id = auth.uid();

  IF v_etablissement_id IS NULL THEN
    RAISE EXCEPTION 'Aucun établissement associé à votre compte.';
  END IF;

  IF p_date_debut IS NULL THEN
    p_date_debut := DATE_TRUNC('day', NOW());
  END IF;
  IF p_date_fin IS NULL THEN
    p_date_fin := DATE_TRUNC('day', NOW()) + INTERVAL '1 day' - INTERVAL '1 second';
  END IF;

  SELECT json_build_object(
    'total_plats_servis', (
      SELECT COALESCE(SUM(quantite_servie), 0)
      FROM plats_servis_journalier
      WHERE etablissement_id = v_etablissement_id
        AND jour >= p_date_debut::DATE
        AND jour <= p_date_fin::DATE
    ),
    'chiffre_affaires_nourriture', (
      SELECT COALESCE(SUM(chiffre_affaires), 0)
      FROM plats_servis_journalier
      WHERE etablissement_id = v_etablissement_id
        AND jour >= p_date_debut::DATE
        AND jour <= p_date_fin::DATE
    ),
    'plats_par_produit', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'produit_id', produit_id,
          'produit_nom', produit_nom,
          'quantite_servie', quantite_servie,
          'chiffre_affaires', chiffre_affaires
        )
        ORDER BY quantite_servie DESC
      ), '[]'::json)
      FROM (
        SELECT produit_id, produit_nom,
               SUM(quantite_servie) AS quantite_servie,
               SUM(chiffre_affaires) AS chiffre_affaires
        FROM plats_servis_journalier
        WHERE etablissement_id = v_etablissement_id
          AND jour >= p_date_debut::DATE
          AND jour <= p_date_fin::DATE
        GROUP BY produit_id, produit_nom
      ) AS par_produit
    ),
    'plats_par_jour', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'jour', jour,
          'quantite_servie', total_jour
        )
        ORDER BY jour ASC
      ), '[]'::json)
      FROM (
        SELECT jour, SUM(quantite_servie) AS total_jour
        FROM plats_servis_journalier
        WHERE etablissement_id = v_etablissement_id
          AND jour >= p_date_debut::DATE
          AND jour <= p_date_fin::DATE
        GROUP BY jour
      ) AS journalier
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT SELECT ON plats_servis_journalier TO authenticated;
GRANT EXECUTE ON FUNCTION get_plats_servis_stats(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

COMMENT ON VIEW plats_servis_journalier IS 'Comptabilise les plats (nourriture) servis par jour et par produit (repli sur date_creation si date_validation est NULL).';
COMMENT ON FUNCTION get_plats_servis_stats IS 'Retourne les statistiques des plats servis : total, par produit, par jour.';

NOTIFY pgrst, 'reload schema';
