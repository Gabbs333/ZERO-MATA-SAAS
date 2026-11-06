-- Migration: Performances du personnel — inclure les commandes prises au comptoir
-- Description: Ajoute nombre_commandes et chiffre_affaires aux statistiques du personnel
-- de comptoir (en plus des encaissements).

CREATE OR REPLACE FUNCTION get_performances_personnel(
  p_debut TIMESTAMPTZ,
  p_fin TIMESTAMPTZ
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_etablissement_id UUID;
  v_serveurs_json JSON;
  v_comptoir_json JSON;
BEGIN
  SELECT etablissement_id INTO v_etablissement_id
  FROM profiles
  WHERE id = auth.uid();

  IF v_etablissement_id IS NULL THEN
    RAISE EXCEPTION 'Établissement non trouvé.';
  END IF;

  -- 1. Serveurs / Serveuses
  SELECT COALESCE(json_agg(row_to_json(s)), '[]'::json) INTO v_serveurs_json
  FROM (
    SELECT
      p.id AS utilisateur_id,
      p.nom,
      p.prenom,
      p.role,
      COUNT(DISTINCT c.id) AS nombre_commandes,
      COALESCE(SUM(c.montant_total), 0) AS chiffre_affaires,
      COALESCE((
        SELECT SUM(f.montant_restant)
        FROM factures f
        JOIN commandes cmd ON cmd.id = f.commande_id
        WHERE cmd.serveuse_id = p.id
          AND f.statut IN ('en_attente_paiement', 'partiellement_payee')
          AND f.etablissement_id = v_etablissement_id
      ), 0) AS montant_impayes,
      COALESCE((
        SELECT COUNT(f.id)
        FROM factures f
        JOIN commandes cmd ON cmd.id = f.commande_id
        WHERE cmd.serveuse_id = p.id
          AND f.statut IN ('en_attente_paiement', 'partiellement_payee')
          AND f.etablissement_id = v_etablissement_id
      ), 0) AS nombre_impayes
    FROM profiles p
    LEFT JOIN commandes c ON c.serveuse_id = p.id
      AND c.etablissement_id = v_etablissement_id
      AND c.statut IN ('validee', 'terminee')
      AND c.date_creation BETWEEN p_debut AND p_fin
    WHERE p.etablissement_id = v_etablissement_id
      AND p.role = 'serveuse'
      AND p.actif = true
    GROUP BY p.id, p.nom, p.prenom, p.role
    ORDER BY chiffre_affaires DESC
  ) s;

  -- 2. Personnel de comptoir (encaissements + commandes prises)
  SELECT COALESCE(json_agg(row_to_json(co)), '[]'::json) INTO v_comptoir_json
  FROM (
    SELECT
      p.id AS utilisateur_id,
      p.nom,
      p.prenom,
      p.role,
      (SELECT COUNT(*)
         FROM encaissements e
        WHERE e.utilisateur_id = p.id
          AND e.etablissement_id = v_etablissement_id
          AND e.date_encaissement BETWEEN p_debut AND p_fin) AS nombre_encaissements,
      (SELECT COALESCE(SUM(e.montant), 0)
         FROM encaissements e
        WHERE e.utilisateur_id = p.id
          AND e.etablissement_id = v_etablissement_id
          AND e.date_encaissement BETWEEN p_debut AND p_fin) AS total_encaisse,
      (SELECT COUNT(*)
         FROM commandes c
        WHERE c.serveuse_id = p.id
          AND c.etablissement_id = v_etablissement_id
          AND c.statut IN ('validee', 'terminee')
          AND c.date_creation BETWEEN p_debut AND p_fin) AS nombre_commandes,
      (SELECT COALESCE(SUM(c.montant_total), 0)
         FROM commandes c
        WHERE c.serveuse_id = p.id
          AND c.etablissement_id = v_etablissement_id
          AND c.statut IN ('validee', 'terminee')
          AND c.date_creation BETWEEN p_debut AND p_fin) AS chiffre_affaires
    FROM profiles p
    WHERE p.etablissement_id = v_etablissement_id
      AND p.role IN ('comptoir', 'gerant', 'patron')
      AND p.actif = true
    ORDER BY total_encaisse DESC
  ) co;

  RETURN json_build_object(
    'serveurs', v_serveurs_json,
    'comptoir', v_comptoir_json
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_performances_personnel(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
