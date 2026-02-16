-- Migration: Analytics Views and Functions
-- Description: Creates views and functions for analytics and reporting
-- Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 8.5

-- ============================================================================
-- ANALYTICS VIEWS
-- ============================================================================

-- Vue: analytics_kpis
-- Description: KPIs principaux (CA, bénéfice, nombre commandes, panier moyen)
-- Calcule les indicateurs clés de performance pour une période donnée
CREATE OR REPLACE VIEW analytics_kpis AS
SELECT
  -- Chiffre d'affaires (somme des commandes validées)
  COALESCE(SUM(CASE WHEN c.statut = 'validee' THEN c.montant_total ELSE 0 END), 0) AS chiffre_affaires,
  
  -- Bénéfice (CA - coûts d'achat)
  COALESCE(SUM(CASE WHEN c.statut = 'validee' THEN c.montant_total ELSE 0 END), 0) - 
  COALESCE(SUM(
    CASE 
      WHEN c.statut = 'validee' THEN (
        SELECT COALESCE(SUM(ci.quantite * COALESCE(ms.cout_unitaire, 0)), 0)
        FROM commande_items ci
        LEFT JOIN LATERAL (
          SELECT cout_unitaire
          FROM mouvements_stock
          WHERE produit_id = ci.produit_id
            AND type = 'entree'
            AND cout_unitaire IS NOT NULL
          ORDER BY date_creation DESC
          LIMIT 1
        ) ms ON true
        WHERE ci.commande_id = c.id
      )
      ELSE 0
    END
  ), 0) AS benefice,
  
  -- Nombre de commandes validées
  COUNT(CASE WHEN c.statut = 'validee' THEN 1 END) AS nombre_commandes,
  
  -- Panier moyen (CA / nombre de commandes)
  CASE 
    WHEN COUNT(CASE WHEN c.statut = 'validee' THEN 1 END) > 0 
    THEN COALESCE(SUM(CASE WHEN c.statut = 'validee' THEN c.montant_total ELSE 0 END), 0) / 
         COUNT(CASE WHEN c.statut = 'validee' THEN 1 END)
    ELSE 0
  END AS panier_moyen,
  
  -- Nombre total de produits vendus
  COALESCE(SUM(
    CASE 
      WHEN c.statut = 'validee' THEN (
        SELECT COALESCE(SUM(quantite), 0)
        FROM commande_items
        WHERE commande_id = c.id
      )
      ELSE 0
    END
  ), 0) AS produits_vendus
FROM commandes c;

-- Vue: analytics_ventes_produits
-- Description: Agrégation des ventes par produit
-- Affiche les statistiques de vente pour chaque produit
CREATE OR REPLACE VIEW analytics_ventes_produits AS
SELECT
  p.id AS produit_id,
  p.nom AS produit_nom,
  p.categorie,
  COALESCE(SUM(ci.quantite), 0) AS quantite_vendue,
  COALESCE(SUM(ci.montant_ligne), 0) AS revenu_total,
  COUNT(DISTINCT c.id) AS nombre_commandes,
  CASE 
    WHEN SUM(ci.quantite) > 0 
    THEN SUM(ci.montant_ligne) / SUM(ci.quantite)
    ELSE 0
  END AS prix_moyen
FROM produits p
LEFT JOIN commande_items ci ON ci.produit_id = p.id
LEFT JOIN commandes c ON c.id = ci.commande_id AND c.statut = 'validee'
GROUP BY p.id, p.nom, p.categorie;

-- Vue: analytics_evolution_ca
-- Description: Évolution temporelle du CA par jour
-- Permet de visualiser l'évolution du chiffre d'affaires dans le temps
CREATE OR REPLACE VIEW analytics_evolution_ca AS
SELECT
  DATE(c.date_validation) AS date,
  COALESCE(SUM(c.montant_total), 0) AS chiffre_affaires,
  COUNT(*) AS nombre_commandes,
  CASE 
    WHEN COUNT(*) > 0 
    THEN COALESCE(SUM(c.montant_total), 0) / COUNT(*)
    ELSE 0
  END AS panier_moyen
FROM commandes c
WHERE c.statut = 'validee'
  AND c.date_validation IS NOT NULL
GROUP BY DATE(c.date_validation)
ORDER BY DATE(c.date_validation) DESC;

-- ============================================================================
-- ANALYTICS FUNCTIONS
-- ============================================================================

-- Fonction: get_analytics
-- Description: Retourne toutes les analytics pour une période donnée avec granularité
-- Parameters:
--   - p_debut: Date de début de la période
--   - p_fin: Date de fin de la période
--   - p_granularite: 'heure', 'jour', 'semaine', 'mois'
-- Returns: JSON avec tous les KPIs et statistiques
CREATE OR REPLACE FUNCTION get_analytics(
  p_debut TIMESTAMPTZ,
  p_fin TIMESTAMPTZ,
  p_granularite TEXT DEFAULT 'jour'
)
RETURNS JSON AS $
DECLARE
  v_result JSON;
  v_kpis JSON;
  v_ventes_produits JSON;
  v_evolution JSON;
BEGIN
  -- Valider la granularité
  IF p_granularite NOT IN ('heure', 'jour', 'semaine', 'mois') THEN
    RAISE EXCEPTION 'Granularité invalide. Valeurs acceptées: heure, jour, semaine, mois';
  END IF;

  -- Calculer les KPIs pour la période
  SELECT json_build_object(
    'chiffre_affaires', COALESCE(SUM(CASE WHEN c.statut = 'validee' THEN c.montant_total ELSE 0 END), 0),
    'benefice', COALESCE(SUM(CASE WHEN c.statut = 'validee' THEN c.montant_total ELSE 0 END), 0) - 
      COALESCE(SUM(
        CASE 
          WHEN c.statut = 'validee' THEN (
            SELECT COALESCE(SUM(ci.quantite * COALESCE(ms.cout_unitaire, 0)), 0)
            FROM commande_items ci
            LEFT JOIN LATERAL (
              SELECT cout_unitaire
              FROM mouvements_stock
              WHERE produit_id = ci.produit_id
                AND type = 'entree'
                AND cout_unitaire IS NOT NULL
              ORDER BY date_creation DESC
              LIMIT 1
            ) ms ON true
            WHERE ci.commande_id = c.id
          )
          ELSE 0
        END
      ), 0),
    'nombre_commandes', COUNT(CASE WHEN c.statut = 'validee' THEN 1 END),
    'panier_moyen', CASE 
      WHEN COUNT(CASE WHEN c.statut = 'validee' THEN 1 END) > 0 
      THEN COALESCE(SUM(CASE WHEN c.statut = 'validee' THEN c.montant_total ELSE 0 END), 0) / 
           COUNT(CASE WHEN c.statut = 'validee' THEN 1 END)
      ELSE 0
    END,
    'produits_vendus', COALESCE(SUM(
      CASE 
        WHEN c.statut = 'validee' THEN (
          SELECT COALESCE(SUM(quantite), 0)
          FROM commande_items
          WHERE commande_id = c.id
        )
        ELSE 0
      END
    ), 0)
  )
  INTO v_kpis
  FROM commandes c
  WHERE (c.date_validation >= p_debut AND c.date_validation <= p_fin)
    OR (c.date_validation IS NULL AND c.created_at >= p_debut AND c.created_at <= p_fin);

  -- Calculer les ventes par produit pour la période
  SELECT json_agg(ventes)
  INTO v_ventes_produits
  FROM (
    SELECT json_build_object(
      'produit_id', p.id,
      'produit_nom', p.nom,
      'categorie', p.categorie,
      'quantite_vendue', COALESCE(SUM(ci.quantite), 0),
      'revenu_total', COALESCE(SUM(ci.montant_ligne), 0),
      'nombre_commandes', COUNT(DISTINCT c.id),
      'prix_moyen', CASE 
        WHEN SUM(ci.quantite) > 0 
        THEN SUM(ci.montant_ligne) / SUM(ci.quantite)
        ELSE 0
      END
    ) AS ventes
    FROM produits p
    LEFT JOIN commande_items ci ON ci.produit_id = p.id
    LEFT JOIN commandes c ON c.id = ci.commande_id 
      AND c.statut = 'validee'
      AND c.date_validation >= p_debut
      AND c.date_validation <= p_fin
    GROUP BY p.id, p.nom, p.categorie
  ) AS ventes_data;

  -- Calculer l'évolution selon la granularité
  IF p_granularite = 'heure' THEN
    SELECT json_agg(evolution ORDER BY periode)
    INTO v_evolution
    FROM (
      SELECT 
        DATE_TRUNC('hour', c.date_validation) AS periode,
        json_build_object(
          'periode', DATE_TRUNC('hour', c.date_validation),
          'chiffre_affaires', COALESCE(SUM(c.montant_total), 0),
          'nombre_commandes', COUNT(*),
          'panier_moyen', CASE 
            WHEN COUNT(*) > 0 
            THEN COALESCE(SUM(c.montant_total), 0) / COUNT(*)
            ELSE 0
          END
        ) AS evolution
      FROM commandes c
      WHERE c.statut = 'validee'
        AND c.date_validation >= p_debut
        AND c.date_validation <= p_fin
      GROUP BY DATE_TRUNC('hour', c.date_validation)
    ) AS evolution_data;
  ELSIF p_granularite = 'jour' THEN
    SELECT json_agg(evolution ORDER BY periode)
    INTO v_evolution
    FROM (
      SELECT 
        DATE(c.date_validation) AS periode,
        json_build_object(
          'periode', DATE(c.date_validation),
          'chiffre_affaires', COALESCE(SUM(c.montant_total), 0),
          'nombre_commandes', COUNT(*),
          'panier_moyen', CASE 
            WHEN COUNT(*) > 0 
            THEN COALESCE(SUM(c.montant_total), 0) / COUNT(*)
            ELSE 0
          END
        ) AS evolution
      FROM commandes c
      WHERE c.statut = 'validee'
        AND c.date_validation >= p_debut
        AND c.date_validation <= p_fin
      GROUP BY DATE(c.date_validation)
    ) AS evolution_data;
  ELSIF p_granularite = 'semaine' THEN
    SELECT json_agg(evolution ORDER BY periode)
    INTO v_evolution
    FROM (
      SELECT 
        DATE_TRUNC('week', c.date_validation) AS periode,
        json_build_object(
          'periode', DATE_TRUNC('week', c.date_validation),
          'chiffre_affaires', COALESCE(SUM(c.montant_total), 0),
          'nombre_commandes', COUNT(*),
          'panier_moyen', CASE 
            WHEN COUNT(*) > 0 
            THEN COALESCE(SUM(c.montant_total), 0) / COUNT(*)
            ELSE 0
          END
        ) AS evolution
      FROM commandes c
      WHERE c.statut = 'validee'
        AND c.date_validation >= p_debut
        AND c.date_validation <= p_fin
      GROUP BY DATE_TRUNC('week', c.date_validation)
    ) AS evolution_data;
  ELSE -- mois
    SELECT json_agg(evolution ORDER BY periode)
    INTO v_evolution
    FROM (
      SELECT 
        DATE_TRUNC('month', c.date_validation) AS periode,
        json_build_object(
          'periode', DATE_TRUNC('month', c.date_validation),
          'chiffre_affaires', COALESCE(SUM(c.montant_total), 0),
          'nombre_commandes', COUNT(*),
          'panier_moyen', CASE 
            WHEN COUNT(*) > 0 
            THEN COALESCE(SUM(c.montant_total), 0) / COUNT(*)
            ELSE 0
          END
        ) AS evolution
      FROM commandes c
      WHERE c.statut = 'validee'
        AND c.date_validation >= p_debut
        AND c.date_validation <= p_fin
      GROUP BY DATE_TRUNC('month', c.date_validation)
    ) AS evolution_data;
  END IF;

  -- Construire le résultat final
  v_result := json_build_object(
    'periode', json_build_object(
      'debut', p_debut,
      'fin', p_fin,
      'granularite', p_granularite
    ),
    'kpis', v_kpis,
    'ventes_produits', COALESCE(v_ventes_produits, '[]'::json),
    'evolution', COALESCE(v_evolution, '[]'::json)
  );

  RETURN v_result;
END;
$ LANGUAGE plpgsql;

-- ============================================================================
-- TRANSACTION SEARCH FUNCTION
-- ============================================================================

-- Fonction: search_transactions
-- Description: Recherche de transactions avec filtres multiples et pagination
-- Parameters:
--   - p_date_debut: Date de début (optionnel)
--   - p_date_fin: Date de fin (optionnel)
--   - p_serveuse_id: ID de la serveuse (optionnel)
--   - p_table_id: ID de la table (optionnel)
--   - p_produit_id: ID du produit (optionnel)
--   - p_page: Numéro de page (défaut: 1)
--   - p_limit: Nombre de résultats par page (défaut: 50)
-- Returns: JSON avec les transactions et métadonnées de pagination
CREATE OR REPLACE FUNCTION search_transactions(
  p_date_debut TIMESTAMPTZ DEFAULT NULL,
  p_date_fin TIMESTAMPTZ DEFAULT NULL,
  p_serveuse_id UUID DEFAULT NULL,
  p_table_id UUID DEFAULT NULL,
  p_produit_id UUID DEFAULT NULL,
  p_page INTEGER DEFAULT 1,
  p_limit INTEGER DEFAULT 50
)
RETURNS JSON AS $
DECLARE
  v_offset INTEGER;
  v_total INTEGER;
  v_transactions JSON;
  v_result JSON;
BEGIN
  -- Valider les paramètres
  IF p_page < 1 THEN
    RAISE EXCEPTION 'Le numéro de page doit être >= 1';
  END IF;
  
  IF p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION 'La limite doit être entre 1 et 100';
  END IF;

  -- Calculer l'offset
  v_offset := (p_page - 1) * p_limit;

  -- Compter le nombre total de résultats
  SELECT COUNT(DISTINCT c.id)
  INTO v_total
  FROM commandes c
  LEFT JOIN commande_items ci ON ci.commande_id = c.id
  WHERE c.statut = 'validee'
    AND (p_date_debut IS NULL OR c.date_validation >= p_date_debut)
    AND (p_date_fin IS NULL OR c.date_validation <= p_date_fin)
    AND (p_serveuse_id IS NULL OR c.serveuse_id = p_serveuse_id)
    AND (p_table_id IS NULL OR c.table_id = p_table_id)
    AND (p_produit_id IS NULL OR ci.produit_id = p_produit_id);

  -- Récupérer les transactions avec pagination
  SELECT json_agg(transaction_data)
  INTO v_transactions
  FROM (
    SELECT json_build_object(
      'id', c.id,
      'numero_commande', c.numero_commande,
      'table', json_build_object(
        'id', t.id,
        'numero', t.numero
      ),
      'serveuse', json_build_object(
        'id', s.id,
        'nom', s.nom,
        'prenom', s.prenom
      ),
      'validateur', json_build_object(
        'id', v.id,
        'nom', v.nom,
        'prenom', v.prenom
      ),
      'montant_total', c.montant_total,
      'created_at', c.created_at,
      'date_validation', c.date_validation,
      'items', (
        SELECT json_agg(json_build_object(
          'produit_id', ci.produit_id,
          'nom_produit', ci.nom_produit,
          'quantite', ci.quantite,
          'prix_unitaire', ci.prix_unitaire,
          'montant_ligne', ci.montant_ligne
        ))
        FROM commande_items ci
        WHERE ci.commande_id = c.id
      ),
      'facture', (
        SELECT json_build_object(
          'id', f.id,
          'numero_facture', f.numero_facture,
          'statut', f.statut,
          'montant_paye', f.montant_paye,
          'montant_restant', f.montant_restant
        )
        FROM factures f
        WHERE f.commande_id = c.id
      )
    ) AS transaction_data
    FROM commandes c
    INNER JOIN tables t ON t.id = c.table_id
    INNER JOIN profiles s ON s.id = c.serveuse_id
    LEFT JOIN profiles v ON v.id = c.validateur_id
    LEFT JOIN commande_items ci ON ci.commande_id = c.id
    WHERE c.statut = 'validee'
      AND (p_date_debut IS NULL OR c.date_validation >= p_date_debut)
      AND (p_date_fin IS NULL OR c.date_validation <= p_date_fin)
      AND (p_serveuse_id IS NULL OR c.serveuse_id = p_serveuse_id)
      AND (p_table_id IS NULL OR c.table_id = p_table_id)
      AND (p_produit_id IS NULL OR ci.produit_id = p_produit_id)
    GROUP BY c.id, t.id, t.numero, s.id, s.nom, s.prenom, v.id, v.nom, v.prenom
    ORDER BY c.date_validation DESC
    LIMIT p_limit
    OFFSET v_offset
  ) AS transactions;

  -- Construire le résultat avec métadonnées de pagination
  v_result := json_build_object(
    'transactions', COALESCE(v_transactions, '[]'::json),
    'pagination', json_build_object(
      'page', p_page,
      'limit', p_limit,
      'total', v_total,
      'total_pages', CEIL(v_total::NUMERIC / p_limit)
    ),
    'filters', json_build_object(
      'date_debut', p_date_debut,
      'date_fin', p_date_fin,
      'serveuse_id', p_serveuse_id,
      'table_id', p_table_id,
      'produit_id', p_produit_id
    )
  );

  RETURN v_result;
END;
$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON VIEW analytics_kpis IS 'Vue des KPIs principaux: CA, bénéfice, nombre commandes, panier moyen';
COMMENT ON VIEW analytics_ventes_produits IS 'Vue des ventes agrégées par produit';
COMMENT ON VIEW analytics_evolution_ca IS 'Vue de l''évolution temporelle du CA par jour';
COMMENT ON FUNCTION get_analytics IS 'Fonction pour récupérer toutes les analytics pour une période avec granularité configurable';
COMMENT ON FUNCTION search_transactions IS 'Fonction de recherche de transactions avec filtres multiples et pagination';
