-- ============================================================================
-- FINAL FIX SCRIPT FOR VERROUILLAGE
-- Includes:
-- 1. Fix RPC functions (get_kpis, etc.) to match frontend expectations
-- 2. Fix Stock table column name (quantite -> quantite_actuelle)
-- 3. Fix Ravitaillement number generation (duplicate key error)
-- ============================================================================

-- PART 1: FIX RPC FUNCTIONS
-- ============================================================================

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
  SELECT etablissement_id INTO v_etablissement_id
  FROM profiles
  WHERE id = auth.uid();

  SELECT COALESCE(SUM(montant_total), 0) INTO v_ca
  FROM commandes
  WHERE etablissement_id = v_etablissement_id
  AND statut = 'validee'
  AND date_creation BETWEEN debut AND fin;

  SELECT COALESCE(SUM(montant_paye), 0) INTO v_encaissements
  FROM factures
  WHERE etablissement_id = v_etablissement_id
  AND date_generation BETWEEN debut AND fin;

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

  SELECT COALESCE(SUM(montant_total), 0), COUNT(*)
  INTO v_ca, v_nombre_commandes
  FROM commandes
  WHERE etablissement_id = v_etablissement_id
  AND statut = 'validee'
  AND date_creation BETWEEN p_debut AND p_fin;

  SELECT COALESCE(SUM(montant_paye), 0), COALESCE(SUM(montant_restant), 0)
  INTO v_encaissements, v_creances
  FROM factures
  WHERE etablissement_id = v_etablissement_id
  AND date_generation BETWEEN p_debut AND p_fin;

  IF v_nombre_commandes > 0 THEN
    v_panier_moyen := v_ca / v_nombre_commandes;
  ELSE
    v_panier_moyen := 0;
  END IF;

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

DROP FUNCTION IF EXISTS get_analytics_ca_encaissements(timestamp with time zone, timestamp with time zone);

CREATE OR REPLACE FUNCTION get_analytics_ca_encaissements(p_debut timestamp with time zone, p_fin timestamp with time zone)
RETURNS TABLE (date text, ca numeric, encaissements numeric)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY SELECT * FROM get_analytics(p_debut, p_fin, 'day');
END;
$$;

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


-- PART 2: FIX STOCK COLUMN NAME
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stocks' AND column_name = 'quantite') THEN
        ALTER TABLE stocks RENAME COLUMN quantite TO quantite_actuelle;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stocks' AND column_name = 'seuil_alerte') THEN
        ALTER TABLE stocks ADD COLUMN seuil_alerte INTEGER DEFAULT 10;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stocks' AND column_name = 'derniere_mise_a_jour') THEN
        ALTER TABLE stocks ADD COLUMN derniere_mise_a_jour TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- Ensure ravitaillement_items has correct columns
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ravitaillement_items' AND column_name = 'cout_unitaire') THEN
        ALTER TABLE ravitaillement_items RENAME COLUMN cout_unitaire TO prix_unitaire;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ravitaillement_items' AND column_name = 'nom_produit') THEN
        ALTER TABLE ravitaillement_items ADD COLUMN nom_produit TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ravitaillement_items' AND column_name = 'etablissement_id') THEN
        ALTER TABLE ravitaillement_items ADD COLUMN etablissement_id UUID REFERENCES etablissements(id);
    END IF;
    
    ALTER TABLE ravitaillement_items ALTER COLUMN montant_ligne DROP NOT NULL;
END $$;

CREATE OR REPLACE FUNCTION calculate_ravitaillement_item_total()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.montant_ligne IS NULL THEN
     NEW.montant_ligne := NEW.quantite * NEW.prix_unitaire;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calculate_ravitaillement_item_total ON ravitaillement_items;
CREATE TRIGGER trigger_calculate_ravitaillement_item_total
  BEFORE INSERT OR UPDATE ON ravitaillement_items
  FOR EACH ROW
  EXECUTE FUNCTION calculate_ravitaillement_item_total();

CREATE OR REPLACE FUNCTION update_stock_after_ravitaillement()
RETURNS TRIGGER AS $$
DECLARE
  v_utilisateur_id UUID;
BEGIN
  -- Fetch user ID (gerant) from parent ravitaillement
  SELECT gerant_id INTO v_utilisateur_id
  FROM ravitaillements
  WHERE id = NEW.ravitaillement_id;

  IF v_utilisateur_id IS NULL THEN
    v_utilisateur_id := auth.uid();
  END IF;

  -- Insert or Update stock for the product
  INSERT INTO stocks (produit_id, etablissement_id, quantite_actuelle, seuil_alerte)
  VALUES (NEW.produit_id, NEW.etablissement_id, NEW.quantite, 10) 
  ON CONFLICT (produit_id) 
  DO UPDATE SET 
    quantite_actuelle = stocks.quantite_actuelle + EXCLUDED.quantite_actuelle,
    derniere_mise_a_jour = NOW();
    
  -- Log movement
  INSERT INTO mouvements_stock (
    produit_id, 
    etablissement_id, 
    quantite, 
    type, 
    type_reference, 
    reference, 
    date_creation,
    utilisateur_id
  )
  VALUES (
    NEW.produit_id, 
    NEW.etablissement_id, 
    NEW.quantite, 
    'entree', 
    'ravitaillement', 
    NEW.ravitaillement_id::TEXT, 
    NOW(),
    v_utilisateur_id
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- PART 3: FIX RAVITAILLEMENT NUMBER GENERATION
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_numero_ravitaillement()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
  date_part TEXT;
BEGIN
  date_part := TO_CHAR(NOW(), 'YYYYMMDD');
  
  -- Changed FROM 13 to FROM 14 to correctly parse the number part (RAV-YYYYMMDD- is 13 chars)
  SELECT COALESCE(MAX(CAST(SUBSTRING(numero_ravitaillement FROM 14) AS INTEGER)), 0) + 1
  INTO next_num
  FROM ravitaillements
  WHERE numero_ravitaillement LIKE 'RAV-' || date_part || '-%';
  
  NEW.numero_ravitaillement := 'RAV-' || date_part || '-' || LPAD(next_num::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
