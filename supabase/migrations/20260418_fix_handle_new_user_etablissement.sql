-- Migration: Fix handle_new_user trigger, RLS policies, and repair missing profiles
-- Description: Solves 'cannot coerce the result to a single json object' error during login
-- and prevents HTTP 500 errors during user creation.

-- ============================================================================
-- 1. ENSURE RLS POLICIES FOR PROFILES TABLE
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own profile
DROP POLICY IF EXISTS "users_read_own_profile" ON public.profiles;
CREATE POLICY "users_read_own_profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Allow users to insert/update their own profile if missing
DROP POLICY IF EXISTS "users_insert_own_profile" ON public.profiles;
CREATE POLICY "users_insert_own_profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "users_update_own_profile" ON public.profiles;
CREATE POLICY "users_update_own_profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ============================================================================
-- 2. FIX handle_new_user TRIGGER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT;
  v_nom TEXT;
  v_prenom TEXT;
  v_etablissement_id UUID;
BEGIN
  -- Extract user metadata
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'serveuse');
  v_nom := COALESCE(NEW.raw_user_meta_data->>'nom', 'Non renseigné');
  v_prenom := COALESCE(NEW.raw_user_meta_data->>'prenom', 'Non renseigné');

  -- Parse etablissement_id from user metadata if provided
  IF NEW.raw_user_meta_data->>'etablissement_id' IS NOT NULL THEN
    BEGIN
      v_etablissement_id := (NEW.raw_user_meta_data->>'etablissement_id')::UUID;
    EXCEPTION WHEN others THEN
      v_etablissement_id := NULL;
    END;
  END IF;

  -- Enforce constraint: Non-admin users MUST have a non-null etablissement_id
  IF v_role <> 'admin' AND v_etablissement_id IS NULL THEN
    SELECT id INTO v_etablissement_id FROM public.etablissements LIMIT 1;
  END IF;

  -- Enforce constraint: Admin users MUST have a NULL etablissement_id
  IF v_role = 'admin' THEN
    v_etablissement_id := NULL;
  END IF;

  -- Safe insertion into public.profiles
  BEGIN
    INSERT INTO public.profiles (id, nom, prenom, role, etablissement_id, actif)
    VALUES (
      NEW.id,
      v_nom,
      v_prenom,
      v_role,
      v_etablissement_id,
      TRUE
    )
    ON CONFLICT (id) DO UPDATE SET
      etablissement_id = COALESCE(EXCLUDED.etablissement_id, profiles.etablissement_id),
      role = COALESCE(EXCLUDED.role, profiles.role),
      nom = COALESCE(EXCLUDED.nom, profiles.nom),
      prenom = COALESCE(EXCLUDED.prenom, profiles.prenom),
      actif = COALESCE(EXCLUDED.actif, profiles.actif);
  EXCEPTION WHEN OTHERS THEN
    -- Fallback warning so user creation in auth.users never fails with HTTP 500
    RAISE WARNING 'handle_new_user profile creation warning: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION public.handle_new_user IS 'Automatically creates or updates a profile with etablissement_id satisfying profiles_admin_etablissement_check';

-- Re-create the trigger to ensure it is active on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 3. REPAIR ALL AUTH USERS MISSING A PROFILES ROW
-- ============================================================================

DO $$
DECLARE
  v_default_etab_id UUID;
BEGIN
  -- Get default establishment id
  SELECT id INTO v_default_etab_id FROM public.etablissements LIMIT 1;

  -- Create missing profile rows for any auth.users that lack a row in public.profiles
  INSERT INTO public.profiles (id, nom, prenom, role, etablissement_id, actif)
  SELECT 
    u.id,
    COALESCE(u.raw_user_meta_data->>'nom', 'Non renseigné'),
    COALESCE(u.raw_user_meta_data->>'prenom', 'Non renseigné'),
    COALESCE(u.raw_user_meta_data->>'role', 'serveuse'),
    CASE 
      WHEN COALESCE(u.raw_user_meta_data->>'role', 'serveuse') = 'admin' THEN NULL
      WHEN u.raw_user_meta_data->>'etablissement_id' IS NOT NULL THEN (u.raw_user_meta_data->>'etablissement_id')::UUID
      ELSE v_default_etab_id
    END,
    TRUE
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE p.id IS NULL;

  -- Update any non-admin profile that still has a NULL etablissement_id
  IF v_default_etab_id IS NOT NULL THEN
    UPDATE public.profiles
    SET etablissement_id = v_default_etab_id
    WHERE etablissement_id IS NULL
      AND role <> 'admin';
  END IF;
END $$;
