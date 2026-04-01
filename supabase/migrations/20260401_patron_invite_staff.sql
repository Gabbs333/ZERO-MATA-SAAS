-- Migration: Add database function for patron to invite staff
-- This function uses SECURITY DEFINER to run with elevated privileges

-- Create the function to invite staff members
-- This works by having the frontend use the anon key + calling via RPC
-- The function verifies the caller is a patron and creates the user

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
  
  -- Use auth.admin to create user (this works because of SECURITY DEFINER)
  -- We need to use the service role key via a different approach
  -- Since we can't directly access auth.admin from SQL, we'll create the user via trigger
  
  -- First, insert into a temp table or use a workaround
  -- Actually, we need to use a different approach - let's use the auth.users insert directly
  
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
    -- We'll set a temporary password that must be changed
    -- But actually we can't hash passwords in SQL easily
    -- So we'll use a different approach
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
  
  -- The trigger should automatically create the profile
  -- But we need to update it with the correct role and etablissement_id
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
$$;

-- Enable pgcrypto extension if not exists
CREATE EXTENSION IF NOT EXISTS pgcrypto;

COMMENT ON FUNCTION patron_invite_staff IS 'Permet au patron d''inviter des membres du personnel dans son établissement';
