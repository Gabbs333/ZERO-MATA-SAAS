-- Migration: Multi-Tenant RLS Policies
-- Description: Recreate all RLS policies with etablissement_id filtering for data isolation
-- Requirements: 1.3, 1.4, 8.1, 8.2, 8.3, 8.4, 8.5, 8.7

-- ============================================================================
-- DROP ALL EXISTING POLICIES
-- ============================================================================

-- Profiles
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Patron can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Patron can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Patron can update profiles" ON profiles;
DROP POLICY IF EXISTS "Patron can delete profiles" ON profiles;

-- Produits
DROP POLICY IF EXISTS "Everyone can read active products" ON produits;
DROP POLICY IF EXISTS "Serveuses can read available products" ON produits;
DROP POLICY IF EXISTS "Comptoir can read active products" ON produits;
DROP POLICY IF EXISTS "Gerant and Patron can read all products" ON produits;
DROP POLICY IF EXISTS "Gerant and Patron can insert products" ON produits;
DROP POLICY IF EXISTS "Gerant and Patron can update products" ON produits;
DROP POLICY IF EXISTS "Gerant and Patron can delete products" ON produits;

-- Stock
DROP POLICY IF EXISTS "Everyone can read stock" ON stock;
DROP POLICY IF EXISTS "Gerant and Patron can insert stock" ON stock;
DROP POLICY IF EXISTS "Gerant and Patron can update stock" ON stock;

-- Tables
DROP POLICY IF EXISTS "Everyone can read tables" ON tables;
DROP POLICY IF EXISTS "Serveuses can update table status" ON tables;
DROP POLICY IF EXISTS "Gerant and Patron can manage tables" ON tables;

-- Commandes
DROP POLICY IF EXISTS "Serveuses can read own commandes" ON commandes;
DROP POLICY IF EXISTS "Serveuses can insert commandes" ON commandes;
DROP POLICY IF EXISTS "Comptoir can update commandes" ON commandes;
DROP POLICY IF EXISTS "Serveuses can delete own pending commandes" ON commandes;
DROP POLICY IF EXISTS "serveuses_create_commandes" ON commandes;
DROP POLICY IF EXISTS "serveuses_read_own_commandes" ON commandes;
DROP POLICY IF EXISTS "comptoir_read_pending_commandes" ON commandes;
DROP POLICY IF EXISTS "comptoir_validate_commandes" ON commandes;
DROP POLICY IF EXISTS "patron_gerant_read_all_commandes" ON commandes;
DROP POLICY IF EXISTS "prevent_update_validated_commandes" ON commandes;
DROP POLICY IF EXISTS "prevent_delete_validated_commandes" ON commandes;

-- Commande Items
DROP POLICY IF EXISTS "Users can read commande_items" ON commande_items;
DROP POLICY IF EXISTS "Serveuses can insert commande_items" ON commande_items;
DROP POLICY IF EXISTS "Serveuses can update commande_items" ON commande_items;
DROP POLICY IF EXISTS "Serveuses can delete commande_items" ON commande_items;
DROP POLICY IF EXISTS "serveuses_create_commande_items" ON commande_items;
DROP POLICY IF EXISTS "read_commande_items" ON commande_items;
DROP POLICY IF EXISTS "serveuses_update_commande_items" ON commande_items;
DROP POLICY IF EXISTS "serveuses_delete_commande_items" ON commande_items;
DROP POLICY IF EXISTS "prevent_update_validated_commande_items" ON commande_items;
DROP POLICY IF EXISTS "prevent_delete_validated_commande_items" ON commande_items;

-- Mouvements Stock
DROP POLICY IF EXISTS "Everyone can read mouvements_stock" ON mouvements_stock;
DROP POLICY IF EXISTS "Gerant and Patron can insert mouvements_stock" ON mouvements_stock;

-- Ravitaillements
DROP POLICY IF EXISTS "Everyone can read ravitaillements" ON ravitaillements;
DROP POLICY IF EXISTS "Gerant and Patron can insert ravitaillements" ON ravitaillements;

-- Ravitaillement Items
DROP POLICY IF EXISTS "Everyone can read ravitaillement_items" ON ravitaillement_items;
DROP POLICY IF EXISTS "Gerant and Patron can insert ravitaillement_items" ON ravitaillement_items;

