-- Migration: Alertes de stock — liste fiable, cloisonnée, sans rupture silencieuse
-- Description:
--   Remplace check_stock_alerts() qui était inexploitable :
--     * elle retournait `SETOF stocks` alors que le front lit `nom` / `stock_actuel`
--       (colonnes inexistantes) => bannière « undefined est bas (undefined restant) » ;
--     * pas de `SET search_path` (SECURITY DEFINER) ;
--     * aucun tri, aucun marquage rupture ;
--     * un produit actif suivi mais SANS ligne de stock (échec d'initialisation) était
--       invisible alors qu'il est de fait non commandable.
--
--   Nouvelle signature (produit dénormalisé, prêt à afficher) :
--     produit_id, nom, categorie, quantite_actuelle, seuil_alerte, rupture
--
--   `rupture = true` (quantité <= 0) est trié en tête, puis par quantité croissante.
--   Le périmètre est celui de l'utilisateur connecté (patron/gerant/comptoir/serveuse).
--
-- Created: 2026-11-19

-- La signature change (SETOF stocks -> TABLE) : DROP obligatoire.
DROP FUNCTION IF EXISTS public.check_stock_alerts();

CREATE OR REPLACE FUNCTION public.check_stock_alerts()
RETURNS TABLE (
  produit_id UUID,
  nom TEXT,
  categorie TEXT,
  quantite_actuelle INTEGER,
  seuil_alerte INTEGER,
  rupture BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_etablissement_id UUID := public.get_user_etablissement_id();
BEGIN
  IF v_etablissement_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.nom,
    p.categorie,
    COALESCE(s.quantite_actuelle, 0)::INTEGER,
    COALESCE(s.seuil_alerte, 10)::INTEGER,
    (COALESCE(s.quantite_actuelle, 0) <= 0)
  FROM produits p
  LEFT JOIN stocks s
    ON s.produit_id = p.id
   AND s.etablissement_id = p.etablissement_id
  WHERE p.etablissement_id = v_etablissement_id
    AND p.actif = TRUE
    AND COALESCE(p.gestion_stock, TRUE) = TRUE
    AND (s.id IS NULL OR s.quantite_actuelle <= s.seuil_alerte)
  ORDER BY (COALESCE(s.quantite_actuelle, 0) <= 0) DESC,
           COALESCE(s.quantite_actuelle, 0) ASC,
           p.nom ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_stock_alerts() TO authenticated;

COMMENT ON FUNCTION public.check_stock_alerts() IS
  'Produits suivis en stock de l''établissement courant à la limite ou en dessous de leur seuil (ruptures en tête). Alimente la bannière patron et l''alerte serveuse.';

NOTIFY pgrst, 'reload schema';
