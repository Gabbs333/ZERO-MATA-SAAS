-- SETUP FULL SECURITY & MULTI-TENANCY
-- Ce script regroupe toutes les migrations nécessaires pour sécuriser l'application
-- et activer le support multi-tenant, APRÈS l'exécution de schema.sql.

-- 1. CRÉATION DE LA TABLE ÉTABLISSEMENTS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS etablissements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nom TEXT NOT NULL,
  adresse TEXT,
  telephone TEXT,
  email TEXT,
  statut_abonnement TEXT NOT NULL CHECK (statut_abonnement IN ('actif', 'expire', 'suspendu')) DEFAULT 'actif',
  date_debut TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  date_fin TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '12 months'),
  actif BOOLEAN NOT NULL DEFAULT true,
  dernier_paiement_date TIMESTAMPTZ,
  dernier_paiement_confirme_par UUID REFERENCES auth.users(id),
  date_creation TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  date_modification TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE etablissements ENABLE ROW LEVEL SECURITY;

-- 2. AJOUT DE LA COLONNE ETABLISSEMENT_ID PARTOUT
DO $$ 
BEGIN
    -- Profiles
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'etablissement_id') THEN
        ALTER TABLE profiles ADD COLUMN etablissement_id UUID REFERENCES etablissements(id) ON DELETE RESTRICT;
        CREATE INDEX idx_profiles_etablissement_id ON profiles(etablissement_id);
    END IF;

    -- Produits
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'produits' AND column_name = 'etablissement_id') THEN
        ALTER TABLE produits ADD COLUMN etablissement_id UUID REFERENCES etablissements(id) ON DELETE RESTRICT;
        CREATE INDEX idx_produits_etablissement_id ON produits(etablissement_id);
    END IF;

    -- Stock
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stock' AND column_name = 'etablissement_id') THEN
        ALTER TABLE stock ADD COLUMN etablissement_id UUID REFERENCES etablissements(id) ON DELETE RESTRICT;
        CREATE INDEX idx_stock_etablissement_id ON stock(etablissement_id);
    END IF;

    -- Tables
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tables' AND column_name = 'etablissement_id') THEN
        ALTER TABLE tables ADD COLUMN etablissement_id UUID REFERENCES etablissements(id) ON DELETE RESTRICT;
        CREATE INDEX idx_tables_etablissement_id ON tables(etablissement_id);
    END IF;

    -- Commandes
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'commandes' AND column_name = 'etablissement_id') THEN
        ALTER TABLE commandes ADD COLUMN etablissement_id UUID REFERENCES etablissements(id) ON DELETE RESTRICT;
        CREATE INDEX idx_commandes_etablissement_id ON commandes(etablissement_id);
    END IF;

    -- Commande Items
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'commande_items' AND column_name = 'etablissement_id') THEN
        ALTER TABLE commande_items ADD COLUMN etablissement_id UUID REFERENCES etablissements(id) ON DELETE RESTRICT;
        CREATE INDEX idx_commande_items_etablissement_id ON commande_items(etablissement_id);
    END IF;

    -- Mouvements Stock
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mouvements_stock' AND column_name = 'etablissement_id') THEN
        ALTER TABLE mouvements_stock ADD COLUMN etablissement_id UUID REFERENCES etablissements(id) ON DELETE RESTRICT;
        CREATE INDEX idx_mouvements_stock_etablissement_id ON mouvements_stock(etablissement_id);
    END IF;

    -- Ravitaillements
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ravitaillements' AND column_name = 'etablissement_id') THEN
        ALTER TABLE ravitaillements ADD COLUMN etablissement_id UUID REFERENCES etablissements(id) ON DELETE RESTRICT;
        CREATE INDEX idx_ravitaillements_etablissement_id ON ravitaillements(etablissement_id);
    END IF;

    -- Ravitaillement Items
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ravitaillement_items' AND column_name = 'etablissement_id') THEN
        ALTER TABLE ravitaillement_items ADD COLUMN etablissement_id UUID REFERENCES etablissements(id) ON DELETE RESTRICT;
        CREATE INDEX idx_ravitaillement_items_etablissement_id ON ravitaillement_items(etablissement_id);
    END IF;

    -- Factures
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'factures' AND column_name = 'etablissement_id') THEN
        ALTER TABLE factures ADD COLUMN etablissement_id UUID REFERENCES etablissements(id) ON DELETE RESTRICT;
        CREATE INDEX idx_factures_etablissement_id ON factures(etablissement_id);
    END IF;

    -- Encaissements
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'encaissements' AND column_name = 'etablissement_id') THEN
        ALTER TABLE encaissements ADD COLUMN etablissement_id UUID REFERENCES etablissements(id) ON DELETE RESTRICT;
        CREATE INDEX idx_encaissements_etablissement_id ON encaissements(etablissement_id);
    END IF;

    -- Audit Logs
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'etablissement_id') THEN
        ALTER TABLE audit_logs ADD COLUMN etablissement_id UUID REFERENCES etablissements(id) ON DELETE RESTRICT;
        CREATE INDEX idx_audit_logs_etablissement_id ON audit_logs(etablissement_id);
    END IF;