-- Factures
DROP POLICY IF EXISTS "Comptoir can read all factures" ON factures;
DROP POLICY IF EXISTS "Serveuses can read own factures" ON factures;

-- Encaissements
DROP POLICY IF EXISTS "Comptoir can read all encaissements" ON encaissements;
DROP POLICY IF EXISTS "Comptoir can insert encaissements" ON encaissements;

-- Audit Logs
DROP POLICY IF EXISTS "Patron can read audit_logs" ON audit_logs;

-- ============================================================================
-- HELPER FUNCTION: Get User's Etablissement ID
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_etablissement_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT etablissement_id FROM public.profiles WHERE id = auth.uid();
$$;

COMMENT ON FUNCTION public.get_user_etablissement_id IS 
'Returns the etablissement_id of the currently authenticated user (NULL for admin users)';

-- ============================================================================
-- PROFILES TABLE POLICIES (Multi-Tenant)
-- ============================================================================

-- Users can read their own profile
CREATE POLICY "users_read_own_profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (id = (SELECT auth.uid()));

-- Patron can read all profiles in their establishment
CREATE POLICY "patron_read_establishment_profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role = 'patron'
      AND p.actif = true
      AND p.etablissement_id = profiles.etablissement_id
    )
  );

-- Patron can insert new profiles in their establishment
CREATE POLICY "patron_insert_establishment_profiles"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role = 'patron'
      AND p.actif = true
      AND p.etablissement_id = profiles.etablissement_id
    )
  );

-- Patron can update profiles in their establishment
CREATE POLICY "patron_update_establishment_profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role = 'patron'
      AND p.actif = true
      AND p.etablissement_id = profiles.etablissement_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role = 'patron'
      AND p.actif = true
      AND p.etablissement_id = profiles.etablissement_id
    )
  );

-- Users cannot modify their own etablissement_id
CREATE POLICY "prevent_etablissement_id_modification"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    id = (SELECT auth.uid()) AND
    etablissement_id = (SELECT etablissement_id FROM public.profiles WHERE id = (SELECT auth.uid()))
  );

-- ============================================================================
-- PRODUITS TABLE POLICIES (Multi-Tenant)
-- ============================================================================

-- Serveuses can read active products with stock in their establishment
CREATE POLICY "serveuses_read_available_products"
  ON produits FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
      AND role = 'serveuse'
      AND actif = true
      AND etablissement_id = produits.etablissement_id
    )
    AND actif = true
    AND EXISTS (
      SELECT 1 FROM public.stock
      WHERE stock.produit_id = produits.id
      AND stock.quantite_disponible > 0
    )
  );

-- Comptoir can read all active products in their establishment
CREATE POLICY "comptoir_read_active_products"
  ON produits FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
      AND role = 'comptoir'
      AND actif = true
      AND etablissement_id = produits.etablissement_id
    )
    AND actif = true
  );

-- Gerant and Patron can read all products in their establishment
CREATE POLICY "gerant_patron_read_all_products"
  ON produits FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('gerant', 'patron')
      AND actif = true
      AND etablissement_id = produits.etablissement_id
    )
  );

-- Gerant and Patron can insert products in their establishment
CREATE POLICY "gerant_patron_insert_products"
  ON produits FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('gerant', 'patron')
      AND actif = true
      AND etablissement_id = produits.etablissement_id
    )
  );

-- Gerant and Patron can update products in their establishment
CREATE POLICY "gerant_patron_update_products"
  ON produits FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('gerant', 'patron')
      AND actif = true
      AND etablissement_id = produits.etablissement_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('gerant', 'patron')
      AND actif = true
      AND etablissement_id = produits.etablissement_id
    )
  );

-- Gerant and Patron can delete products in their establishment
CREATE POLICY "gerant_patron_delete_products"
  ON produits FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('gerant', 'patron')
      AND actif = true
      AND etablissement_id = produits.etablissement_id
    )
  );

-- ============================================================================
-- STOCK TABLE POLICIES (Multi-Tenant)
-- ============================================================================

