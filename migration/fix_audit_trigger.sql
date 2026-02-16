
-- Fix audit_trigger_function to use explicit schema references and handle potential search_path issues
-- Also handles NOT NULL constraints on audit_logs columns by providing default JSONB values

CREATE OR REPLACE FUNCTION public.audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
  audit_row public.audit_logs%ROWTYPE; -- Explicit schema reference
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
  audit_row.utilisateur_id := auth.uid(); -- Might be NULL for system actions
  audit_row.entite := TG_TABLE_NAME;
  
  -- Handle request headers safely
  BEGIN
    audit_row.adresse_ip := current_setting('request.headers', true)::json->>'x-forwarded-for';
  EXCEPTION WHEN OTHERS THEN
    audit_row.adresse_ip := NULL;
  END;
  
  audit_row.date_creation := NOW();
  
  -- Insert audit log with explicit schema and safety for NOT NULL constraints
  INSERT INTO public.audit_logs (
    utilisateur_id,
    action,
    entite,
    entite_id,
    details_avant,
    details_apres,
    adresse_ip,
    date_creation,
    etablissement_id
  ) VALUES (
    audit_row.utilisateur_id,
    audit_row.action,
    audit_row.entite,
    audit_row.entite_id,
    COALESCE(audit_row.details_avant, '{}'::jsonb), -- Handle NULLs
    COALESCE(audit_row.details_apres, '{}'::jsonb), -- Handle NULLs
    audit_row.adresse_ip,
    audit_row.date_creation,
    -- Safe extraction of etablissement_id from JSONB
    CASE 
      WHEN TG_OP IN ('INSERT', 'UPDATE') THEN (audit_row.details_apres->>'etablissement_id')::uuid
      WHEN TG_OP = 'DELETE' THEN (audit_row.details_avant->>'etablissement_id')::uuid
      ELSE NULL
    END
  );
  
  RETURN NULL; -- Result is ignored for AFTER triggers
EXCEPTION WHEN OTHERS THEN
    -- Log error to debug_logs if possible, but avoid infinite recursion if audit_logs fails
    BEGIN
        INSERT INTO public.debug_logs (message, details)
        VALUES (
            'Error in audit_trigger_function',
            jsonb_build_object(
                'error_message', SQLERRM,
                'error_code', SQLSTATE,
                'table', TG_TABLE_NAME,
                'operation', TG_OP
            )
        );
    EXCEPTION WHEN OTHERS THEN
        -- Ignore logging failure
        NULL;
    END;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure search path is set for the function
ALTER FUNCTION public.audit_trigger_function() SET search_path = public, auth, extensions;
