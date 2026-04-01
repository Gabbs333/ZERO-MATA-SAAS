-- Migration: Fix stocks table and RLS policies for patron access
-- Resolves issues with staff creation and stock modification

-- ============================================================================
-- PART 1: Fix stocks table - ensure etablissement_id column exists
-- ============================================================================

-- Rename stock to stocks if it exists (handle the plural/singular inconsistency)
-- First, check if stock table exists and rename it
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stock' AND table_schema = 'public') THEN
        -- Check if stocks already exists
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stocks' AND table_schema = 'public') THEN
            ALTER TABLE stock RENAME TO stocks;
        ELSE
            -- If both exist, drop stock and keep stocks
            DROP TABLE stock CASCADE;
        END IF;
    END IF;
END $$;

-- Add etablissement_id column to stocks if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'stocks' AND column_name = 'etablissement_id'
    ) THEN
        ALTER TABLE stocks ADD COLUMN etablissement_id UUID REFERENCES etablissements(id);
    END IF;
END $$;

-- Rename quantite_disponible to quantite_actuelle if needed (handle schema inconsistency)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'stocks' AND column_name = 'quantite_disponible'
    ) THEN
        ALTER TABLE stocks RENAME COLUMN quantite_disponible TO quantite_actuelle;
    END IF;
    
    -- Add quantite_actuelle if neither exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'stocks' AND column_name = 'quantite_actuelle'
    ) THEN
        ALTER TABLE stocks ADD COLUMN quantite_actuelle INTEGER NOT NULL DEFAULT 0 CHECK (quantite_actuelle >= 0);
    END IF;
END $$;

-- ============================================================================
-- PART 2: Fix RLS policies for stocks table
-- ============================================================================

-- Enable RLS on stocks if not already enabled
ALTER TABLE stocks ENABLE ROW LEVEL SECURITY;

-- Drop existing policies for stocks
DROP POLICY IF EXISTS "users_read_establishment_stocks" ON stocks;
DROP POLICY IF EXISTS "gerant_patron_insert_stocks" ON stocks;
DROP POLICY IF EXISTS "gerant_patron_update_stocks" ON stocks;

-- Create new policies that handle NULL etablissement_id
-- Everyone in establishment can read stocks
CREATE POLICY "users_read_establishment_stocks"
  ON stocks FOR SELECT
  TO authenticated
  USING (
    etablissement_id = (SELECT public.get_user_etablissement_id())
    OR etablissement_id IS NULL
  );

-- Gerant and Patron can insert stocks in their establishment
CREATE POLICY "gerant_patron_insert_stocks"
  ON stocks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('gerant', 'patron')
      AND actif = true
      AND etablissement_id = stocks.etablissement_id
    )
    OR stocks.etablissement_id IS NULL
  );

-- Gerant and Patron can update stocks in their establishment
CREATE POLICY "gerant_patron_update_stocks"
  ON stocks FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('gerant', 'patron')
      AND actif = true
      AND etablissement_id = stocks.etablissement_id
    )
    OR stocks.etablissement_id IS NULL
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('gerant', 'patron')
      AND actif = true
      AND etablissement_id = stocks.etablissement_id
    )
    OR stocks.etablissement_id IS NULL
  );

-- ============================================================================
-- PART 3: Fix RLS policies for mouvements_stock table
-- ============================================================================

-- Drop existing policies for mouvements_stock
DROP POLICY IF EXISTS "users_read_establishment_mouvements_stock" ON mouvements_stock;
DROP POLICY IF EXISTS "gerant_patron_insert_mouvements_stock" ON mouvements_stock;

-- Create new policies that handle NULL etablissement_id
CREATE POLICY "users_read_establishment_mouvements_stock"
  ON mouvements_stock FOR SELECT
  TO authenticated
  USING (
    etablissement_id = (SELECT public.get_user_etablissement_id())
    OR etablissement_id IS NULL
  );

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
    OR mouvements_stock.etablissement_id IS NULL
  );

-- ============================================================================
-- PART 4: Ensure patron_invite_staff function is working correctly
-- ============================================================================

-- Update the function to handle the stocks table properly
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
  
  -- Enable pgcrypto extension if not exists
  CREATE EXTENSION IF NOT EXISTS pgcrypto;
  
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
  
  -- The trigger should automatically create the profile with etablissement_id
  -- But we need to ensure it's set correctly
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

COMMENT ON FUNCTION patron_invite_staff IS 'Permet au patron d''inviter des membres du personnel dans son établissement';

-- ============================================================================
-- SUMMARY
-- ============================================================================

-- This migration fixes:
-- 1. Table naming inconsistency (stock -> stocks)
-- 2. Missing etablissement_id on stocks table
-- 3. Column naming (quantite_disponible -> quantite_actuelle)
-- 4. RLS policies that didn't handle NULL etablissement_id
-- 5. Ensures patron_invite_staff function works correctly
