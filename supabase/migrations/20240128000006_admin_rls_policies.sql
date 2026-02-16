-- Migration: Admin RLS Policies
-- Description: Create RLS policies for admin users with cross-establishment access
-- Requirements: 6.2, 6.4, 8.6

-- ============================================================================
-- HELPER FUNCTION: Check if user is admin
-- ============================================================================

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

COMMENT ON FUNCTION public.is_admin IS 
'Returns true if the currently authenticated user has admin role';

-- ============================================================================
-- ETABLISSEMENTS TABLE POLICIES (Admin Access)
-- ============================================================================

-- Admin can read all establishments
CREATE POLICY "admin_read_all_etablissements"
  ON etablissements FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Admin can insert new establishments
CREATE POLICY "admin_insert_etablissements"
  ON etablissements FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Admin can update establishments
CREATE POLICY "admin_update_etablissements"
  ON etablissements FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Admin can delete establishments (with restrictions from foreign keys)
CREATE POLICY "admin_delete_etablissements"
  ON etablissements FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- PROFILES TABLE POLICIES (Admin Access)
-- ============================================================================

-- Admin can read all profiles across all establishments
CREATE POLICY "admin_read_all_profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Admin can insert profiles (for creating admin users)
CREATE POLICY "admin_insert_profiles"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Admin can update profiles across all establishments
CREATE POLICY "admin_update_all_profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================================
-- PRODUITS TABLE POLICIES (Admin Access)
-- ============================================================================

-- Admin can read all products across all establishments
CREATE POLICY "admin_read_all_produits"
  ON produits FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- STOCK TABLE POLICIES (Admin Access)
-- ============================================================================

-- Admin can read all stock across all establishments
CREATE POLICY "admin_read_all_stock"
  ON stock FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- TABLES TABLE POLICIES (Admin Access)
-- ============================================================================

-- Admin can read all tables across all establishments
CREATE POLICY "admin_read_all_tables"
  ON tables FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- COMMANDES TABLE POLICIES (Admin Access)
-- ============================================================================

-- Admin can read all commandes across all establishments
CREATE POLICY "admin_read_all_commandes"
  ON commandes FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- COMMANDE_ITEMS TABLE POLICIES (Admin Access)
-- ============================================================================

-- Admin can read all commande_items across all establishments
CREATE POLICY "admin_read_all_commande_items"
  ON commande_items FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- MOUVEMENTS_STOCK TABLE POLICIES (Admin Access)
-- ============================================================================

-- Admin can read all mouvements_stock across all establishments
CREATE POLICY "admin_read_all_mouvements_stock"
  ON mouvements_stock FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- RAVITAILLEMENTS TABLE POLICIES (Admin Access)
-- ============================================================================

-- Admin can read all ravitaillements across all establishments
CREATE POLICY "admin_read_all_ravitaillements"
  ON ravitaillements FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- RAVITAILLEMENT_ITEMS TABLE POLICIES (Admin Access)
-- ============================================================================

-- Admin can read all ravitaillement_items across all establishments
CREATE POLICY "admin_read_all_ravitaillement_items"
  ON ravitaillement_items FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- FACTURES TABLE POLICIES (Admin Access)
-- ============================================================================

-- Admin can read all factures across all establishments
CREATE POLICY "admin_read_all_factures"
  ON factures FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- ENCAISSEMENTS TABLE POLICIES (Admin Access)
-- ============================================================================

-- Admin can read all encaissements across all establishments
CREATE POLICY "admin_read_all_encaissements"
  ON encaissements FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- AUDIT_LOGS TABLE POLICIES (Admin Access)
-- ============================================================================

-- Admin can read all audit logs across all establishments
CREATE POLICY "admin_read_all_audit_logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Admin can insert audit logs (for logging admin actions)
CREATE POLICY "admin_insert_audit_logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON POLICY "admin_read_all_etablissements" ON etablissements IS 
'Requirement 6.2: Admin users can view all establishments';

COMMENT ON POLICY "admin_insert_etablissements" ON etablissements IS 
'Requirement 6.2: Admin users can create new establishments';

COMMENT ON POLICY "admin_update_etablissements" ON etablissements IS 
'Requirement 6.2: Admin users can update establishments';

COMMENT ON POLICY "admin_read_all_profiles" ON profiles IS 
'Requirement 6.2, 8.6: Admin users can view all profiles across establishments';

COMMENT ON POLICY "admin_read_all_commandes" ON commandes IS 
'Requirement 6.2, 8.6: Admin users can view all commandes across establishments';

COMMENT ON POLICY "admin_read_all_audit_logs" ON audit_logs IS 
'Requirement 6.2: Admin users can view all audit logs for monitoring';

COMMENT ON FUNCTION public.is_admin IS 
'Helper function to check if current user is an active admin';

-- ============================================================================
-- NOTES
-- ============================================================================

-- Admin users have READ-ONLY access to establishment-specific data
-- Admin users can perform CRUD operations on:
--   - etablissements table (full management)
--   - profiles table (user management)
--   - audit_logs table (logging admin actions)
--
-- Admin users CANNOT perform establishment-specific operations like:
--   - Creating commandes (requires serveuse role in an establishment)
--   - Creating ravitaillements (requires gerant role in an establishment)
--   - Validating commandes (requires comptoir role in an establishment)
--
-- This enforces Requirement 6.4: Admin users cannot perform establishment-specific
-- operations without proper establishment context and role.