-- Everyone in establishment can read stock
CREATE POLICY "users_read_establishment_stock"
  ON stock FOR SELECT
  TO authenticated
  USING (
    etablissement_id = (SELECT public.get_user_etablissement_id())
  );

-- Gerant and Patron can insert stock in their establishment
CREATE POLICY "gerant_patron_insert_stock"
  ON stock FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('gerant', 'patron')
      AND actif = true
      AND etablissement_id = stock.etablissement_id
    )
  );

-- Gerant and Patron can update stock in their establishment
CREATE POLICY "gerant_patron_update_stock"
  ON stock FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('gerant', 'patron')
      AND actif = true
      AND etablissement_id = stock.etablissement_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('gerant', 'patron')
      AND actif = true
      AND etablissement_id = stock.etablissement_id
    )
  );

-- ============================================================================
-- TABLES TABLE POLICIES (Multi-Tenant)
-- ============================================================================

-- Everyone in establishment can read tables
CREATE POLICY "users_read_establishment_tables"
  ON tables FOR SELECT
  TO authenticated
  USING (
    etablissement_id = (SELECT public.get_user_etablissement_id())
  );

-- Serveuses and above can update table status
CREATE POLICY "users_update_table_status"
  ON tables FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('serveuse', 'comptoir', 'gerant', 'patron')
      AND actif = true
      AND etablissement_id = tables.etablissement_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('serveuse', 'comptoir', 'gerant', 'patron')
      AND actif = true
      AND etablissement_id = tables.etablissement_id
    )
  );

-- Gerant and Patron can insert tables
CREATE POLICY "gerant_patron_insert_tables"
  ON tables FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('gerant', 'patron')
      AND actif = true
      AND etablissement_id = tables.etablissement_id
    )
  );

-- Gerant and Patron can delete tables
CREATE POLICY "gerant_patron_delete_tables"
  ON tables FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('gerant', 'patron')
      AND actif = true
      AND etablissement_id = tables.etablissement_id
    )
  );

-- ============================================================================
-- COMMANDES TABLE POLICIES (Multi-Tenant)
-- ============================================================================

-- Serveuses can read their own commandes in their establishment
CREATE POLICY "serveuses_read_own_commandes"
  ON commandes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
      AND role = 'serveuse'
      AND actif = true
      AND etablissement_id = commandes.etablissement_id
    )
    AND serveuse_id = (SELECT auth.uid())
  );

-- Comptoir can read pending commandes in their establishment
CREATE POLICY "comptoir_read_pending_commandes"
  ON commandes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
      AND role = 'comptoir'
      AND actif = true
      AND etablissement_id = commandes.etablissement_id
    )
    AND statut = 'en_attente'
  );

-- Gerant and Patron can read all commandes in their establishment
CREATE POLICY "gerant_patron_read_all_commandes"
  ON commandes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('gerant', 'patron')
      AND actif = true
      AND etablissement_id = commandes.etablissement_id
    )
  );

-- Serveuses can insert commandes in their establishment
CREATE POLICY "serveuses_insert_commandes"
  ON commandes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
      AND role = 'serveuse'
      AND actif = true
      AND etablissement_id = commandes.etablissement_id
    )
    AND serveuse_id = (SELECT auth.uid())
    AND statut = 'en_attente'
  );

-- Comptoir can validate commandes in their establishment
CREATE POLICY "comptoir_validate_commandes"
  ON commandes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
      AND role = 'comptoir'
      AND actif = true
      AND etablissement_id = commandes.etablissement_id
    )
    AND statut = 'en_attente'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
      AND role = 'comptoir'
      AND actif = true
      AND etablissement_id = commandes.etablissement_id
    )
    AND statut IN ('validee', 'en_attente')
    AND validateur_id = (SELECT auth.uid())
  );

-- Prevent updates to validated commandes
CREATE POLICY "prevent_update_validated_commandes"
  ON commandes FOR UPDATE
  TO authenticated
  USING (statut != 'validee');

-- Serveuses can delete their own pending commandes
CREATE POLICY "serveuses_delete_own_pending_commandes"
  ON commandes FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
      AND role = 'serveuse'
      AND actif = true
      AND etablissement_id = commandes.etablissement_id
    )
    AND serveuse_id = (SELECT auth.uid())
    AND statut = 'en_attente'
  );

