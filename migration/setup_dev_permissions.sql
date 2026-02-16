-- SETUP DEV PERMISSIONS (NO RLS)
-- Ce script configure les permissions pour le développement et le test.
-- Il DÉSACTIVE la sécurité RLS et donne TOUS les droits aux utilisateurs connectés.
-- À UTILISER UNIQUEMENT POUR LES TESTS AVANT LA MISE EN PROD DES RLS.

-- 1. Désactiver RLS sur toutes les tables (pour éviter les blocages silencieux)
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE produits DISABLE ROW LEVEL SECURITY;
ALTER TABLE stock DISABLE ROW LEVEL SECURITY;
ALTER TABLE tables DISABLE ROW LEVEL SECURITY;
ALTER TABLE commandes DISABLE ROW LEVEL SECURITY;
ALTER TABLE commande_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE mouvements_stock DISABLE ROW LEVEL SECURITY;
ALTER TABLE ravitaillements DISABLE ROW LEVEL SECURITY;
ALTER TABLE ravitaillement_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE factures DISABLE ROW LEVEL SECURITY;
ALTER TABLE encaissements DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;
-- Si la table etablissements existe déjà (via le script précédent), on désactive aussi
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'etablissements') THEN
        ALTER TABLE etablissements DISABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- 2. Accorder les droits explicites (CRUD) aux rôles Supabase
-- Authenticated (utilisateurs connectés)
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO authenticated;

-- Service Role (backend / admin via API key)
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;

-- Anon (si nécessaire pour certaines routes publiques, sinon optionnel)
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- 3. Confirmation
DO $$
BEGIN
  RAISE NOTICE 'MODE DEV ACTIVÉ : RLS désactivé et permissions maximales accordées.';
END $$;
