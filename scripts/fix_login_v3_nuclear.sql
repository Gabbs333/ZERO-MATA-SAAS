-- NUCLEAR OPTION: FIX LOGIN BY REMOVING ALL CUSTOM TRIGGERS ON AUTH.USERS
-- Description: This script drops ALL triggers on auth.users that are not system triggers
-- and re-installs ONLY the essential profile creation logic in a safe way.
-- Use this if you are getting "Database error querying schema" or 500 errors on login.

DO $$
DECLARE
    t_name text;
BEGIN
    -- 1. DROP ALL TRIGGERS ON auth.users (Except system ones if any)
    FOR t_name IN 
        SELECT trigger_name 
        FROM information_schema.triggers 
        WHERE event_object_schema = 'auth' 
        AND event_object_table = 'users'
        AND trigger_name NOT LIKE 'supabase_%' -- Preserve internal Supabase triggers
    LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(t_name) || ' ON auth.users CASCADE';
        RAISE NOTICE 'Dropped trigger: %', t_name;
    END LOOP;

    -- 2. DROP ALL TRIGGERS ON public.profiles
    FOR t_name IN 
        SELECT trigger_name 
        FROM information_schema.triggers 
        WHERE event_object_schema = 'public' 
        AND event_object_table = 'profiles'
    LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(t_name) || ' ON public.profiles CASCADE';
        RAISE NOTICE 'Dropped trigger: %', t_name;
    END LOOP;
END $$;

-- 3. RE-CREATE THE SAFE HANDLE_NEW_USER FUNCTION (Corrected Version)
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

-- 4. RE-ATTACH THE TRIGGER ONLY ON INSERT (Safe)
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 5. ENSURE EMAIL IS CONFIRMED FOR ALL USERS (To avoid email confirmation errors)
UPDATE auth.users SET email_confirmed_at = NOW() WHERE email_confirmed_at IS NULL;

RAISE NOTICE 'Nuclear cleanup complete. Triggers reset.';
