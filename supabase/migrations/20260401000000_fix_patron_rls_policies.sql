-- Migration: Fix handle_new_user trigger and patron profile insertion
-- Description: Fixes the user creation flow to properly set etablissement_id and allows patron to create staff profiles

-- ============================================================================
-- FIX 1: Update handle_new_user trigger to set etablissement_id
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
-- FIX 2: Create function for patron to invite staff members
-- Uses existing admin_create_user with proper etablissement_id
-- ============================================================================

CREATE OR REPLACE FUNCTION public.patron_invite_staff(
  p_email TEXT,
  p_password TEXT,
  p_role TEXT,
  p_nom TEXT,
  p_prenom TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_user_id UUID;
  caller_etablissement_id UUID;
  caller_role TEXT;
BEGIN
  -- Get the caller's profile
  SELECT p.etablissement_id, p.role INTO caller_etablissement_id, caller_role
  FROM public.profiles p
  WHERE p.id = auth.uid();
  
  -- Verify caller is a patron
  IF caller_role != 'patron' THEN
    RAISE EXCEPTION 'Accès refusé. Seul le patron peut inviter des membres du personnel.';
  END IF;
  
  -- Verify caller has an establishment
  IF caller_etablissement_id IS NULL THEN
    RAISE EXCEPTION 'Votre compte n''est lié à aucun établissement.';
  END IF;
  
  -- Validate role
  IF p_role NOT IN ('serveuse', 'comptoir', 'gerant') THEN
    RAISE EXCEPTION 'Rôle invalide. Les rôles autorisés sont: serveuse, comptoir, gerant';
  END IF;
  
  -- Check if user already exists
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) THEN
    RAISE EXCEPTION 'Un utilisateur avec cet email existe déjà.';
  END IF;
  
  -- Call existing admin_create_user function which handles auth.users properly
  -- This function uses SECURITY DEFINER so it has elevated privileges
  new_user_id := public.admin_create_user(
    p_email,
    p_password,
    p_role,
    caller_etablissement_id,
    p_nom,
    p_prenom
  );
  
  RETURN new_user_id;
EXCEPTION
  WHEN duplicate_object THEN
    RAISE EXCEPTION 'Un utilisateur avec cet email existe déjà.';
END;
$$;

COMMENT ON FUNCTION public.patron_invite_staff IS 'Allows patron to invite staff members to their establishment';

-- ============================================================================
-- FIX 3: Allow patrons to create profiles in their establishment
-- ============================================================================

DROP POLICY IF EXISTS "patron_insert_establishment_profiles" ON profiles;

CREATE POLICY "patron_insert_establishment_profiles"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    id = (SELECT auth.uid())
    OR (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = (SELECT auth.uid())
        AND p.role = 'patron'
        AND p.actif = true
        AND p.etablissement_id = profiles.etablissement_id
      )
      AND profiles.etablissement_id IS NOT NULL
      AND profiles.etablissement_id = (SELECT p.etablissement_id FROM public.profiles p WHERE p.id = (SELECT auth.uid()))
    )
  );

-- ============================================================================
-- FIX 4: Fix mouvements_stock insertion for manual adjustments
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
-- 2. patron_invite_staff uses existing admin_create_user function
-- 3. patron_insert_establishment_profiles policy validated
-- 4. mouvements_stock RLS policy validated
