-- Migration: Ajout du suivi des impayés et créances non versées par serveuse
-- Description: Étend get_performances_personnel pour inclure le montant des factures non payées liées aux commandes de chaque serveuse.

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

  -- 1. Performances des Serveurs / Serveuses (avec CA, Commandes et Impayés/Non versé)
  SELECT COALESCE(json_agg(row_to_json(s)), '[]'::json) INTO v_serveurs_json
  FROM (
    SELECT 
      p.id as utilisateur_id,
      p.nom,
      p.prenom,
      p.role,
      COUNT(DISTINCT c.id) as nombre_commandes,
      COALESCE(SUM(c.montant_total), 0) as chiffre_affaires,
      -- Montant total des factures non payées ou partiellement payées liées aux commandes de cette serveuse
      COALESCE(
        (
          SELECT SUM(f.montant_restant)
          FROM factures f
          JOIN commandes cmd ON cmd.id = f.commande_id
          WHERE cmd.serveuse_id = p.id
            AND f.statut IN ('en_attente_paiement', 'partiellement_payee')
            AND f.etablissement_id = v_etablissement_id
        ), 
        0
      ) as montant_impayes,
      COALESCE(
        (
          SELECT COUNT(f.id)
          FROM factures f
          JOIN commandes cmd ON cmd.id = f.commande_id
          WHERE cmd.serveuse_id = p.id
            AND f.statut IN ('en_attente_paiement', 'partiellement_payee')
            AND f.etablissement_id = v_etablissement_id
        ), 
        0
      ) as nombre_impayes
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

  -- 2. Performances du Personnel de Comptoir / Caisse
  SELECT COALESCE(json_agg(row_to_json(co)), '[]'::json) INTO v_comptoir_json
  FROM (
    SELECT 
      p.id as utilisateur_id,
      p.nom,
      p.prenom,
      p.role,
      COUNT(e.id) as nombre_encaissements,
      COALESCE(SUM(e.montant), 0) as total_encaisse
    FROM profiles p
    LEFT JOIN encaissements e ON e.utilisateur_id = p.id
      AND e.etablissement_id = v_etablissement_id
      AND e.date_encaissement BETWEEN p_debut AND p_fin
    WHERE p.etablissement_id = v_etablissement_id
      AND p.role IN ('comptoir', 'gerant', 'patron')
      AND p.actif = true
    GROUP BY p.id, p.nom, p.prenom, p.role
    ORDER BY total_encaisse DESC
  ) co;

  RETURN json_build_object(
    'serveurs', v_serveurs_json,
    'comptoir', v_comptoir_json
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_performances_personnel(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
