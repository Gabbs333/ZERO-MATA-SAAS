-- Migration: Audit System
-- Description: Implements automatic audit logging for critical tables

-- ============================================================================
-- AUDIT TRIGGER FUNCTION
-- ============================================================================

-- Generic audit trigger function that logs INSERT, UPDATE, DELETE operations
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
  audit_row audit_logs;
  excluded_cols TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Set the action based on operation
  IF (TG_OP = 'INSERT') THEN
    audit_row.action := TG_TABLE_NAME || '.created';
    audit_row.details_avant := NULL;
    audit_row.details_apres := to_jsonb(NEW);
    audit_row.entite_id := COALESCE(NEW.id::TEXT, 'unknown');
  ELSIF (TG_OP = 'UPDATE') THEN
    audit_row.action := TG_TABLE_NAME || '.updated';
    audit_row.details_avant := to_jsonb(OLD);
    audit_row.details_apres := to_jsonb(NEW);
    audit_row.entite_id := COALESCE(NEW.id::TEXT, OLD.id::TEXT, 'unknown');
  ELSIF (TG_OP = 'DELETE') THEN
    audit_row.action := TG_TABLE_NAME || '.deleted';
    audit_row.details_avant := to_jsonb(OLD);
    audit_row.details_apres := NULL;
    audit_row.entite_id := COALESCE(OLD.id::TEXT, 'unknown');
  END IF;
  
  -- Set common fields
  audit_row.utilisateur_id := auth.uid();
  audit_row.entite := TG_TABLE_NAME;
  audit_row.adresse_ip := current_setting('request.headers', true)::json->>'x-forwarded-for';
  audit_row.date_creation := NOW();
  
  -- Insert audit log
  INSERT INTO audit_logs (
    utilisateur_id,
    action,
    entite,
    entite_id,
    details_avant,
    details_apres,
    adresse_ip,
    date_creation
  ) VALUES (
    audit_row.utilisateur_id,
    audit_row.action,
    audit_row.entite,
    audit_row.entite_id,
    audit_row.details_avant,
    audit_row.details_apres,
    audit_row.adresse_ip,
    audit_row.date_creation
  );
  
  -- Return the appropriate row
  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- CREATE AUDIT TRIGGERS ON CRITICAL TABLES
-- ============================================================================

-- Audit trigger for profiles table
CREATE TRIGGER audit_profiles_trigger
  AFTER INSERT OR UPDATE OR DELETE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_function();

-- Audit trigger for produits table
CREATE TRIGGER audit_produits_trigger
  AFTER INSERT OR UPDATE OR DELETE ON produits
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_function();

-- Audit trigger for commandes table
CREATE TRIGGER audit_commandes_trigger
  AFTER INSERT OR UPDATE OR DELETE ON commandes
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_function();

-- Audit trigger for ravitaillements table
CREATE TRIGGER audit_ravitaillements_trigger
  AFTER INSERT OR UPDATE OR DELETE ON ravitaillements
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_function();

-- Audit trigger for factures table
CREATE TRIGGER audit_factures_trigger
  AFTER INSERT OR UPDATE OR DELETE ON factures
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_function();

-- Audit trigger for encaissements table
CREATE TRIGGER audit_encaissements_trigger
  AFTER INSERT OR UPDATE OR DELETE ON encaissements
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_function();

-- Audit trigger for stock table (important for tracking stock changes)
CREATE TRIGGER audit_stock_trigger
  AFTER INSERT OR UPDATE OR DELETE ON stock
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_function();

-- Audit trigger for mouvements_stock table
CREATE TRIGGER audit_mouvements_stock_trigger
  AFTER INSERT OR UPDATE OR DELETE ON mouvements_stock
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_function();

-- ============================================================================
-- AUDIT QUERY FUNCTIONS
-- ============================================================================

