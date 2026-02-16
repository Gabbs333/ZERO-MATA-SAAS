-- Migration: Row Level Security Policies
-- Description: Implements RLS policies for all tables based on user roles

-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================

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

-- ============================================================================
-- HELPER FUNCTION FOR ROLE CHECKING
-- ============================================================================

-- Function to get current user's role from profiles
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Function to check if user is active
CREATE OR REPLACE FUNCTION is_user_active()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(actif, FALSE) FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================================
-- PROFILES TABLE POLICIES
-- ============================================================================

-- Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

-- Patron can read all profiles
CREATE POLICY "Patron can read all profiles"
  ON profiles FOR SELECT
  USING (get_user_role() = 'patron');

-- Patron can insert new profiles (user management)
CREATE POLICY "Patron can insert profiles"
  ON profiles FOR INSERT
  WITH CHECK (get_user_role() = 'patron');

-- Patron can update profiles
CREATE POLICY "Patron can update profiles"
  ON profiles FOR UPDATE
  USING (get_user_role() = 'patron');

-- Patron can delete profiles
CREATE POLICY "Patron can delete profiles"
  ON profiles FOR DELETE
  USING (get_user_role() = 'patron');

-- ============================================================================
-- PRODUITS TABLE POLICIES
-- ============================================================================

-- Everyone can read active products
CREATE POLICY "Everyone can read active products"
  ON produits FOR SELECT
  USING (actif = true OR get_user_role() IN ('gerant', 'patron'));

-- Gerant and Patron can insert products
CREATE POLICY "Gerant and Patron can insert products"
  ON produits FOR INSERT
  WITH CHECK (get_user_role() IN ('gerant', 'patron'));

-- Gerant and Patron can update products
CREATE POLICY "Gerant and Patron can update products"
  ON produits FOR UPDATE
  USING (get_user_role() IN ('gerant', 'patron'));

-- Gerant and Patron can delete products (soft delete via actif flag)
CREATE POLICY "Gerant and Patron can delete products"
  ON produits FOR DELETE
  USING (get_user_role() IN ('gerant', 'patron'));

-- ============================================================================
-- STOCK TABLE POLICIES
-- ============================================================================

-- Everyone can read stock
CREATE POLICY "Everyone can read stock"
  ON stock FOR SELECT
  USING (true);

-- Only system (via triggers) can modify stock
-- No INSERT/UPDATE/DELETE policies for users - handled by triggers

-- ============================================================================
-- TABLES TABLE POLICIES
-- ============================================================================

-- Everyone can read tables
CREATE POLICY "Everyone can read tables"
  ON tables FOR SELECT
  USING (true);

-- Serveuses can update table status
CREATE POLICY "Serveuses can update table status"
  ON tables FOR UPDATE
  USING (get_user_role() IN ('serveuse', 'comptoir', 'gerant', 'patron'));

-- Gerant and Patron can insert/delete tables
CREATE POLICY "Gerant and Patron can manage tables"
  ON tables FOR ALL
  USING (get_user_role() IN ('gerant', 'patron'));

-- ============================================================================
-- COMMANDES TABLE POLICIES
-- ============================================================================

-- Serveuses can read their own commandes
CREATE POLICY "Serveuses can read own commandes"
  ON commandes FOR SELECT
  USING (
    serveuse_id = auth.uid() OR
    get_user_role() IN ('comptoir', 'gerant', 'patron')
  );

-- Serveuses can insert commandes
CREATE POLICY "Serveuses can insert commandes"
  ON commandes FOR INSERT
  WITH CHECK (
    serveuse_id = auth.uid() AND
    get_user_role() IN ('serveuse', 'comptoir', 'gerant', 'patron')
  );

-- Comptoir can update commandes (validation)
CREATE POLICY "Comptoir can update commandes"
  ON commandes FOR UPDATE
  USING (
    get_user_role() IN ('comptoir', 'gerant', 'patron') AND
    statut = 'en_attente'
  );

-- Serveuses can delete their own pending commandes
CREATE POLICY "Serveuses can delete own pending commandes"
  ON commandes FOR DELETE
  USING (
    serveuse_id = auth.uid() AND
    statut = 'en_attente'
  );

-- ============================================================================
-- COMMANDE_ITEMS TABLE POLICIES
-- ============================================================================

-- Users can read commande_items if they can read the commande
CREATE POLICY "Users can read commande_items"
  ON commande_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM commandes
      WHERE commandes.id = commande_items.commande_id
      AND (
        commandes.serveuse_id = auth.uid() OR
        get_user_role() IN ('comptoir', 'gerant', 'patron')
      )
    )
  );

-- Serveuses can insert commande_items for their own commandes
CREATE POLICY "Serveuses can insert commande_items"
  ON commande_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM commandes
      WHERE commandes.id = commande_items.commande_id
      AND commandes.serveuse_id = auth.uid()
      AND commandes.statut = 'en_attente'
    )
  );

-- Serveuses can update/delete commande_items for pending commandes
CREATE POLICY "Serveuses can update commande_items"
  ON commande_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM commandes
      WHERE commandes.id = commande_items.commande_id
      AND commandes.serveuse_id = auth.uid()
      AND commandes.statut = 'en_attente'
    )
  );

