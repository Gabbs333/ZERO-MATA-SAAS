-- Migration: Multi-Tenant Audit Logging Enhancements
-- Description: Enhance audit logging to properly track multi-tenant operations
-- Requirements: 6.5, 10.1, 10.2, 10.3, 10.4, 10.6, 10.7

-- ============================================================================
-- HELPER FUNCTION: GET CURRENT USER'S ETABLISSEMENT_ID
-- ============================================================================

CREATE OR REPLACE FUNCTION get_current_user_etablissement_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT etablissement_id 
    FROM profiles 
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION get_current_user_etablissement_id() IS 
'Returns the etablissement_id of the currently authenticated user. Returns NULL for admin users.';

-- ============================================================================
-- HELPER FUNCTION: CHECK IF CURRENT USER IS ADMIN
-- ============================================================================

CREATE OR REPLACE FUNCTION is_current_user_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION is_current_user_admin() IS 
'Returns true if the currently authenticated user has the admin role.';

-- ============================================================================
-- AUDIT LOGGING FUNCTION WITH MULTI-TENANCY SUPPORT
-- ============================================================================

CREATE OR REPLACE FUNCTION log_audit_action(
  p_action TEXT,
  p_entite TEXT,
  p_entite_id UUID,
  p_details JSONB DEFAULT NULL,
  p_etablissement_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_etablissement_id UUID;
  v_utilisateur_id UUID;
BEGIN
  -- Get current user ID
  v_utilisateur_id := auth.uid();
  
  -- Determine etablissement_id
  IF p_etablissement_id IS NOT NULL THEN
    -- Use provided etablissement_id (for admin actions on specific establishments)
    v_etablissement_id := p_etablissement_id;
  ELSIF v_utilisateur_id IS NOT NULL THEN
    -- Get from user's profile (for regular user actions)
    v_etablissement_id := get_current_user_etablissement_id();
  ELSE
    -- System action (no user), use NULL
    v_etablissement_id := NULL;
  END IF;
  
  -- Insert audit log entry
  INSERT INTO audit_logs (
    utilisateur_id,
    action,
    entite,
    entite_id,
    etablissement_id,
    details_apres
  ) VALUES (
    v_utilisateur_id,
    p_action,
    p_entite,
    p_entite_id::TEXT,
    v_etablissement_id,
    p_details
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION log_audit_action IS 
'Logs an audit action with proper multi-tenancy support. Automatically determines etablissement_id from user context or accepts explicit value for admin actions.';

-- ============================================================================
-- UPDATE SUBSCRIPTION MANAGEMENT FUNCTIONS TO LOG PROPERLY
-- ============================================================================

-- Drop existing functions to allow parameter changes
DROP FUNCTION IF EXISTS confirm_payment_and_extend_subscription(UUID, UUID);
DROP FUNCTION IF EXISTS suspend_etablissement(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS reactivate_etablissement(UUID, UUID);

-- Update confirm_payment_and_extend_subscription to use new logging
CREATE OR REPLACE FUNCTION confirm_payment_and_extend_subscription(
  p_etablissement_id UUID,
  p_admin_utilisateur_id UUID
)
RETURNS void AS $$
DECLARE
  v_current_date_fin TIMESTAMPTZ;
  v_new_date_fin TIMESTAMPTZ;
BEGIN
  -- Verify caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = p_admin_utilisateur_id 
    AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can confirm payments';
  END IF;
  
  -- Get current end date
  SELECT date_fin INTO v_current_date_fin
  FROM etablissements
  WHERE id = p_etablissement_id;
  
  IF v_current_date_fin IS NULL THEN
    RAISE EXCEPTION 'Establishment not found';
  END IF;
  
  -- Calculate new end date (extend by 12 months from current end date)
  v_new_date_fin := v_current_date_fin + INTERVAL '12 months';
  
  -- Update establishment
  UPDATE etablissements
  SET 
    date_fin = v_new_date_fin,
    statut_abonnement = 'actif',
    actif = true,
    dernier_paiement_date = NOW(),
    dernier_paiement_confirme_par = p_admin_utilisateur_id,
    date_modification = NOW()
  WHERE id = p_etablissement_id;
  
  -- Log the action using new logging function
  PERFORM log_audit_action(
    'PAYMENT_CONFIRMED',
    'etablissements',
    p_etablissement_id,
    jsonb_build_object(
      'previous_date_fin', v_current_date_fin,
      'new_date_fin', v_new_date_fin,
      'payment_date', NOW(),
      'admin_utilisateur_id', p_admin_utilisateur_id
    ),
    p_etablissement_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update suspend_etablissement to use new logging
CREATE OR REPLACE FUNCTION suspend_etablissement(
  p_etablissement_id UUID,
  p_admin_utilisateur_id UUID,
  p_reason TEXT
)
RETURNS void AS $$
BEGIN
  -- Verify caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = p_admin_utilisateur_id 
    AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can suspend establishments';
  END IF;
  
  -- Update establishment
  UPDATE etablissements
  SET 
    statut_abonnement = 'suspendu',
    actif = false,
    date_modification = NOW()
  WHERE id = p_etablissement_id;
  
  -- Log the action using new logging function
  PERFORM log_audit_action(
    'ESTABLISHMENT_SUSPENDED',
    'etablissements',
    p_etablissement_id,
    jsonb_build_object(
      'reason', p_reason,
      'admin_utilisateur_id', p_admin_utilisateur_id,
      'suspended_at', NOW()
    ),
    p_etablissement_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update reactivate_etablissement to use new logging
CREATE OR REPLACE FUNCTION reactivate_etablissement(
  p_etablissement_id UUID,
  p_admin_utilisateur_id UUID
)
RETURNS void AS $$
BEGIN
  -- Verify caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = p_admin_utilisateur_id 
    AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can reactivate establishments';
  END IF;
  
  -- Update establishment
  UPDATE etablissements
  SET 
    statut_abonnement = 'actif',
    actif = true,
    date_modification = NOW()
  WHERE id = p_etablissement_id;
  
  -- Log the action using new logging function
  PERFORM log_audit_action(
    'ESTABLISHMENT_REACTIVATED',
    'etablissements',
    p_etablissement_id,
    jsonb_build_object(
      'admin_utilisateur_id', p_admin_utilisateur_id,
      'reactivated_at', NOW()
    ),
    p_etablissement_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGER: AUTO-LOG ESTABLISHMENT CREATION
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_log_etablissement_creation()
RETURNS TRIGGER AS $$
BEGIN
  -- Log establishment creation
  PERFORM log_audit_action(
    'ESTABLISHMENT_CREATED',
    'etablissements',
    NEW.id,
    jsonb_build_object(
      'nom', NEW.nom,
      'date_debut', NEW.date_debut,
      'date_fin', NEW.date_fin,
      'statut_abonnement', NEW.statut_abonnement
    ),
    NEW.id
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_log_etablissement_creation ON etablissements;
CREATE TRIGGER trigger_log_etablissement_creation
  AFTER INSERT ON etablissements
  FOR EACH ROW
  EXECUTE FUNCTION trigger_log_etablissement_creation();

-- ============================================================================
-- VIEW: ADMIN ACTIONS LOG
-- ============================================================================

CREATE OR REPLACE VIEW admin_actions_log AS
SELECT 
  al.id,
  al.date_creation,
  al.action,
  al.entite,
  al.entite_id,
  al.etablissement_id,
  al.details_apres,
  au.email as admin_email,
  p.nom as admin_nom,
  p.prenom as admin_prenom,
  e.nom as etablissement_nom
FROM audit_logs al
LEFT JOIN profiles p ON al.utilisateur_id = p.id
LEFT JOIN auth.users au ON p.id = au.id
LEFT JOIN etablissements e ON al.etablissement_id = e.id
WHERE p.role = 'admin' OR al.utilisateur_id IS NULL
ORDER BY al.date_creation DESC;

COMMENT ON VIEW admin_actions_log IS 
'View of all admin actions and system actions for monitoring and auditing purposes.';

-- ============================================================================
-- VIEW: SYSTEM ACTIONS LOG
-- ============================================================================

CREATE OR REPLACE VIEW system_actions_log AS
SELECT 
  al.id,
  al.date_creation,
  al.action,
  al.entite,
  al.entite_id,
  al.etablissement_id,
  al.details_apres,
  e.nom as etablissement_nom
FROM audit_logs al
LEFT JOIN etablissements e ON al.etablissement_id = e.id
WHERE al.utilisateur_id IS NULL
ORDER BY al.date_creation DESC;

COMMENT ON VIEW system_actions_log IS 
'View of all system-initiated actions (no utilisateur_id) such as automatic subscription expirations.';

-- ============================================================================
-- VIEW: ESTABLISHMENT AUDIT LOG
-- ============================================================================

CREATE OR REPLACE VIEW establishment_audit_log AS
SELECT 
  al.id,
  al.date_creation,
  al.action,
  al.entite,
  al.entite_id,
  al.etablissement_id,
  al.details_apres,
  al.utilisateur_id,
  au.email as user_email,
  p.nom as user_nom,
  p.prenom as user_prenom,
  p.role as user_role,
  e.nom as etablissement_nom,
  CASE 
    WHEN al.utilisateur_id IS NULL THEN 'SYSTEM'
    WHEN p.role = 'admin' THEN 'ADMIN'
    ELSE 'USER'
  END as actor_type
FROM audit_logs al
LEFT JOIN profiles p ON al.utilisateur_id = p.id
LEFT JOIN auth.users au ON p.id = au.id
LEFT JOIN etablissements e ON al.etablissement_id = e.id
ORDER BY al.date_creation DESC;

COMMENT ON VIEW establishment_audit_log IS 
'Comprehensive audit log view with actor type distinction (SYSTEM, ADMIN, USER) for all establishment-related actions.';

-- ============================================================================
-- RLS POLICIES FOR AUDIT LOG VIEWS
-- ============================================================================

-- Admin actions log: Only admins can view
ALTER VIEW admin_actions_log SET (security_invoker = on);

-- System actions log: Only admins can view
ALTER VIEW system_actions_log SET (security_invoker = on);

-- Establishment audit log: Users see their establishment, admins see all
ALTER VIEW establishment_audit_log SET (security_invoker = on);

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant access to helper functions
GRANT EXECUTE ON FUNCTION get_current_user_etablissement_id() TO authenticated;
GRANT EXECUTE ON FUNCTION is_current_user_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION log_audit_action TO authenticated;

-- Grant access to views
GRANT SELECT ON admin_actions_log TO authenticated;
GRANT SELECT ON system_actions_log TO authenticated;
GRANT SELECT ON establishment_audit_log TO authenticated;
