-- ============================================================================
-- Migration: Storage Exports Bucket Configuration
-- Description: Creates storage bucket for exports with RLS policies
-- Requirements: 11.1, 11.2, 11.3
-- ============================================================================

-- Create the exports bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'exports',
  'exports',
  false, -- Private bucket
  52428800, -- 50 MB in bytes
  ARRAY['text/csv', 'application/pdf', 'application/vnd.ms-excel']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['text/csv', 'application/pdf', 'application/vnd.ms-excel'];

-- ============================================================================
-- RLS Policies for Storage Bucket
-- ============================================================================

-- Note: RLS is already enabled on storage.objects by Supabase

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "patron_gerant_can_upload_exports" ON storage.objects;
DROP POLICY IF EXISTS "patron_gerant_can_read_exports" ON storage.objects;
DROP POLICY IF EXISTS "patron_gerant_can_update_exports" ON storage.objects;
DROP POLICY IF EXISTS "patron_gerant_can_delete_exports" ON storage.objects;

-- Policy: Only patron/gerant can upload files to exports bucket
CREATE POLICY "patron_gerant_can_upload_exports"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'exports'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('patron', 'gerant')
      AND actif = true
    )
  );

-- Policy: Only patron/gerant can read files from exports bucket
CREATE POLICY "patron_gerant_can_read_exports"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'exports'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('patron', 'gerant')
      AND actif = true
    )
  );

-- Policy: Only patron/gerant can update files in exports bucket
CREATE POLICY "patron_gerant_can_update_exports"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'exports'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('patron', 'gerant')
      AND actif = true
    )
  )
  WITH CHECK (
    bucket_id = 'exports'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('patron', 'gerant')
      AND actif = true
    )
  );

-- Policy: Only patron/gerant can delete files from exports bucket
CREATE POLICY "patron_gerant_can_delete_exports"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'exports'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('patron', 'gerant')
      AND actif = true
    )
  );

-- ============================================================================
-- Automatic Cleanup Function (30 days retention)
-- ============================================================================

-- Function to delete old export files
CREATE OR REPLACE FUNCTION cleanup_old_exports()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM storage.objects
  WHERE bucket_id = 'exports'
  AND created_at < NOW() - INTERVAL '30 days';
END;
$$;

-- Note: The cleanup function should be called periodically via a cron job
-- or scheduled task. In Supabase, this can be done using pg_cron extension
-- or via an Edge Function triggered by a scheduled webhook.

COMMENT ON FUNCTION cleanup_old_exports() IS 'Deletes export files older than 30 days from the exports bucket';


-- ============================================================================
-- Automatic Cleanup Function (30 days retention)
-- ============================================================================

-- Function to delete old export files
CREATE OR REPLACE FUNCTION cleanup_old_exports()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM storage.objects
  WHERE bucket_id = 'exports'
  AND created_at < NOW() - INTERVAL '30 days';
END;
$$;

COMMENT ON FUNCTION cleanup_old_exports() IS 'Deletes export files older than 30 days from the exports bucket';

-- Note: The cleanup function should be called periodically via a cron job
-- or scheduled task. In Supabase, this can be done using pg_cron extension
-- or via an Edge Function triggered by a scheduled webhook.
