
-- ============================================================================
-- FIX: REDEFINE TRIGGER FUNCTION TO INCLUDE ETABLISSEMENT_ID
-- ============================================================================

-- Function to create profile automatically after user signup
-- Redefined here to ensure etablissement_id column exists
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nom, prenom, role, actif, etablissement_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nom', 'Non renseigné'),
    COALESCE(NEW.raw_user_meta_data->>'prenom', 'Non renseigné'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'serveuse'),
    TRUE,
    (NEW.raw_user_meta_data->>'etablissement_id')::UUID
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