-- Prevent deletion of validated commandes
CREATE POLICY "prevent_delete_validated_commandes"
  ON commandes FOR DELETE
  TO authenticated
  USING (statut != 'validee');

-- ============================================================================
-- COMMANDE_ITEMS TABLE POLICIES (Multi-Tenant)
-- ============================================================================

-- Users can read commande_items if they can read the commande
CREATE POLICY "users_read_commande_items"
  ON commande_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.commandes c
      JOIN public.profiles p ON p.id = (SELECT auth.uid())
      WHERE c.id = commande_items.commande_id
      AND c.etablissement_id = p.etablissement_id
      AND p.actif = true
      AND (
        (p.role = 'serveuse' AND c.serveuse_id = (SELECT auth.uid()))
        OR (p.role = 'comptoir' AND c.statut = 'en_attente')
        OR p.role IN ('gerant', 'patron')
      )
    )
  );

-- Serveuses can insert commande_items for their own pending commandes
CREATE POLICY "serveuses_insert_commande_items"
  ON commande_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.commandes c
      JOIN public.profiles p ON p.id = (SELECT auth.uid())
      WHERE c.id = commande_items.commande_id
      AND c.etablissement_id = p.etablissement_id
      AND c.serveuse_id = (SELECT auth.uid())
      AND c.statut = 'en_attente'
      AND p.role = 'serveuse'
      AND p.actif = true
    )
  );

-- Serveuses can update commande_items for their own pending commandes
CREATE POLICY "serveuses_update_commande_items"
  ON commande_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.commandes c
      JOIN public.profiles p ON p.id = (SELECT auth.uid())
      WHERE c.id = commande_items.commande_id
      AND c.etablissement_id = p.etablissement_id
      AND c.serveuse_id = (SELECT auth.uid())
      AND c.statut = 'en_attente'
      AND p.role = 'serveuse'
      AND p.actif = true
    )
  );

-- Serveuses can delete commande_items for their own pending commandes
CREATE POLICY "serveuses_delete_commande_items"
  ON commande_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.commandes c
      JOIN public.profiles p ON p.id = (SELECT auth.uid())
      WHERE c.id = commande_items.commande_id
      AND c.etablissement_id = p.etablissement_id
      AND c.serveuse_id = (SELECT auth.uid())
      AND c.statut = 'en_attente'
      AND p.role = 'serveuse'
      AND p.actif = true
    )
  );

-- Prevent modification of validated commande_items
CREATE POLICY "prevent_update_validated_commande_items"
  ON commande_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.commandes
      WHERE commandes.id = commande_items.commande_id
      AND commandes.statut != 'validee'
    )
  );

CREATE POLICY "prevent_delete_validated_commande_items"
  ON commande_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.commandes
      WHERE commandes.id = commande_items.commande_id
      AND commandes.statut != 'validee'
    )
  );

-- ============================================================================
-- MOUVEMENTS_STOCK TABLE POLICIES (Multi-Tenant)
-- ============================================================================

-- Everyone in establishment can read mouvements_stock
CREATE POLICY "users_read_establishment_mouvements_stock"
  ON mouvements_stock FOR SELECT
  TO authenticated
  USING (
    etablissement_id = (SELECT public.get_user_etablissement_id())
  );

-- Gerant and Patron can insert mouvements_stock for manual adjustments
CREATE POLICY "gerant_patron_insert_mouvements_stock"
  ON mouvements_stock FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('gerant', 'patron')
      AND actif = true
      AND etablissement_id = mouvements_stock.etablissement_id
    )
  );

-- ============================================================================
-- RAVITAILLEMENTS TABLE POLICIES (Multi-Tenant)
-- ============================================================================

-- Everyone in establishment can read ravitaillements
CREATE POLICY "users_read_establishment_ravitaillements"
  ON ravitaillements FOR SELECT
  TO authenticated
  USING (
    etablissement_id = (SELECT public.get_user_etablissement_id())
  );

-- Gerant and Patron can insert ravitaillements in their establishment
CREATE POLICY "gerant_patron_insert_ravitaillements"
  ON ravitaillements FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('gerant', 'patron')
      AND actif = true
      AND etablissement_id = ravitaillements.etablissement_id
    )
    AND gerant_id = (SELECT auth.uid())
  );

