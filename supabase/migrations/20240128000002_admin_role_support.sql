-- Migration: Add admin role support to profiles table
-- This migration modifies the profiles table to support admin users who can manage all establishments

-- Drop existing role CHECK constraint
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Add new role CHECK constraint including 'admin'
ALTER TABLE profiles
ADD CONSTRAINT profiles_role_check CHECK (role IN ('serveuse', 'comptoir', 'gerant', 'patron', 'admin'));

-- Add CHECK constraint: admin users must have NULL etablissement_id, others must have non-NULL
-- Note: This constraint will be enforced after data migration
-- For now, we create it as NOT VALID to allow migration
ALTER TABLE profiles
ADD CONSTRAINT profiles_admin_etablissement_check 
CHECK (
  (role = 'admin' AND etablissement_id IS NULL) OR
  (role != 'admin' AND etablissement_id IS NOT NULL)
) NOT VALID;

-- The constraint will be validated after data migration in 20240128000003_migrate_existing_data.sql

COMMENT ON CONSTRAINT profiles_admin_etablissement_check ON profiles IS 
'Ensures admin users have NULL etablissement_id and non-admin users have non-NULL etablissement_id';
