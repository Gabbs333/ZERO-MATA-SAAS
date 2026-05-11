-- Migration: Fix get_note_client RPC - return lignes (line items) instead of commandes
-- Description: The RPC was returning command-level data but the UI expects product-level line items.
-- Created: 2026-04-14

CREATE OR REPLACE FUNCTION get_note_client(
  p_client_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'client_id', cl.id,
    'nom', cl.nom,
    'prenom', cl.prenom,
    'date', p_date,
    'nombre_commandes', COUNT(DISTINCT c.id),
    'total_consomme', COALESCE(SUM(c.montant_total), 0),
    'total_paye', COALESCE(SUM(f.montant_paye), 0),
    'solde_restant', COALESCE(SUM(f.montant_restant), 0),
    'lignes', COALESCE((
      SELECT json_agg(json_build_object(
        'commande_id', ci.commande_id,
        'numero_commande', cmd2.numero_commande,
        'produit_id', ci.produit_id,
        'nom_produit', ci.nom_produit,
        'quantite', ci.quantite,
        'prix_unitaire', ci.prix_unitaire,
        'montant_ligne', ci.montant_ligne
      ) ORDER BY cmd2.date_creation, ci.nom_produit)
      FROM commande_items ci
      JOIN commandes cmd2 ON ci.commande_id = cmd2.id
      WHERE cmd2.client_id = cl.id
        AND cmd2.statut = 'validee'
        AND DATE(cmd2.date_creation) = p_date
    ), '[]'::JSON)
  ) INTO v_result
  FROM clients cl
  LEFT JOIN commandes c ON c.client_id = cl.id AND c.statut = 'validee' AND DATE(c.date_creation) = p_date
  LEFT JOIN factures f ON f.commande_id = c.id
  WHERE cl.id = p_client_id
  GROUP BY cl.id, cl.nom, cl.prenom;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_note_client(UUID, DATE) TO authenticated;

COMMENT ON FUNCTION get_note_client(UUID, DATE) IS
  'Retourne la note consolidée d''un client pour une date : total, payé, reste à payer, et lignes de produits.';
