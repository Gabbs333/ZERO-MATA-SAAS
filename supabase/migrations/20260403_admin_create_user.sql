-- Migration: Create admin_create_user RPC function
-- Description: Allows admin to create users with profiles from the admin app

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION admin_create_user(
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
AS $$
DECLARE
  v_new_user_id UUID;
BEGIN
  -- Validate role
  IF p_role NOT IN ('serveuse', 'comptoir', 'gerant', 'patron') THEN
    RAISE EXCEPTION 'Rôle invalide. Les rôles autorisés sont: serveuse, comptoir, gerant, patron';
  END IF;

  -- Check if email already exists in auth.users
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) THEN
    RAISE EXCEPTION 'Un utilisateur avec cet email existe déjà.';
  END IF;

  -- Generate a new UUID for the user
  v_new_user_id := gen_random_uuid();

  -- Insert into auth.users directly
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
    confirmation_token
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_new_user_id,
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
      'etablissement_id', p_etablissement_id
    ),
    now(),
    now(),
    ''
  );

  -- The trigger handle_new_user should automatically create the profile
  -- But we need to update it with the correct role and etablissement_id
  UPDATE profiles
  SET role = p_role,
      nom = p_nom,
      prenom = p_prenom,
      etablissement_id = p_etablissement_id,
      actif = true
  WHERE id = v_new_user_id;

  RETURN v_new_user_id;

EXCEPTION
  WHEN duplicate_object THEN
    RAISE EXCEPTION 'Un utilisateur avec cet email existe déjà.';
  WHEN others THEN
    RAISE EXCEPTION 'Erreur: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION admin_create_user IS 'Permet à un administrateur de créer un utilisateur avec un profil dans le système';
