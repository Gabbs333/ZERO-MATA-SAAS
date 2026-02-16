-- Migration: Stock Alerts System
-- Description: Creates function and view for stock alerts when quantity <= threshold

-- ============================================================================
-- FUNCTION: check_stock_alerts()
-- ============================================================================
-- Returns products with stock quantity at or below their minimum threshold
-- This function is used to identify products that need restocking

CREATE OR REPLACE FUNCTION check_stock_alerts()
RETURNS TABLE (
  produit_id UUID,
  nom_produit TEXT,
  categorie TEXT,
  quantite_disponible INTEGER,
  seuil_stock_minimum INTEGER,
  difference INTEGER,
  derniere_mise_a_jour TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id AS produit_id,
    p.nom AS nom_produit,
    p.categorie,
    s.quantite_disponible,
    p.seuil_stock_minimum,
    (s.quantite_disponible - p.seuil_stock_minimum) AS difference,
    s.updated_at AS derniere_mise_a_jour
  FROM produits p
  INNER JOIN stock s ON p.id = s.produit_id
  WHERE p.actif = true
    AND s.quantite_disponible <= p.seuil_stock_minimum
  ORDER BY (s.quantite_disponible - p.seuil_stock_minimum) ASC, p.nom ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Add comment to function
COMMENT ON FUNCTION check_stock_alerts() IS 
'Returns all active products where current stock is at or below the minimum threshold. Results are ordered by urgency (lowest stock first).';

-- ============================================================================
-- VIEW: stock_alerts
-- ============================================================================
-- Materialized view for easy querying of stock alerts
-- This view provides a convenient way to check stock alerts without calling the function

CREATE OR REPLACE VIEW stock_alerts AS
SELECT 
  p.id AS produit_id,
  p.nom AS nom_produit,
  p.categorie,
  s.quantite_disponible,
  p.seuil_stock_minimum,
  (s.quantite_disponible - p.seuil_stock_minimum) AS difference,
  s.updated_at AS derniere_mise_a_jour,
  CASE 
    WHEN s.quantite_disponible = 0 THEN 'critique'
    WHEN s.quantite_disponible <= (p.seuil_stock_minimum * 0.5) THEN 'urgent'
    ELSE 'attention'
  END AS niveau_alerte
FROM produits p
INNER JOIN stock s ON p.id = s.produit_id
WHERE p.actif = true
  AND s.quantite_disponible <= p.seuil_stock_minimum
ORDER BY s.quantite_disponible ASC, p.nom ASC;

-- Add comment to view
COMMENT ON VIEW stock_alerts IS 
'View of all active products with stock at or below minimum threshold. Includes alert level (critique/urgent/attention) based on stock severity.';
