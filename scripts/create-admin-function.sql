-- Function to update a user profile to admin role
-- This function should be created in the database to support admin user creation

CREATE OR REPLACE FUNCTION update_admin_profile(
  user_id UUID,
  admin_nom TEXT,
  admin_prenom TEXT
)
RETURNS void AS $$
BEGIN
  -- Update the profile to admin role with NULL etablissement_id
  UPDATE profiles
  SET 
    role = 'admin',
    etablissement_id = NULL,
    nom = admin_nom,
    prenom = admin_prenom,
    actif = true
  WHERE id = user_id;
  
  -- Log the admin creation
  INSERT INTO audit_logs (
    user_id,
    action,
    table_name,
    record_id,
    details,
    etablissement_id
  )
  VALUES (
    user_id,
    'ADMIN_USER_CREATED',
    'profiles',
    user_id,
    jsonb_build_object(
      'nom', admin_nom,
      'prenom', admin_prenom,
      'role', 'admin'
    ),
    NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION update_admin_profile(UUID, TEXT, TEXT) TO service_role;

