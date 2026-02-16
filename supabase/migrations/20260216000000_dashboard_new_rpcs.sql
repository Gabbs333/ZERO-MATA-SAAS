-- Function to get Dashboard KPIs
CREATE OR REPLACE FUNCTION get_dashboard_stats(
  p_etablissement_id UUID,
  p_date_start TIMESTAMPTZ,
  p_date_end TIMESTAMPTZ
)
RETURNS TABLE (
  chiffre_affaires NUMERIC,
  encaissements NUMERIC,
  commandes_count INTEGER,
  panier_moyen NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_etab UUID;
  v_user_role TEXT;
BEGIN
  -- Security check
  SELECT etablissement_id, role INTO v_user_etab, v_user_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_user_role != 'admin' AND v_user_etab != p_etablissement_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  WITH kpi_calc AS (
    SELECT
      COALESCE(SUM(c.montant_total) FILTER (WHERE c.statut NOT IN ('annulee', 'en_attente')), 0) as ca,
      COUNT(c.id) FILTER (WHERE c.statut NOT IN ('annulee', 'en_attente')) as count_cmd
    FROM public.commandes c
    WHERE c.etablissement_id = p_etablissement_id
      AND c.date_creation BETWEEN p_date_start AND p_date_end
  ),
  enc_calc AS (
    SELECT
      COALESCE(SUM(e.montant), 0) as enc
    FROM public.encaissements e
    WHERE e.etablissement_id = p_etablissement_id
      AND e.date_encaissement BETWEEN p_date_start AND p_date_end
  )
  SELECT
    k.ca,
    e.enc,
    k.count_cmd::INTEGER,
    CASE WHEN k.count_cmd > 0 THEN k.ca / k.count_cmd ELSE 0 END
  FROM kpi_calc k, enc_calc e;
END;
$$;

-- Function to get Dashboard Chart Data (Sales Evolution)
CREATE OR REPLACE FUNCTION get_sales_evolution(
  p_etablissement_id UUID,
  p_date_start TIMESTAMPTZ,
  p_date_end TIMESTAMPTZ,
  p_interval TEXT DEFAULT 'day' -- 'day' or 'hour'
)
RETURNS TABLE (
  date_bucket TEXT,
  ca NUMERIC,
  encaissements NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_etab UUID;
  v_user_role TEXT;
  v_trunc_format TEXT;
BEGIN
  -- Security check
  SELECT etablissement_id, role INTO v_user_etab, v_user_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_user_role != 'admin' AND v_user_etab != p_etablissement_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  v_trunc_format := CASE WHEN p_interval = 'hour' THEN 'YYYY-MM-DD"T"HH24:00:00' ELSE 'YYYY-MM-DD"T"00:00:00' END;

  RETURN QUERY
  WITH time_series AS (
    SELECT to_char(generate_series(p_date_start, p_date_end, ('1 ' || p_interval)::interval), v_trunc_format) as t_date
  ),
  sales_data AS (
    SELECT
      to_char(date_trunc(p_interval, date_creation), v_trunc_format) as s_date,
      SUM(montant_total) as s_amount
    FROM public.commandes
    WHERE etablissement_id = p_etablissement_id
      AND statut NOT IN ('annulee', 'en_attente')
      AND date_creation BETWEEN p_date_start AND p_date_end
    GROUP BY 1
  ),
  payment_data AS (
    SELECT
      to_char(date_trunc(p_interval, date_encaissement), v_trunc_format) as p_date,
      SUM(montant) as p_amount
    FROM public.encaissements
    WHERE etablissement_id = p_etablissement_id
      AND date_encaissement BETWEEN p_date_start AND p_date_end
    GROUP BY 1
  )
  SELECT
    ts.t_date,
    COALESCE(sd.s_amount, 0),
    COALESCE(pd.p_amount, 0)
  FROM time_series ts
  LEFT JOIN sales_data sd ON ts.t_date = sd.s_date
  LEFT JOIN payment_data pd ON ts.t_date = pd.p_date
  ORDER BY ts.t_date;
END;
$$;

-- Function to get Top Products
CREATE OR REPLACE FUNCTION get_top_products(
  p_etablissement_id UUID,
  p_date_start TIMESTAMPTZ,
  p_date_end TIMESTAMPTZ,
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  nom_produit TEXT,
  quantite NUMERIC,
  ca NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_etab UUID;
  v_user_role TEXT;
BEGIN
  -- Security check
  SELECT etablissement_id, role INTO v_user_etab, v_user_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_user_role != 'admin' AND v_user_etab != p_etablissement_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(ci.nom_produit, p.nom) as prod_name,
    SUM(ci.quantite) as total_qty,
    SUM(ci.quantite * ci.prix_unitaire) as total_ca
  FROM public.commande_items ci
  JOIN public.commandes c ON c.id = ci.commande_id
  LEFT JOIN public.produits p ON p.id = ci.produit_id
  WHERE c.etablissement_id = p_etablissement_id
    AND c.statut NOT IN ('annulee', 'en_attente')
    AND c.date_creation BETWEEN p_date_start AND p_date_end
  GROUP BY 1
  ORDER BY total_qty DESC
  LIMIT p_limit;
END;
$$;

-- Function to get Payment Modes
CREATE OR REPLACE FUNCTION get_payment_distribution(
  p_etablissement_id UUID,
  p_date_start TIMESTAMPTZ,
  p_date_end TIMESTAMPTZ
)
RETURNS TABLE (
  mode_paiement TEXT,
  montant NUMERIC,
  percentage NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_etab UUID;
  v_user_role TEXT;
  v_total NUMERIC;
BEGIN
  -- Security check
  SELECT etablissement_id, role INTO v_user_etab, v_user_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_user_role != 'admin' AND v_user_etab != p_etablissement_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Calculate total for percentage
  SELECT COALESCE(SUM(montant), 0) INTO v_total
  FROM public.encaissements
  WHERE etablissement_id = p_etablissement_id
    AND date_encaissement BETWEEN p_date_start AND p_date_end;

  RETURN QUERY
  SELECT
    e.mode_paiement::TEXT,
    SUM(e.montant) as total_amount,
    CASE WHEN v_total > 0 THEN (SUM(e.montant) / v_total) * 100 ELSE 0 END as pct
  FROM public.encaissements e
  WHERE e.etablissement_id = p_etablissement_id
    AND e.date_encaissement BETWEEN p_date_start AND p_date_end
  GROUP BY e.mode_paiement
  ORDER BY total_amount DESC;
END;
$$;
