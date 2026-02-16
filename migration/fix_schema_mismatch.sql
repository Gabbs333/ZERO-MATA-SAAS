
-- 1. Rename stock to stocks (if it exists as singular)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'stock') THEN
    ALTER TABLE stock RENAME TO stocks;
  END IF;
END $$;

-- 2. Add etablissement_id to tables if missing
DO $$
BEGIN
    -- produits
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'produits' AND column_name = 'etablissement_id') THEN
        ALTER TABLE produits ADD COLUMN etablissement_id UUID REFERENCES etablissements(id);
    END IF;

    -- stocks
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stocks' AND column_name = 'etablissement_id') THEN
        ALTER TABLE stocks ADD COLUMN etablissement_id UUID REFERENCES etablissements(id);
    END IF;

    -- tables
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tables' AND column_name = 'etablissement_id') THEN
        ALTER TABLE tables ADD COLUMN etablissement_id UUID REFERENCES etablissements(id);
    END IF;

    -- commandes
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'commandes' AND column_name = 'etablissement_id') THEN
        ALTER TABLE commandes ADD COLUMN etablissement_id UUID REFERENCES etablissements(id);
    END IF;

    -- commande_items
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'commande_items' AND column_name = 'etablissement_id') THEN
        ALTER TABLE commande_items ADD COLUMN etablissement_id UUID REFERENCES etablissements(id);
    END IF;
    
    -- factures
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'factures' AND column_name = 'etablissement_id') THEN
        ALTER TABLE factures ADD COLUMN etablissement_id UUID REFERENCES etablissements(id);
    END IF;
    
    -- encaissements
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'encaissements' AND column_name = 'etablissement_id') THEN
        ALTER TABLE encaissements ADD COLUMN etablissement_id UUID REFERENCES etablissements(id);
    END IF;
    
    -- mouvements_stock
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mouvements_stock' AND column_name = 'etablissement_id') THEN
        ALTER TABLE mouvements_stock ADD COLUMN etablissement_id UUID REFERENCES etablissements(id);
    END IF;
    
    -- ravitaillements
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ravitaillements' AND column_name = 'etablissement_id') THEN
        ALTER TABLE ravitaillements ADD COLUMN etablissement_id UUID REFERENCES etablissements(id);
    END IF;
    
    -- ravitaillement_items
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ravitaillement_items' AND column_name = 'etablissement_id') THEN
        ALTER TABLE ravitaillement_items ADD COLUMN etablissement_id UUID REFERENCES etablissements(id);
    END IF;

    -- audit_logs
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'etablissement_id') THEN
        ALTER TABLE audit_logs ADD COLUMN etablissement_id UUID REFERENCES etablissements(id);
    END IF;

    -- profiles
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'etablissement_id') THEN
        ALTER TABLE profiles ADD COLUMN etablissement_id UUID REFERENCES etablissements(id);
    END IF;
END $$;

-- 3. Add prix_achat to produits
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'produits' AND column_name = 'prix_achat') THEN
        ALTER TABLE produits ADD COLUMN prix_achat INTEGER DEFAULT 0;
    END IF;
END $$;

-- 4. Create or Replace get_kpis function
CREATE OR REPLACE FUNCTION get_kpis(etablissement_id UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ca_total BIGINT;
  v_encaissements_total BIGINT;
  v_creances BIGINT;
  v_benefice BIGINT;
  v_nombre_commandes BIGINT;
  v_panier_moyen NUMERIC;
BEGIN
  -- CA Total (Total des commandes validées)
  SELECT COALESCE(SUM(montant_total), 0)
  INTO v_ca_total
  FROM commandes
  WHERE commandes.etablissement_id = get_kpis.etablissement_id
  AND statut = 'validee';

  -- Encaissements Total (Total des factures payées ou partiellement payées)
  SELECT COALESCE(SUM(montant_paye), 0)
  INTO v_encaissements_total
  FROM factures
  WHERE factures.etablissement_id = get_kpis.etablissement_id;

  -- Créances (Reste à payer sur factures)
  SELECT COALESCE(SUM(montant_restant), 0)
  INTO v_creances
  FROM factures
  WHERE factures.etablissement_id = get_kpis.etablissement_id;

  -- Nombre de commandes
  SELECT COUNT(*)
  INTO v_nombre_commandes
  FROM commandes
  WHERE commandes.etablissement_id = get_kpis.etablissement_id;

  -- Panier moyen
  IF v_nombre_commandes > 0 THEN
    v_panier_moyen := v_ca_total::NUMERIC / v_nombre_commandes;
  ELSE
    v_panier_moyen := 0;
  END IF;
  
  -- Bénéfice (Estimation: CA Total - (Somme des Prix Achat * Quantité Vendue))
  -- Note: Cela nécessite que prix_achat soit renseigné et que l'historique soit fiable.
  -- Pour l'instant, on retourne 0 ou une estimation simple.
  v_benefice := 0;

  RETURN json_build_object(
    'ca_total', v_ca_total,
    'encaissements_total', v_encaissements_total,
    'creances', v_creances,
    'benefice', v_benefice,
    'nombre_commandes', v_nombre_commandes,
    'panier_moyen', ROUND(v_panier_moyen, 2)
  );
END;
$$;

-- 5. Create or Replace get_analytics function (Placeholder implementation)
CREATE OR REPLACE FUNCTION get_analytics(etablissement_id UUID, periode TEXT DEFAULT 'month')
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Retourne des données vides pour l'instant pour éviter les erreurs 400
  RETURN json_build_object(
    'labels', ARRAY[]::TEXT[],
    'datasets', ARRAY[]::json[]
  );
END;
$$;
