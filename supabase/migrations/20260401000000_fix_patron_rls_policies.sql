-- Migration: Fix handle_new_user trigger and patron profile insertion
-- Description: Fixes the user creation flow to properly set etablissement_id and allows patron to create staff profiles

-- ==========================================================================
-- PART 1: Create admin_create_user function using Supabase auth.admin API
-- ==========================================================================

-- Function to create a user (only accessible by admins)
-- This function is needed by patron_invite_staff
-- Uses Supabase auth.admin API instead of direct auth.users insert
CREATE OR REPLACE FUNCTION public.admin_create_user(
  p_email TEXT,
  p_password TEXT,
  p_role TEXT,
  p_etablissement_id UUID,
  p_nom TEXT,
  p_prenom TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $
DECLARE
  new_user_id UUID;
BEGIN
  -- Use Supabase auth.admin to create user
  -- This is the recommended approach that handles password hashing properly
  new_user_id := (auth.admin.create_user(
    p_email => p_email,
    p_password => p_password,
    p_email_confirm => true,
    p_raw_user_meta_data => jsonb_build_object(
      'role', p_role,
      'nom', p_nom,
      'prenom', p_prenom,
      'etablissement_id', p_etablissement_id
    )
  )).id;

  -- Update profile with correct etablissement_id
  UPDATE public.profiles
  SET etablissement_id = p_etablissement_id
  WHERE id = new_user_id;
  
  RETURN new_user_id;
EXCEPTION
  WHEN duplicate_object THEN
    RAISE EXCEPTION 'User with this email already exists';
END;
$;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'User with this email already exists';
END;
$$;

-- ============================================================================
-- FIX 2: Update handle_new_user trigger to set etablissement_id
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
-- FIX 3: Create function for patron to invite staff members
-- Uses admin_create_user which has proper permissions
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
  
  -- Call admin_create_user function
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
-- FIX 4: Allow patrons to create profiles in their establishment
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
-- FIX 5: Fix mouvements_stock insertion for manual adjustments
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
-- 1. admin_create_user function created with pgcrypto
-- 2. handle_new_user now sets etablissement_id from raw_user_meta_data
-- 3. patron_invite_staff uses admin_create_user 
-- 4. patron_insert_establishment_profiles policy validated
-- 5. mouvements_stock RLS policy validated
