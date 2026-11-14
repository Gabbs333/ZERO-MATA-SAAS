-- Migration: Performances du personnel — impayés réellement filtrés par la période
-- Description:
--   `get_performances_personnel` renvoyait les impayés et le nombre d'impayés
--   de CHAQUE serveuse sur l'historique complet (sous-requêtes sans borne de
--   date), alors que le CA affiché à côté était bien borné à la période.
--   D'où l'impression de chiffres « agrégés sur un terme indéfini ».
--
--   Correctif : toutes les mesures sont désormais bornées à la période
--   demandée (factures générées dans la période pour les impayés et les
--   encaissements rattachés ; commandes validées pour le CA).
--
--   Ajouts pour les serveuses : `montant_encaisse`, `taux_encaissement` et
--   `panier_moyen`. Ajout pour le comptoir : `taux_encaissement` (part des
--   factures de la période effectivement encaissée, toutes serveuses
--   confondues) n'a pas de sens ici, on expose donc `nombre_commandes` et
--   `chiffre_affaires` déjà présents.
--
-- Created: 2026-04-50

CREATE OR REPLACE FUNCTION public.get_performances_personnel(
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
    WITH base AS (
      SELECT
        p.id,
        p.nom,
        p.prenom,
        p.role,
        COUNT(DISTINCT c.id) AS nombre_commandes,
        COALESCE(SUM(c.montant_total), 0) AS chiffre_affaires
      FROM profiles p
      LEFT JOIN commandes c ON c.serveuse_id = p.id
        AND c.etablissement_id = v_etablissement_id
        AND c.statut IN ('validee', 'terminee')
        AND COALESCE(c.date_validation, c.date_creation) BETWEEN p_debut AND p_fin
      WHERE p.etablissement_id = v_etablissement_id
        AND p.role = 'serveuse'
        AND p.actif = true
      GROUP BY p.id, p.nom, p.prenom, p.role
    ),
    fact AS (
      SELECT
        cmd.serveuse_id,
        COALESCE(SUM(f.montant_total), 0) AS total_facture,
        COALESCE(SUM(f.montant_paye), 0) AS total_encaisse,
        COALESCE(SUM(f.montant_restant) FILTER (
          WHERE f.statut IN ('en_attente_paiement', 'partiellement_payee')), 0) AS total_impayes,
        COUNT(f.id) FILTER (
          WHERE f.statut IN ('en_attente_paiement', 'partiellement_payee')) AS nombre_impayes
      FROM factures f
      JOIN commandes cmd ON cmd.id = f.commande_id
      WHERE f.etablissement_id = v_etablissement_id
        AND f.date_generation BETWEEN p_debut AND p_fin
      GROUP BY cmd.serveuse_id
    )
    SELECT
      b.id AS utilisateur_id,
      b.nom,
      b.prenom,
      b.role,
      b.nombre_commandes,
      b.chiffre_affaires,
      COALESCE(fa.total_impayes, 0)::BIGINT AS montant_impayes,
      COALESCE(fa.nombre_impayes, 0)::BIGINT AS nombre_impayes,
      COALESCE(fa.total_encaisse, 0)::BIGINT AS montant_encaisse,
      CASE WHEN COALESCE(fa.total_facture, 0) > 0
           THEN ROUND((fa.total_encaisse::NUMERIC / fa.total_facture) * 100, 2)
           ELSE 0 END AS taux_encaissement,
      CASE WHEN b.nombre_commandes > 0
           THEN ROUND(b.chiffre_affaires::NUMERIC / b.nombre_commandes, 2)
           ELSE 0 END AS panier_moyen
    FROM base b
    LEFT JOIN fact fa ON fa.serveuse_id = b.id
    ORDER BY b.chiffre_affaires DESC
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
          AND COALESCE(c.date_validation, c.date_creation) BETWEEN p_debut AND p_fin) AS nombre_commandes,
      (SELECT COALESCE(SUM(c.montant_total), 0)
         FROM commandes c
        WHERE c.serveuse_id = p.id
          AND c.etablissement_id = v_etablissement_id
          AND c.statut IN ('validee', 'terminee')
          AND COALESCE(c.date_validation, c.date_creation) BETWEEN p_debut AND p_fin) AS chiffre_affaires
    FROM profiles p
    WHERE p.etablissement_id = v_etablissement_id
      AND p.role IN ('comptoir', 'gerant', 'patron')
      AND p.actif = true
    ORDER BY total_encaisse DESC
  ) co;

  RETURN json_build_object(
    'periode', json_build_object('debut', p_debut, 'fin', p_fin),
    'serveurs', v_serveurs_json,
    'comptoir', v_comptoir_json
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_performances_personnel(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

COMMENT ON FUNCTION public.get_performances_personnel(TIMESTAMPTZ, TIMESTAMPTZ) IS
  'Performances du personnel bornées à la période : CA, encaissements, impayés (factures de la période), commandes, panier moyen.';

NOTIFY pgrst, 'reload schema';