-- ============================================================================
-- RAVITAILLEMENT_ITEMS TABLE POLICIES (Multi-Tenant)
-- ============================================================================

-- Users can read ravitaillement_items if they can read the ravitaillement
CREATE POLICY "users_read_ravitaillement_items"
  ON ravitaillement_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ravitaillements r
      WHERE r.id = ravitaillement_items.ravitaillement_id
      AND r.etablissement_id = (SELECT public.get_user_etablissement_id())
    )
  );

-- Gerant and Patron can insert ravitaillement_items
CREATE POLICY "gerant_patron_insert_ravitaillement_items"
  ON ravitaillement_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ravitaillements r
      JOIN public.profiles p ON p.id = (SELECT auth.uid())
      WHERE r.id = ravitaillement_items.ravitaillement_id
      AND r.etablissement_id = p.etablissement_id
      AND r.gerant_id = (SELECT auth.uid())
      AND p.role IN ('gerant', 'patron')
      AND p.actif = true
    )
  );

-- ============================================================================
-- FACTURES TABLE POLICIES (Multi-Tenant)
-- ============================================================================

-- Comptoir, Gerant, and Patron can read all factures in their establishment
CREATE POLICY "comptoir_read_establishment_factures"
  ON factures FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('comptoir', 'gerant', 'patron')
      AND actif = true
      AND etablissement_id = factures.etablissement_id
    )
  );

-- Serveuses can read factures for their own commandes
CREATE POLICY "serveuses_read_own_factures"
  ON factures FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.commandes c
      JOIN public.profiles p ON p.id = (SELECT auth.uid())
      WHERE c.id = factures.commande_id
      AND c.etablissement_id = p.etablissement_id
      AND c.serveuse_id = (SELECT auth.uid())
      AND p.role = 'serveuse'
      AND p.actif = true
    )
  );

-- ============================================================================
-- ENCAISSEMENTS TABLE POLICIES (Multi-Tenant)
-- ============================================================================

-- Comptoir, Gerant, and Patron can read all encaissements in their establishment
CREATE POLICY "comptoir_read_establishment_encaissements"
  ON encaissements FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('comptoir', 'gerant', 'patron')
      AND actif = true
      AND etablissement_id = encaissements.etablissement_id
    )
  );

-- Comptoir can insert encaissements in their establishment
CREATE POLICY "comptoir_insert_encaissements"
  ON encaissements FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('comptoir', 'gerant', 'patron')
      AND actif = true
      AND etablissement_id = encaissements.etablissement_id
    )
    AND utilisateur_id = (SELECT auth.uid())
  );

-- ============================================================================
-- AUDIT_LOGS TABLE POLICIES (Multi-Tenant)
-- ============================================================================

-- Patron can read audit logs for their establishment
CREATE POLICY "patron_read_establishment_audit_logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
      AND role = 'patron'
      AND actif = true
      AND etablissement_id = audit_logs.etablissement_id
    )
  );

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON POLICY "users_read_own_profile" ON profiles IS 
'Multi-tenant: Users can view their own profile';

COMMENT ON POLICY "patron_read_establishment_profiles" ON profiles IS 
'Multi-tenant: Patron can view all profiles in their establishment';

COMMENT ON POLICY "prevent_etablissement_id_modification" ON profiles IS 
'Requirement 8.7: Users cannot modify their own etablissement_id';

COMMENT ON POLICY "serveuses_read_available_products" ON produits IS 
'Multi-tenant: Serveuses see only available products in their establishment';

COMMENT ON POLICY "users_read_establishment_stock" ON stock IS 
'Multi-tenant: Users can only read stock from their establishment';

COMMENT ON POLICY "serveuses_read_own_commandes" ON commandes IS 
'Multi-tenant: Serveuses see only their own commandes in their establishment';

COMMENT ON POLICY "comptoir_validate_commandes" ON commandes IS 
'Multi-tenant: Comptoir can validate commandes in their establishment';

COMMENT ON POLICY "patron_read_establishment_audit_logs" ON audit_logs IS 
'Multi-tenant: Patron can view audit logs for their establishment only';
