-- Migration: Comptabilisation des plats servis (nourriture)
-- Description: Vue et fonction pour compter le nombre de repas/plats servis par jour
-- Created: 2026-04-12

-- ============================================================================
-- VUE : Plats servis journaliers
-- ============================================================================

CREATE OR REPLACE VIEW plats_servis_journalier AS
SELECT
  DATE(c.date_validation) AS jour,
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
  AND p.categorie = 'nourriture'
GROUP BY DATE(c.date_validation), p.id, p.nom, c.etablissement_id
ORDER BY jour DESC, quantite_servie DESC;

-- ============================================================================
-- FONCTION : Statistiques des plats servis
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
  -- Récupérer l'établissement de l'utilisateur connecté
  SELECT etablissement_id INTO v_etablissement_id
  FROM profiles
  WHERE id = auth.uid();

  IF v_etablissement_id IS NULL THEN
    RAISE EXCEPTION 'Aucun établissement associé à votre compte.';
  END IF;

  -- Si pas de dates fournies, prendre aujourd'hui par défaut
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
      SELECT json_agg(
        json_build_object(
          'produit_id', produit_id,
          'produit_nom', produit_nom,
          'quantite_servie', quantite_servie,
          'chiffre_affaires', chiffre_affaires
        )
        ORDER BY quantite_servie DESC
      )
      FROM plats_servis_journalier
      WHERE etablissement_id = v_etablissement_id
        AND jour >= p_date_debut::DATE
        AND jour <= p_date_fin::DATE
    ),
    'plats_par_jour', (
      SELECT json_agg(
        json_build_object(
          'jour', jour,
          'quantite_servie', total_jour
        )
        ORDER BY jour ASC
      )
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

-- ============================================================================
-- VUE : Commandes avec plats en attente (pour la cuisine)
-- ============================================================================

CREATE OR REPLACE VIEW commandes_nourriture_en_attente AS
SELECT
  c.id AS commande_id,
  c.numero_commande,
  t.numero AS table_numero,
  c.date_creation,
  ci.id AS commande_item_id,
  ci.produit_id,
  ci.nom_produit,
  ci.quantite,
  ci.prix_unitaire,
  p.categorie,
  c.etablissement_id
FROM commandes c
JOIN commande_items ci ON ci.commande_id = c.id
JOIN produits p ON ci.produit_id = p.id
JOIN tables t ON c.table_id = t.id
WHERE c.statut = 'validee'
  AND p.categorie = 'nourriture'
ORDER BY c.date_creation ASC;

-- ============================================================================
-- PERMISSIONS
-- ============================================================================

GRANT SELECT ON plats_servis_journalier TO authenticated;
GRANT SELECT ON commandes_nourriture_en_attente TO authenticated;
GRANT EXECUTE ON FUNCTION get_plats_servis_stats(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- ============================================================================
-- COMMENTAIRES
-- ============================================================================

COMMENT ON VIEW plats_servis_journalier IS 'Comptabilise les plats (nourriture) servis par jour et par produit.';
COMMENT ON VIEW commandes_nourriture_en_attente IS 'Liste les plats à préparer : commandes validées avec articles de catégorie nourriture.';
COMMENT ON FUNCTION get_plats_servis_stats IS 'Retourne les statistiques des plats servis : total, par produit, par jour.';
