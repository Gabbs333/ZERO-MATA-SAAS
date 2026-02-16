-- Migration: Allow serveuses to read their own factures
-- Description: Adds RLS policy for serveuses to view factures linked to their commandes.

-- Policy: Les serveuses peuvent lire les factures de leurs propres commandes
CREATE POLICY "serveuses_read_own_factures" ON factures
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM commandes
      WHERE commandes.id = factures.commande_id
      AND commandes.serveuse_id = auth.uid()
    )
  );
