-- Migration: Fix handle_new_user trigger and patron RLS policies
-- Description: Fixes for user creation and access control

-- ============================================================================
-- PART 1: Update handle_new_user trigger to set etablissement_id
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nom, prenom, role, actif, etablissement_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nom', 'Non renseigné'),
    COALESCE(NEW.raw_user_meta_data->>'prenom', 'Non renseigné'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'serveuse'),
    TRUE,
    NEW.raw_user_meta_data->>'etablissement_id'::uuid
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PART 2: Allow patrons to read profiles in their establishment
-- ============================================================================

DROP POLICY IF EXISTS "patron_read_establishment_profiles" ON profiles;

CREATE POLICY "patron_read_establishment_profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'patron'
      AND p.actif = true
      AND p.etablissement_id = profiles.etablissement_id
    )
  );

-- ============================================================================
-- PART 3: Allow patrons to create staff profiles in their establishment
-- Note: User creation should be handled by the frontend using supabase.auth.admin.createUser()
-- This policy allows the patron to insert profile records directly (after user is created in auth)
-- ============================================================================

DROP POLICY IF EXISTS "patron_insert_establishment_profiles" ON profiles;

CREATE POLICY "patron_insert_establishment_profiles"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    -- User can always insert their own profile (during signup)
    id = (SELECT auth.uid())
    OR (
      -- Or patron can create staff profiles in their establishment
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = (SELECT auth.uid())
        AND p.role = 'patron'
        AND p.actif = true
      )
      AND (
        -- The new profile's etablissement_id must match the patron's etablissement_id
        SELECT p.etablissement_id FROM public.profiles p WHERE p.id = (SELECT auth.uid())
      ) = profiles.etablissement_id
    )
  );

-- ============================================================================
-- PART 4: Fix mouvements_stock insertion for manual adjustments
-- ============================================================================

DROP POLICY IF EXISTS "gerant_patron_insert_mouvements_stock" ON mouvements_stock;

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
    AND mouvements_stock.etablissement_id IS NOT NULL
  );

COMMENT ON POLICY "gerant_patron_insert_mouvements_stock" ON mouvements_stock IS 
'Multi-tenant: Gerant and Patron can insert stock movements in their establishment';

-- ============================================================================
-- SUMMARY
-- ============================================================================

-- The main fixes applied:
-- 1. handle_new_user now sets etablissement_id from raw_user_meta_data
-- 2. patron_read_establishment_profiles - allow patron to see staff
-- 3. patron_insert_establishment_profiles - allow patron to create staff profiles
-- 4. mouvements_stock RLS policy validated

-- IMPORTANT: User creation should be handled by the frontend app
-- using supabase.auth.admin.createUser() with service role or admin privileges
-- The patron_invite_staff function should be implemented as an Edge Function instead
