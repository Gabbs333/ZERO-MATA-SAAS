-- Fix RPC functions and parameter mismatches for Frontend Compatibility

-- 1. get_kpis (used by FinancialDashboardScreen)
-- Expects: debut, fin
-- Returns: json {chiffre_affaires, encaissements, creances}
DROP FUNCTION IF EXISTS get_kpis(timestamp with time zone, timestamp with time zone);

CREATE OR REPLACE FUNCTION get_kpis(debut timestamp with time zone, fin timestamp with time zone)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_etablissement_id UUID;
  v_ca NUMERIC;
  v_encaissements NUMERIC;
  v_creances NUMERIC;
BEGIN
  -- Get etablissement_id from auth.uid()
  SELECT etablissement_id INTO v_etablissement_id
  FROM profiles
  WHERE id = auth.uid();

  -- Calculate CA (Valid orders)
  SELECT COALESCE(SUM(montant_total), 0) INTO v_ca
  FROM commandes
  WHERE etablissement_id = v_etablissement_id
  AND statut = 'validee'
  AND date_creation BETWEEN debut AND fin;

  -- Calculate Encaissements (Paid invoices)
  SELECT COALESCE(SUM(montant_paye), 0) INTO v_encaissements
  FROM factures
  WHERE etablissement_id = v_etablissement_id
  AND date_generation BETWEEN debut AND fin;

  -- Calculate Creances (Remaining on invoices)
  SELECT COALESCE(SUM(montant_restant), 0) INTO v_creances
  FROM factures
  WHERE etablissement_id = v_etablissement_id
  AND date_generation BETWEEN debut AND fin;

  RETURN json_build_object(
    'chiffre_affaires', v_ca,
    'encaissements', v_encaissements,
    'creances', v_creances
  );
END;
$$;

-- 2. get_dashboard_kpis (used by DashboardScreen)
-- Expects: p_debut, p_fin
-- Returns: json {ca_total, encaissements_total, creances, benefice, nombre_commandes, panier_moyen}
DROP FUNCTION IF EXISTS get_dashboard_kpis(timestamp with time zone, timestamp with time zone);

CREATE OR REPLACE FUNCTION get_dashboard_kpis(p_debut timestamp with time zone, p_fin timestamp with time zone)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_etablissement_id UUID;
  v_ca NUMERIC;
  v_encaissements NUMERIC;
  v_creances NUMERIC;
  v_benefice NUMERIC;
  v_nombre_commandes BIGINT;
  v_panier_moyen NUMERIC;
BEGIN
  SELECT etablissement_id INTO v_etablissement_id
  FROM profiles
  WHERE id = auth.uid();

  -- CA and Count
  SELECT COALESCE(SUM(montant_total), 0), COUNT(*)
  INTO v_ca, v_nombre_commandes
  FROM commandes
  WHERE etablissement_id = v_etablissement_id
  AND statut = 'validee'
  AND date_creation BETWEEN p_debut AND p_fin;

  -- Encaissements and Creances
  SELECT COALESCE(SUM(montant_paye), 0), COALESCE(SUM(montant_restant), 0)
  INTO v_encaissements, v_creances
  FROM factures
  WHERE etablissement_id = v_etablissement_id
  AND date_generation BETWEEN p_debut AND p_fin;

  -- Panier moyen
  IF v_nombre_commandes > 0 THEN
    v_panier_moyen := v_ca / v_nombre_commandes;
  ELSE
    v_panier_moyen := 0;
  END IF;

  -- Benefice (Simplified: CA - Ravitaillements)
  -- This is an estimation. Real profit requires cost of goods sold (COGS).
  -- For now, let's subtract total ravitaillements in the period.
  SELECT v_ca - COALESCE(SUM(montant_total), 0)
  INTO v_benefice
  FROM ravitaillements
  WHERE etablissement_id = v_etablissement_id
  AND date_ravitaillement BETWEEN p_debut AND p_fin;

  IF v_benefice IS NULL THEN
    v_benefice := v_ca;
  END IF;

  RETURN json_build_object(
    'ca_total', v_ca,
    'encaissements_total', v_encaissements,
    'creances', v_creances,
    'benefice', v_benefice,
    'nombre_commandes', v_nombre_commandes,
    'panier_moyen', ROUND(v_panier_moyen, 2)
  );
END;
$$;