CREATE POLICY "Serveuses can delete commande_items"
  ON commande_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM commandes
      WHERE commandes.id = commande_items.commande_id
      AND commandes.serveuse_id = auth.uid()
      AND commandes.statut = 'en_attente'
    )
  );

-- ============================================================================
-- MOUVEMENTS_STOCK TABLE POLICIES
-- ============================================================================

-- Everyone can read mouvements_stock
CREATE POLICY "Everyone can read mouvements_stock"
  ON mouvements_stock FOR SELECT
  USING (true);

-- Only system (via triggers) can insert mouvements_stock
-- Gerant and Patron can also insert for manual adjustments
CREATE POLICY "Gerant and Patron can insert mouvements_stock"
  ON mouvements_stock FOR INSERT
  WITH CHECK (get_user_role() IN ('gerant', 'patron'));

-- ============================================================================
-- RAVITAILLEMENTS TABLE POLICIES
-- ============================================================================

-- Everyone can read ravitaillements
CREATE POLICY "Everyone can read ravitaillements"
  ON ravitaillements FOR SELECT
  USING (true);

-- Only Gerant and Patron can create ravitaillements
CREATE POLICY "Gerant and Patron can insert ravitaillements"
  ON ravitaillements FOR INSERT
  WITH CHECK (
    get_user_role() IN ('gerant', 'patron') AND
    gerant_id = auth.uid()
  );

-- Ravitaillements are immutable after creation (no UPDATE/DELETE)

-- ============================================================================
-- RAVITAILLEMENT_ITEMS TABLE POLICIES
-- ============================================================================

-- Users can read ravitaillement_items if they can read ravitaillements
CREATE POLICY "Everyone can read ravitaillement_items"
  ON ravitaillement_items FOR SELECT
  USING (true);

-- Gerant and Patron can insert ravitaillement_items
CREATE POLICY "Gerant and Patron can insert ravitaillement_items"
  ON ravitaillement_items FOR INSERT
  WITH CHECK (
    get_user_role() IN ('gerant', 'patron') AND
    EXISTS (
      SELECT 1 FROM ravitaillements
      WHERE ravitaillements.id = ravitaillement_items.ravitaillement_id
      AND ravitaillements.gerant_id = auth.uid()
    )
  );

-- ============================================================================
-- FACTURES TABLE POLICIES
-- ============================================================================

-- Comptoir, Gerant, and Patron can read all factures
CREATE POLICY "Comptoir can read all factures"
  ON factures FOR SELECT
  USING (get_user_role() IN ('comptoir', 'gerant', 'patron'));

-- Serveuses can read factures for their own commandes
CREATE POLICY "Serveuses can read own factures"
  ON factures FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM commandes
      WHERE commandes.id = factures.commande_id
      AND commandes.serveuse_id = auth.uid()
    )
  );

-- Factures are created automatically by triggers (no manual INSERT)
-- Factures are immutable (no UPDATE/DELETE by users)

-- ============================================================================
-- ENCAISSEMENTS TABLE POLICIES
-- ============================================================================

-- Comptoir, Gerant, and Patron can read all encaissements
CREATE POLICY "Comptoir can read all encaissements"
  ON encaissements FOR SELECT
  USING (get_user_role() IN ('comptoir', 'gerant', 'patron'));

-- Only Comptoir can create encaissements
CREATE POLICY "Comptoir can insert encaissements"
  ON encaissements FOR INSERT
  WITH CHECK (
    get_user_role() IN ('comptoir', 'gerant', 'patron') AND
    utilisateur_id = auth.uid()
  );

-- Encaissements are immutable after creation (no UPDATE/DELETE)

-- ============================================================================
-- AUDIT_LOGS TABLE POLICIES
-- ============================================================================

-- Only Patron can read audit logs
CREATE POLICY "Patron can read audit_logs"
  ON audit_logs FOR SELECT
  USING (get_user_role() = 'patron');

-- Audit logs are created automatically by triggers (no manual INSERT)
-- Audit logs are immutable (no UPDATE/DELETE)

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION get_user_role IS 'Returns the role of the currently authenticated user';
COMMENT ON FUNCTION is_user_active IS 'Checks if the currently authenticated user is active';

COMMENT ON POLICY "Users can read own profile" ON profiles IS 'Requirement 7.2: Users can view their own profile';
COMMENT ON POLICY "Patron can read all profiles" ON profiles IS 'Requirement 7.4: Patron has full access';
COMMENT ON POLICY "Serveuses can read own commandes" ON commandes IS 'Requirement 7.2: Serveuses see only their own commandes';
COMMENT ON POLICY "Comptoir can update commandes" ON commandes IS 'Requirement 7.3: Comptoir can validate commandes';
COMMENT ON POLICY "Gerant and Patron can insert ravitaillements" ON ravitaillements IS 'Requirement 7.3: Only Gerant/Patron can create ravitaillements';
COMMENT ON POLICY "Comptoir can insert encaissements" ON encaissements IS 'Requirement 7.3: Only Comptoir can record encaissements';