END $$;

-- 3. ACTIVATION RLS SUR TOUTES LES TABLES
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE produits ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE commandes ENABLE ROW LEVEL SECURITY;
ALTER TABLE commande_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE mouvements_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE ravitaillements ENABLE ROW LEVEL SECURITY;
ALTER TABLE ravitaillement_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE factures ENABLE ROW LEVEL SECURITY;
ALTER TABLE encaissements ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 4. FONCTIONS HELPER
CREATE OR REPLACE FUNCTION public.get_user_etablissement_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT etablissement_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
    AND actif = true
  );
$;

-- 5. POLITIQUES MULTI-TENANT & ADMIN
-- Note: Suppression préalable des politiques existantes pour éviter les conflits
DROP POLICY IF EXISTS "users_read_own_profile" ON profiles;
DROP POLICY IF EXISTS "admin_read_all_profiles" ON profiles;
-- ... (et ainsi de suite pour toutes les policies, on recrée tout proprement)

-- PROFILES
CREATE POLICY "users_read_own_profile" ON profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "patron_read_establishment_profiles" ON profiles FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'patron' AND p.etablissement_id = profiles.etablissement_id)
);
CREATE POLICY "admin_read_all_profiles" ON profiles FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "admin_manage_profiles" ON profiles FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- PRODUITS
CREATE POLICY "read_products" ON produits FOR SELECT TO authenticated USING (
    (etablissement_id = public.get_user_etablissement_id() AND actif = true) OR public.is_admin()
);
CREATE POLICY "manage_products" ON produits FOR ALL TO authenticated USING (
    (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('gerant', 'patron') AND etablissement_id = produits.etablissement_id)) OR public.is_admin()
);

-- STOCK
CREATE POLICY "read_stock" ON stock FOR SELECT TO authenticated USING (
    etablissement_id = public.get_user_etablissement_id() OR public.is_admin()
);
-- Seuls les triggers ou admins modifient le stock directement (ou gérants pour ajustement)
CREATE POLICY "manage_stock" ON stock FOR ALL TO authenticated USING (
    (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('gerant', 'patron') AND etablissement_id = stock.etablissement_id)) OR public.is_admin()
);

-- TABLES
CREATE POLICY "read_tables" ON tables FOR SELECT TO authenticated USING (
    etablissement_id = public.get_user_etablissement_id() OR public.is_admin()
);
CREATE POLICY "serveuse_update_tables" ON tables FOR UPDATE TO authenticated USING (
    etablissement_id = public.get_user_etablissement_id() AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('serveuse', 'comptoir', 'gerant', 'patron'))
);
CREATE POLICY "admin_manage_tables" ON tables FOR ALL TO authenticated USING (public.is_admin());

-- COMMANDES
CREATE POLICY "read_commandes" ON commandes FOR SELECT TO authenticated USING (
    (etablissement_id = public.get_user_etablissement_id() AND (serveuse_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('comptoir', 'gerant', 'patron'))))
    OR public.is_admin()
);
CREATE POLICY "insert_commandes" ON commandes FOR INSERT TO authenticated WITH CHECK (
    (etablissement_id = public.get_user_etablissement_id() AND serveuse_id = auth.uid()) OR public.is_admin()
);
CREATE POLICY "update_commandes" ON commandes FOR UPDATE TO authenticated USING (
    (etablissement_id = public.get_user_etablissement_id()) OR public.is_admin()
);

-- ETABLISSEMENTS (Admin only + Read own ?)
CREATE POLICY "admin_manage_etablissements" ON etablissements FOR ALL TO authenticated USING (public.is_admin());

-- AUDIT LOGS
CREATE POLICY "read_audit_logs" ON audit_logs FOR SELECT TO authenticated USING (
    (etablissement_id = public.get_user_etablissement_id() AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'patron'))
    OR public.is_admin()
);

-- FIN DU SCRIPT