-- Function to get audit logs for a specific entity
CREATE OR REPLACE FUNCTION get_audit_logs_for_entity(
  p_entite TEXT,
  p_entite_id TEXT,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  utilisateur_id UUID,
  utilisateur_nom TEXT,
  action TEXT,
  details_avant JSONB,
  details_apres JSONB,
  adresse_ip TEXT,
  date_creation TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    al.id,
    al.utilisateur_id,
    COALESCE(p.nom || ' ' || p.prenom, 'Système') as utilisateur_nom,
    al.action,
    al.details_avant,
    al.details_apres,
    al.adresse_ip,
    al.date_creation
  FROM audit_logs al
  LEFT JOIN profiles p ON p.id = al.utilisateur_id
  WHERE al.entite = p_entite
    AND al.entite_id = p_entite_id
  ORDER BY al.date_creation DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get audit logs for a specific user
CREATE OR REPLACE FUNCTION get_audit_logs_for_user(
  p_utilisateur_id UUID,
  p_debut TIMESTAMPTZ DEFAULT NULL,
  p_fin TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  action TEXT,
  entite TEXT,
  entite_id TEXT,
  details_avant JSONB,
  details_apres JSONB,
  adresse_ip TEXT,
  date_creation TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    al.id,
    al.action,
    al.entite,
    al.entite_id,
    al.details_avant,
    al.details_apres,
    al.adresse_ip,
    al.date_creation
  FROM audit_logs al
  WHERE al.utilisateur_id = p_utilisateur_id
    AND (p_debut IS NULL OR al.date_creation >= p_debut)
    AND (p_fin IS NULL OR al.date_creation <= p_fin)
  ORDER BY al.date_creation DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get recent audit logs
CREATE OR REPLACE FUNCTION get_recent_audit_logs(
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  utilisateur_id UUID,
  utilisateur_nom TEXT,
  action TEXT,
  entite TEXT,
  entite_id TEXT,
  adresse_ip TEXT,
  date_creation TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    al.id,
    al.utilisateur_id,
    COALESCE(p.nom || ' ' || p.prenom, 'Système') as utilisateur_nom,
    al.action,
    al.entite,
    al.entite_id,
    al.adresse_ip,
    al.date_creation
  FROM audit_logs al
  LEFT JOIN profiles p ON p.id = al.utilisateur_id
  ORDER BY al.date_creation DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to search audit logs with filters
CREATE OR REPLACE FUNCTION search_audit_logs(
  p_action TEXT DEFAULT NULL,
  p_entite TEXT DEFAULT NULL,
  p_utilisateur_id UUID DEFAULT NULL,
  p_debut TIMESTAMPTZ DEFAULT NULL,
  p_fin TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  utilisateur_id UUID,
  utilisateur_nom TEXT,
  action TEXT,
  entite TEXT,
  entite_id TEXT,
  details_avant JSONB,
  details_apres JSONB,
  adresse_ip TEXT,
  date_creation TIMESTAMPTZ,
  total_count BIGINT
) AS $$
DECLARE
  v_total_count BIGINT;
BEGIN
  -- Get total count
  SELECT COUNT(*) INTO v_total_count
  FROM audit_logs al
  WHERE (p_action IS NULL OR al.action ILIKE '%' || p_action || '%')
    AND (p_entite IS NULL OR al.entite = p_entite)
    AND (p_utilisateur_id IS NULL OR al.utilisateur_id = p_utilisateur_id)
    AND (p_debut IS NULL OR al.date_creation >= p_debut)
    AND (p_fin IS NULL OR al.date_creation <= p_fin);
  
  -- Return paginated results
  RETURN QUERY
  SELECT
    al.id,
    al.utilisateur_id,
    COALESCE(p.nom || ' ' || p.prenom, 'Système') as utilisateur_nom,
    al.action,
    al.entite,
    al.entite_id,
    al.details_avant,
    al.details_apres,
    al.adresse_ip,
    al.date_creation,
    v_total_count
  FROM audit_logs al
  LEFT JOIN profiles p ON p.id = al.utilisateur_id
  WHERE (p_action IS NULL OR al.action ILIKE '%' || p_action || '%')
    AND (p_entite IS NULL OR al.entite = p_entite)
    AND (p_utilisateur_id IS NULL OR al.utilisateur_id = p_utilisateur_id)
    AND (p_debut IS NULL OR al.date_creation >= p_debut)
    AND (p_fin IS NULL OR al.date_creation <= p_fin)
  ORDER BY al.date_creation DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- AUDIT STATISTICS FUNCTIONS
-- ============================================================================

-- Function to get audit statistics by action type
CREATE OR REPLACE FUNCTION get_audit_stats_by_action(
  p_debut TIMESTAMPTZ DEFAULT NULL,
  p_fin TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  action TEXT,
  count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    al.action,
    COUNT(*) as count
  FROM audit_logs al
  WHERE (p_debut IS NULL OR al.date_creation >= p_debut)
    AND (p_fin IS NULL OR al.date_creation <= p_fin)
  GROUP BY al.action
  ORDER BY count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get audit statistics by user
CREATE OR REPLACE FUNCTION get_audit_stats_by_user(
  p_debut TIMESTAMPTZ DEFAULT NULL,
  p_fin TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  utilisateur_id UUID,
  utilisateur_nom TEXT,
  count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    al.utilisateur_id,
    COALESCE(p.nom || ' ' || p.prenom, 'Système') as utilisateur_nom,
    COUNT(*) as count
  FROM audit_logs al
  LEFT JOIN profiles p ON p.id = al.utilisateur_id
  WHERE (p_debut IS NULL OR al.date_creation >= p_debut)
    AND (p_fin IS NULL OR al.date_creation <= p_fin)
  GROUP BY al.utilisateur_id, p.nom, p.prenom
  ORDER BY count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION audit_trigger_function IS 'Generic trigger function that automatically logs INSERT, UPDATE, DELETE operations to audit_logs';
COMMENT ON FUNCTION get_audit_logs_for_entity IS 'Retrieves audit logs for a specific entity (e.g., a specific commande or produit)';
COMMENT ON FUNCTION get_audit_logs_for_user IS 'Retrieves audit logs for a specific user within a time period';
COMMENT ON FUNCTION get_recent_audit_logs IS 'Retrieves the most recent audit logs across all entities';
COMMENT ON FUNCTION search_audit_logs IS 'Searches audit logs with multiple filters and pagination';
COMMENT ON FUNCTION get_audit_stats_by_action IS 'Returns statistics of audit logs grouped by action type';
COMMENT ON FUNCTION get_audit_stats_by_user IS 'Returns statistics of audit logs grouped by user';

COMMENT ON TRIGGER audit_profiles_trigger ON profiles IS 'Requirement 7.5: Audit all profile changes';
COMMENT ON TRIGGER audit_commandes_trigger ON commandes IS 'Requirement 8.1: Audit all commande operations';
COMMENT ON TRIGGER audit_produits_trigger ON produits IS 'Requirement 12.5: Audit all product modifications';
