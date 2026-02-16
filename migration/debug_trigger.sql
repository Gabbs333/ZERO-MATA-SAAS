
-- Create a debug logs table
CREATE TABLE IF NOT EXISTS public.debug_logs (
  id SERIAL PRIMARY KEY,
  message TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Grant permissions to ensure we can write to it
GRANT ALL ON public.debug_logs TO service_role;
GRANT ALL ON public.debug_logs TO postgres;
GRANT ALL ON public.debug_logs TO anon;
GRANT ALL ON public.debug_logs TO authenticated;

-- Update the trigger to capture errors
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
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
  EXCEPTION WHEN OTHERS THEN
    -- Log the error
    INSERT INTO public.debug_logs (message, details)
    VALUES (
      'Error in handle_new_user',
      jsonb_build_object(
        'error_message', SQLERRM,
        'error_code', SQLSTATE,
        'new_user_id', NEW.id,
        'metadata', NEW.raw_user_meta_data
      )
    );
    -- We swallow the error to allow user creation to proceed, 
    -- so we can check the logs.
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
