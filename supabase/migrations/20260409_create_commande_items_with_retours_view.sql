-- Migration: Create view for commande_items with return status
-- Description: Creates a view that shows commande_items with their return status for visual indicators
-- Created: 2026-04-09

-- ============================================================================
-- VIEW: commande_items_with_retours
-- ============================================================================

-- Drop view if exists (for development)
DROP VIEW IF EXISTS commande_items_with_retours;

CREATE VIEW commande_items_with_retours AS
WITH retour_items_summary AS (
  SELECT 
    ri.commande_item_id,
    SUM(ri.quantite_retournee) as quantite_retournee_totale
  FROM retour_items ri
  GROUP BY ri.commande_item_id
),
pending_retour_items_summary AS (
  SELECT 
    rie.commande_item_id,
    SUM(rie.quantite_retournee) as quantite_en_attente_totale
  FROM retour_items_en_attente rie
  GROUP BY rie.commande_item_id
)
SELECT 
  ci.*,
  COALESCE(ri.quantite_retournee_totale, 0) as quantite_retournee,
  COALESCE(pri.quantite_en_attente_totale, 0) as quantite_en_attente,
  -- Calculated fields for visual indicators
  CASE 
    WHEN ci.quantite = COALESCE(ri.quantite_retournee_totale, 0) THEN 'total'
    WHEN COALESCE(ri.quantite_retournee_totale, 0) > 0 THEN 'partiel'
    WHEN COALESCE(pri.quantite_en_attente_totale, 0) > 0 THEN 'en_attente'
    ELSE 'aucun'
  END as statut_retour,
  -- Boolean flags for easier frontend logic
  (ci.quantite = COALESCE(ri.quantite_retournee_totale, 0)) as est_total_retour,
  (COALESCE(ri.quantite_retournee_totale, 0) > 0) as est_partiel_retour,
  (COALESCE(pri.quantite_en_attente_totale, 0) > 0) as est_en_attente_retour,
  (COALESCE(ri.quantite_retournee_totale, 0) + COALESCE(pri.quantite_en_attente_totale, 0)) as quantite_totale_retournee
FROM commande_items ci
LEFT JOIN retour_items_summary ri ON ci.id = ri.commande_item_id
LEFT JOIN pending_retour_items_summary pri ON ci.id = pri.commande_item_id;

-- Add RLS policy for the view
ALTER VIEW commande_items_with_retours OWNER TO supabase_admin;

-- Create policy for authenticated users (read only)
CREATE POLICY "Allow authenticated read" ON commande_items_with_retours
FOR SELECT TO authenticated
USING (true);

-- Grant permissions
GRANT SELECT ON commande_items_with_retours TO authenticated;

-- Comment
COMMENT ON VIEW commande_items_with_retours IS 'Vue affichant les articles de commande avec leur statut de retour pour affichage visuel';