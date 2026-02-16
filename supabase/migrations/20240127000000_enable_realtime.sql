-- ============================================================================
-- Migration: Enable Realtime on Critical Tables
-- Description: Configures Realtime publications for real-time synchronization
-- Requirements: 6.1, 6.2, 6.3, 1.2, 2.5
-- ============================================================================

-- Note: Supabase Realtime uses PostgreSQL's logical replication feature.
-- By default, Supabase creates a publication called "supabase_realtime" that
-- includes all tables. We need to ensure our critical tables are included.

-- ============================================================================
-- Enable Realtime for Critical Tables
-- ============================================================================

-- The following tables need real-time synchronization:
-- 1. commandes - For order creation and validation notifications
-- 2. stock - For inventory updates
-- 3. factures - For invoice generation notifications
-- 4. encaissements - For payment notifications
-- 5. tables - For table status updates
-- 6. ravitaillements - For supply notifications

-- Check if publication exists, if not create it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

-- Add tables to the publication
-- Note: In Supabase, you typically enable Realtime via the Dashboard,
-- but this ensures the publication includes our tables

ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS commandes;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS stock;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS factures;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS encaissements;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS tables;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS ravitaillements;

-- Optional: Add related tables for complete context
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS commande_items;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS ravitaillement_items;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS mouvements_stock;

-- ============================================================================
-- Configure Replica Identity for Realtime
-- ============================================================================

-- Set REPLICA IDENTITY to FULL for tables that need complete row data in updates
-- This allows Realtime to send the full row data (old and new values) on UPDATE

ALTER TABLE commandes REPLICA IDENTITY FULL;
ALTER TABLE stock REPLICA IDENTITY FULL;
ALTER TABLE factures REPLICA IDENTITY FULL;
ALTER TABLE encaissements REPLICA IDENTITY FULL;
ALTER TABLE tables REPLICA IDENTITY FULL;
ALTER TABLE ravitaillements REPLICA IDENTITY FULL;
ALTER TABLE commande_items REPLICA IDENTITY FULL;
ALTER TABLE ravitaillement_items REPLICA IDENTITY FULL;
ALTER TABLE mouvements_stock REPLICA IDENTITY FULL;

-- ============================================================================
-- Comments and Documentation
-- ============================================================================

COMMENT ON PUBLICATION supabase_realtime IS 'Publication for Supabase Realtime synchronization of critical tables';

-- ============================================================================
-- Verification Query
-- ============================================================================

-- To verify which tables are in the publication, run:
-- SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

-- To verify replica identity settings, run:
-- SELECT schemaname, tablename, relreplident 
-- FROM pg_class c 
-- JOIN pg_namespace n ON n.oid = c.relnamespace 
-- WHERE relkind = 'r' AND nspname = 'public';
-- (relreplident: 'd' = default, 'f' = full, 'i' = index, 'n' = nothing)
