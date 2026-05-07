-- Migration: Fix RLS for retour_items_en_attente - allow comptoir to read
-- Description: The comptoir role could create pending returns but couldn't read them.
-- Also adds a policy for serveuse to read pending returns.
-- Created: 2026-04-13

-- ============================================================================
-- Ajouter une politique SELECT pour le comptoir
-- ============================================================================

DROP POLICY IF EXISTS "comptoir_read_own_pending_retours" ON retour_items_en_attente;

CREATE POLICY "comptoir_read_own_pending_retours"
  ON retour_items_en_attente FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'comptoir'
      AND p.actif = true
      AND p.etablissement_id = retour_items_en_attente.etablissement_id
    )
  );

-- ============================================================================
-- Ajouter une politique SELECT pour la serveuse (voir ses propres retours)
-- ============================================================================

DROP POLICY IF EXISTS "serveuse_read_own_pending_retours" ON retour_items_en_attente;

CREATE POLICY "serveuse_read_own_pending_retours"
  ON retour_items_en_attente FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'serveuse'
      AND p.actif = true
      AND p.etablissement_id = retour_items_en_attente.etablissement_id
    )
  );

-- ============================================================================
-- Commentaires
-- ============================================================================

COMMENT ON POLICY "comptoir_read_own_pending_retours" ON retour_items_en_attente IS
  'Le comptoir peut voir les retours en attente de son établissement.';
COMMENT ON POLICY "serveuse_read_own_pending_retours" ON retour_items_en_attente IS
  'La serveuse peut voir les retours en attente de son établissement.';
