-- Migration: Admin user management functions
-- Description: Functions for admin to manage users (requires service role key from frontend)
-- Note: Actual user creation is done via supabase.auth.admin.createUser() in the frontend
-- This file only contains helper functions that may be used with service role

-- ============================================================================
-- Function: Get caller profile info (used by other functions)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_caller_profile()
RETURNS TABLE(id UUID, email TEXT, nom TEXT, prenom TEXT, role TEXT, etablissement_id UUID, actif BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.email,
    p.nom,
    p.prenom,
    p.role,
    p.etablissement_id,
    p.actif
  FROM public.profiles p
  WHERE p.id = auth.uid();
END;
$$;

-- ============================================================================
-- Function: Verify if user is patron in their establishment
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_patron_in_establishment(p_etablissement_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_actif BOOLEAN;
  v_etablissement_id UUID;
BEGIN
  SELECT p.role, p.actif, p.etablissement_id 
  INTO v_role, v_actif, v_etablissement_id
  FROM public.profiles p
  WHERE p.id = auth.uid();
  
  RETURN (
    v_role = 'patron' 
    AND v_actif = true 
    AND v_etablissement_id = p_etablissement_id
  );
END;
$$;

COMMENT ON FUNCTION public.is_patron_in_establishment IS 'Checks if current user is an active patron for the given establishment';

-- ============================================================================
-- Function: Verify if user is admin
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT p.role INTO v_role
  FROM public.profiles p
  WHERE p.id = auth.uid();
  
  RETURN (v_role = 'admin');
END;
$$;

COMMENT ON FUNCTION public.is_admin IS 'Checks if current user has admin role';

-- ============================================================================
-- Function: Get all users in an establishment (for patron dashboard)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_establishment_users(p_etablissement_id UUID)
RETURNS TABLE(id UUID, email TEXT, nom TEXT, prenom TEXT, role TEXT, actif BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if caller is patron in this establishment
  IF NOT public.is_patron_in_establishment(p_etablissement_id) THEN
    RAISE EXCEPTION 'Accès refusé. Vous devez être le patron de cet établissement.';
  END IF;
  
  RETURN QUERY
  SELECT 
    p.id,
    p.email,
    p.nom,
    p.prenom,
    p.role,
    p.actif
  FROM public.profiles p
  WHERE p.etablissement_id = p_etablissement_id
  ORDER BY p.role, p.nom;
END;
$$;

COMMENT ON FUNCTION public.get_establishment_users IS 'Returns all users in an establishment (patron only)';

-- ============================================================================
-- NOTE: User creation should be handled by the frontend using supabase.auth.admin.createUser()
-- with service role key. The createUser function cannot be called directly from SQL in Supabase
-- because auth.admin is not accessible from within database functions.
-- ============================================================================
