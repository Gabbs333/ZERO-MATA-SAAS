-- Migration: Add trigger for automatic profile creation
-- Description: Creates a profile automatically when a user signs up via auth.users

-- ============================================================================
-- TRIGGER FUNCTION FOR AUTOMATIC PROFILE CREATION
-- ============================================================================

-- Function to create profile automatically after user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nom, prenom, role, actif)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nom', 'Non renseigné'),
    COALESCE(NEW.raw_user_meta_data->>'prenom', 'Non renseigné'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'serveuse'),
    TRUE
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- FUNCTION TO UPDATE LAST CONNECTION
-- ============================================================================

-- Function to update derniere_connexion on login
CREATE OR REPLACE FUNCTION public.update_derniere_connexion()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET derniere_connexion = NOW()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: This trigger would need to be on auth.sessions or called from application
-- For now, we'll handle this in the application layer

-- ============================================================================
-- HELPER FUNCTIONS FOR PROFILE MANAGEMENT
-- ============================================================================

-- Function to create a new user with profile (for admin use)
CREATE OR REPLACE FUNCTION public.create_user_with_profile(
  p_email TEXT,
  p_password TEXT,
  p_nom TEXT,
  p_prenom TEXT,
  p_role TEXT
)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Validate role
  IF p_role NOT IN ('serveuse', 'comptoir', 'gerant', 'patron') THEN
    RAISE EXCEPTION 'Invalid role: %', p_role;
  END IF;

  -- This function should be called with service_role key
  -- The actual user creation happens via Supabase Auth API
  -- This is a placeholder for documentation purposes
  
  RAISE EXCEPTION 'This function must be called via Supabase Admin API';
  
  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION public.handle_new_user IS 'Automatically creates a profile when a new user signs up';
COMMENT ON FUNCTION public.update_derniere_connexion IS 'Updates the last connection timestamp for a user';
COMMENT ON FUNCTION public.create_user_with_profile IS 'Helper function documentation for creating users with profiles via Admin API';
COMMENT ON TRIGGER on_auth_user_created ON auth.users IS 'Trigger that creates a profile automatically after user signup';