-- 3. get_analytics (used by DashboardScreen and FinancialDashboardScreen)
-- Expects: p_debut, p_fin, p_granularite (optional)
-- Returns: TABLE(periode text, ca numeric, encaissements numeric)
DROP FUNCTION IF EXISTS get_analytics(timestamp with time zone, timestamp with time zone, text);

CREATE OR REPLACE FUNCTION get_analytics(p_debut timestamp with time zone, p_fin timestamp with time zone, p_granularite text DEFAULT 'jour')
RETURNS TABLE (periode text, ca numeric, encaissements numeric)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_etablissement_id UUID;
  v_trunc_format text;
BEGIN
  SELECT etablissement_id INTO v_etablissement_id
  FROM profiles
  WHERE id = auth.uid();

  -- Determine date truncation format based on granularity
  IF p_granularite = 'mois' THEN
    v_trunc_format := 'YYYY-MM-01';
  ELSE
    v_trunc_format := 'YYYY-MM-DD';
  END IF;

  RETURN QUERY
  WITH dates AS (
    SELECT generate_series(p_debut, p_fin, ('1 ' || p_granularite)::interval) AS d
  ),
  daily_ca AS (
    SELECT 
      date_trunc(p_granularite, date_creation) as day, 
      SUM(montant_total) as total
    FROM commandes
    WHERE etablissement_id = v_etablissement_id
    AND statut = 'validee'
    AND date_creation BETWEEN p_debut AND p_fin
    GROUP BY 1
  ),
  daily_enc AS (
    SELECT 
      date_trunc(p_granularite, date_generation) as day, 
      SUM(montant_paye) as total
    FROM factures
    WHERE etablissement_id = v_etablissement_id
    AND date_generation BETWEEN p_debut AND p_fin
    GROUP BY 1
  )
  SELECT 
    to_char(dates.d, 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    COALESCE(daily_ca.total, 0),
    COALESCE(daily_enc.total, 0)
  FROM dates
  LEFT JOIN daily_ca ON date_trunc(p_granularite, dates.d) = daily_ca.day
  LEFT JOIN daily_enc ON date_trunc(p_granularite, dates.d) = daily_enc.day
  ORDER BY dates.d;
END;
$$;

-- 4. get_analytics_ca_encaissements (used by DashboardScreen)
-- Expects: p_debut, p_fin
-- Returns: TABLE(date text, ca numeric, encaissements numeric)
DROP FUNCTION IF EXISTS get_analytics_ca_encaissements(timestamp with time zone, timestamp with time zone);

CREATE OR REPLACE FUNCTION get_analytics_ca_encaissements(p_debut timestamp with time zone, p_fin timestamp with time zone)
RETURNS TABLE (date text, ca numeric, encaissements numeric)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Reuse get_analytics logic with daily granularity
  RETURN QUERY SELECT * FROM get_analytics(p_debut, p_fin, 'day');
END;
$$;

-- 5. get_payment_modes_stats (used by DashboardScreen)
-- Expects: p_debut, p_fin
-- Returns: TABLE(mode_paiement text, total numeric, count bigint)
DROP FUNCTION IF EXISTS get_payment_modes_stats(timestamp with time zone, timestamp with time zone);

CREATE OR REPLACE FUNCTION get_payment_modes_stats(p_debut timestamp with time zone, p_fin timestamp with time zone)
RETURNS TABLE (mode_paiement text, total numeric, count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_etablissement_id UUID;
BEGIN
  SELECT etablissement_id INTO v_etablissement_id
  FROM profiles
  WHERE id = auth.uid();

  RETURN QUERY
  SELECT 
    f.mode_paiement::text,
    SUM(f.montant_paye) as total,
    COUNT(*) as count
  FROM factures f
  WHERE f.etablissement_id = v_etablissement_id
  AND f.date_generation BETWEEN p_debut AND p_fin
  AND f.mode_paiement IS NOT NULL
  GROUP BY f.mode_paiement;
END;
$$;

-- 6. check_stock_alerts (used by StockScreen and DashboardScreen)
-- Returns: SETOF stocks
DROP FUNCTION IF EXISTS check_stock_alerts();

CREATE OR REPLACE FUNCTION check_stock_alerts()
RETURNS SETOF stocks
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_etablissement_id UUID;
BEGIN
  SELECT etablissement_id INTO v_etablissement_id
  FROM profiles
  WHERE id = auth.uid();

  RETURN QUERY
  SELECT *
  FROM stocks
  WHERE etablissement_id = v_etablissement_id
  AND quantite_actuelle <= seuil_alerte;
END;
$$;
