-- Script to create a valid Serveuse account following multi-tenant platform rules
-- 1. Updates the profile creation trigger to support etablissement_id
-- 2. Creates a new user 'serveuse_new@snackbar.cm' linked to the first available establishment

-- Enable pgcrypto for password hashing if not available
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- 1. UPDATE TRIGGER FUNCTION
-- ============================================================================
-- We update this function to extract etablissement_id from user metadata
-- This ensures the profile is correctly linked to the establishment upon creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_etablissement_id UUID;
BEGIN
  -- Try to get etablissement_id from metadata
  IF NEW.raw_user_meta_data->>'etablissement_id' IS NOT NULL THEN
    v_etablissement_id := (NEW.raw_user_meta_data->>'etablissement_id')::UUID;
  END IF;

  INSERT INTO public.profiles (id, nom, prenom, role, etablissement_id, actif)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nom', 'Non renseigné'),
    COALESCE(NEW.raw_user_meta_data->>'prenom', 'Non renseigné'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'serveuse'),
    v_etablissement_id,
    TRUE
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 2. CREATE VALID SERVEUSE ACCOUNT
-- ============================================================================
DO $$
DECLARE
  v_etablissement_id UUID;
  v_user_id UUID;
  v_email TEXT := 'serveuse_new@snackbar.cm';
  v_password TEXT := 'password123';
BEGIN
  -- Get the first establishment (usually 'Établissement Principal')
  SELECT id INTO v_etablissement_id FROM public.etablissements LIMIT 1;
  
  IF v_etablissement_id IS NULL THEN
    RAISE EXCEPTION 'No establishment found. Please create an establishment first.';
  END IF;

  RAISE NOTICE 'Using establishment ID: %', v_etablissement_id;

  -- Check if user already exists
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
  
  IF v_user_id IS NOT NULL THEN
    -- Delete existing user and profile to recreate cleanly (for testing)
    DELETE FROM public.profiles WHERE id = v_user_id;
    DELETE FROM auth.users WHERE id = v_user_id;
    RAISE NOTICE 'Deleted existing user %', v_email;
  END IF;

  -- Create new user in auth.users
  -- We inject etablissement_id into raw_user_meta_data so the trigger picks it up
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
    updated_at,
    confirmation_token,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    v_email,
    crypt(v_password, gen_salt('bf')),
    NOW(),
    '{"provider": "email", "providers": ["email"]}',
    jsonb_build_object(
      'nom', 'Serveuse',
      'prenom', 'Nouvelle',
      'role', 'serveuse',
      'etablissement_id', v_etablissement_id
    ),
    NOW(),
    NOW(),
    '',
    ''
  ) RETURNING id INTO v_user_id;

  RAISE NOTICE 'Created valid serveuse user % with establishment ID %', v_email, v_etablissement_id;

END $$;
