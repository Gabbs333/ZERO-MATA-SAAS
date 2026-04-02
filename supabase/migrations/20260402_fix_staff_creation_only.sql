-- Migration: Fix staff creation for patron
-- Only fixes the user creation issue - stock already works!
-- Created: 2026-04-02

-- ============================================================================
-- PART 1: Create get_user_etablissement_id function if it doesn't exist
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
-- PART 2: Enable pgcrypto extension (needed for password hashing)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- PART 3: Fix patron_invite_staff function for staff creation
-- ============================================================================

-- Drop the existing function first to avoid the return type error
DROP FUNCTION IF EXISTS patron_invite_staff(TEXT, TEXT, TEXT, TEXT, TEXT);

-- Create the function to invite staff members
-- Uses SECURITY DEFINER to run with elevated privileges
CREATE OR REPLACE FUNCTION patron_invite_staff(
  p_email TEXT,
  p_password TEXT,
  p_role TEXT,
  p_nom TEXT,
  p_prenom TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_profile RECORD;
  v_new_user_id UUID;
  v_etablissement_id UUID;
BEGIN
  -- Get the caller's ID from the JWT
  v_caller_id := auth.uid();
  
  -- If no caller, return error
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Vous devez être connecté pour inviter des membres du personnel.';
  END IF;
  
  -- Get the caller's profile
  SELECT * INTO v_caller_profile 
  FROM profiles 
  WHERE id = v_caller_id;
  
  -- Check if profile exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profil non trouvé. Veuillez vous reconnecter.';
  END IF;
  
  -- Check if caller is patron
  IF v_caller_profile.role <> 'patron' THEN
    RAISE EXCEPTION 'Accès refusé. Seul le patron peut inviter des membres du personnel. Votre rôle: %', v_caller_profile.role;
  END IF;
  
  -- Check if account is active
  IF v_caller_profile.actif <> true THEN
    RAISE EXCEPTION 'Votre compte est désactivé.';
  END IF;
  
  -- Get establishment ID
  v_etablissement_id := v_caller_profile.etablissement_id;
  
  IF v_etablissement_id IS NULL THEN
    RAISE EXCEPTION 'Votre compte n''est lié à aucun établissement.';
  END IF;
  
  -- Validate role
  IF p_role NOT IN ('serveuse', 'comptoir', 'gerant') THEN
    RAISE EXCEPTION 'Rôle invalide. Les rôles autorisés sont: serveuse, comptoir, gerant';
  END IF;
  
  -- Check if email already exists in auth.users
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) THEN
    RAISE EXCEPTION 'Un utilisateur avec cet email existe déjà.';
  END IF;
  
  -- Create user in auth.users
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    p_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object(
      'role', p_role,
      'nom', p_nom,
      'prenom', p_prenom,
      'etablissement_id', v_etablissement_id
    ),
    now(),
    now()
  )
  RETURNING id INTO v_new_user_id;
  
  -- Update the profile with the correct role and etablissement_id
  UPDATE profiles
  SET role = p_role,
      nom = p_nom,
      prenom = p_prenom,
      etablissement_id = v_etablissement_id,
      actif = true
  WHERE id = v_new_user_id;
  
  RETURN 'Membre du personnel créé avec succès!';
  
EXCEPTION
  WHEN duplicate_object THEN
    RAISE EXCEPTION 'Un utilisateur avec cet email existe déjà.';
  WHEN others THEN
    RAISE EXCEPTION 'Erreur: %', SQLERRM;
END;
$;

COMMENT ON FUNCTION patron_invite_staff IS 'Permet au patron d''inviter des membres du personnel dans son établissement';

-- ============================================================================
-- PART 3: Ensure patron can read profiles in their establishment
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
-- PART 4: Ensure patron can insert profiles in their establishment
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