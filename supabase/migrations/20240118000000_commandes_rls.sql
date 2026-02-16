-- Migration: Row Level Security for Commandes and Commande Items
-- Description: Implements RLS policies for order management
-- Requirements: 1.1, 1.3, 2.1, 2.2, 8.3, 9.5

-- ============================================================================
-- ENABLE RLS
-- ============================================================================

ALTER TABLE commandes ENABLE ROW LEVEL SECURITY;
ALTER TABLE commande_items ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- COMMANDES POLICIES
-- ============================================================================

-- Policy: Les serveuses peuvent créer des commandes
CREATE POLICY "serveuses_create_commandes" ON commandes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'serveuse'
      AND profiles.actif = true
    )
    AND serveuse_id = auth.uid()
    AND statut = 'en_attente'
  );

-- Policy: Les serveuses voient uniquement leurs propres commandes
CREATE POLICY "serveuses_read_own_commandes" ON commandes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'serveuse'
      AND profiles.actif = true
    )
    AND serveuse_id = auth.uid()
  );

-- Policy: Le comptoir voit toutes les commandes en attente
CREATE POLICY "comptoir_read_pending_commandes" ON commandes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'comptoir'
      AND profiles.actif = true
    )
    AND statut = 'en_attente'
  );

-- Policy: Le comptoir peut valider les commandes en attente
CREATE POLICY "comptoir_validate_commandes" ON commandes
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'comptoir'
      AND profiles.actif = true
    )
    AND statut = 'en_attente'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'comptoir'
      AND profiles.actif = true
    )
    AND statut IN ('validee', 'en_attente')
    AND validateur_id = auth.uid()
  );

-- Policy: Le patron/gérant voit toutes les commandes
CREATE POLICY "patron_gerant_read_all_commandes" ON commandes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('patron', 'gerant')
      AND profiles.actif = true
    )
  );

-- Policy: Les commandes validées sont immuables (pas de UPDATE/DELETE)
-- This is enforced by preventing updates when statut = 'validee'
CREATE POLICY "prevent_update_validated_commandes" ON commandes
  FOR UPDATE
  TO authenticated
  USING (
    statut != 'validee'
  );

CREATE POLICY "prevent_delete_validated_commandes" ON commandes
  FOR DELETE
  TO authenticated
  USING (
    statut != 'validee'
  );

-- Policy: Les serveuses peuvent annuler leurs propres commandes non soumises
CREATE POLICY "serveuses_delete_own_pending_commandes" ON commandes
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'serveuse'
      AND profiles.actif = true
    )
    AND serveuse_id = auth.uid()
    AND statut = 'en_attente'
  );

-- ============================================================================
-- COMMANDE_ITEMS POLICIES
-- ============================================================================

-- Policy: Les serveuses peuvent créer des items pour leurs commandes
CREATE POLICY "serveuses_create_commande_items" ON commande_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM commandes
      JOIN profiles ON profiles.id = auth.uid()
      WHERE commandes.id = commande_items.commande_id
      AND commandes.serveuse_id = auth.uid()
      AND commandes.statut = 'en_attente'
      AND profiles.role = 'serveuse'
      AND profiles.actif = true
    )
  );

-- Policy: Les utilisateurs peuvent lire les items des commandes qu'ils peuvent voir
CREATE POLICY "read_commande_items" ON commande_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM commandes
      JOIN profiles ON profiles.id = auth.uid()
      WHERE commandes.id = commande_items.commande_id
      AND profiles.actif = true
      AND (
        -- Serveuse voit ses propres commandes
        (profiles.role = 'serveuse' AND commandes.serveuse_id = auth.uid())
        -- Comptoir voit les commandes en attente
        OR (profiles.role = 'comptoir' AND commandes.statut = 'en_attente')
        -- Patron/gérant voit tout
        OR profiles.role IN ('patron', 'gerant')
      )
    )
  );

-- Policy: Les serveuses peuvent modifier les items de leurs commandes en attente
CREATE POLICY "serveuses_update_commande_items" ON commande_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM commandes
      JOIN profiles ON profiles.id = auth.uid()
      WHERE commandes.id = commande_items.commande_id
      AND commandes.serveuse_id = auth.uid()
      AND commandes.statut = 'en_attente'
      AND profiles.role = 'serveuse'
      AND profiles.actif = true
    )
  );

-- Policy: Les serveuses peuvent supprimer les items de leurs commandes en attente
CREATE POLICY "serveuses_delete_commande_items" ON commande_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM commandes
      JOIN profiles ON profiles.id = auth.uid()
      WHERE commandes.id = commande_items.commande_id
      AND commandes.serveuse_id = auth.uid()
      AND commandes.statut = 'en_attente'
      AND profiles.role = 'serveuse'
      AND profiles.actif = true
    )
  );

-- Policy: Empêcher la modification des items de commandes validées
CREATE POLICY "prevent_update_validated_commande_items" ON commande_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM commandes
      WHERE commandes.id = commande_items.commande_id
      AND commandes.statut != 'validee'
    )
  );

CREATE POLICY "prevent_delete_validated_commande_items" ON commande_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM commandes
      WHERE commandes.id = commande_items.commande_id
      AND commandes.statut != 'validee'
    )
  );
