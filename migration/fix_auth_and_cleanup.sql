
-- 1. Fix for auth.sessions "Database error querying schema"
-- This error occurs when the 'id' column in 'auth.sessions' has no default value and the user creation process fails to provide one.
-- We create a trigger to ensure an ID is always generated.

CREATE OR REPLACE FUNCTION auth.set_session_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.id IS NULL THEN
    NEW.id := gen_random_uuid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS set_session_id_trigger ON auth.sessions;

CREATE TRIGGER set_session_id_trigger
  BEFORE INSERT ON auth.sessions
  FOR EACH ROW
  EXECUTE FUNCTION auth.set_session_id();

-- 2. Clean up test users to allow fresh creation
-- We delete them from auth.users, which should cascade to public.profiles if foreign keys are set correctly.
-- If not, we delete from profiles first.

DELETE FROM public.profiles WHERE email IN ('patron@test.com', 'serveuse@test.com', 'comptoir@test.com', 'gerant@test.com');
DELETE FROM auth.users WHERE email IN ('patron@test.com', 'serveuse@test.com', 'comptoir@test.com', 'gerant@test.com');

-- 3. Ensure profiles trigger exists (just in case)
-- This ensures that when we create users via Admin API, the profile is created/updated correctly.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nom, prenom, role, etablissement_id)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'nom',
    NEW.raw_user_meta_data->>'prenom',
    NEW.raw_user_meta_data->>'role',
    (NEW.raw_user_meta_data->>'etablissement_id')::uuid
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    nom = EXCLUDED.nom,
    prenom = EXCLUDED.prenom,
    role = EXCLUDED.role,
    etablissement_id = EXCLUDED.etablissement_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-attach trigger if missing
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
