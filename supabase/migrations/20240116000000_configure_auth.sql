-- Migration: Configure Supabase Auth
-- Description: Sets up authentication configuration and policies

-- ============================================================================
-- AUTH CONFIGURATION
-- ============================================================================

-- Note: The following configurations must be done via Supabase Dashboard:
-- 1. Enable Email provider in Authentication > Providers
-- 2. Configure email templates in Authentication > Email Templates
-- 3. Set JWT expiry in Authentication > Settings:
--    - Access token expiry: 3600 seconds (1 hour)
--    - Refresh token expiry: 604800 seconds (7 days)
-- 4. Configure password requirements in Authentication > Settings:
--    - Minimum password length: 8 characters

-- ============================================================================
-- AUTH HOOKS (Optional - for custom validation)
-- ============================================================================

-- Function to validate password strength (called by auth hook if configured)
CREATE OR REPLACE FUNCTION auth.validate_password_strength(password TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Minimum 8 characters
  IF LENGTH(password) < 8 THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- HELPER FUNCTIONS FOR AUTH
-- ============================================================================

-- Function to get current user's role
CREATE OR REPLACE FUNCTION auth.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Function to check if user is active
CREATE OR REPLACE FUNCTION auth.is_user_active()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(actif, FALSE) FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION auth.validate_password_strength IS 'Validates password meets minimum requirements (8+ characters)';
COMMENT ON FUNCTION auth.get_user_role IS 'Returns the role of the currently authenticated user';
COMMENT ON FUNCTION auth.is_user_active IS 'Checks if the currently authenticated user is active';
