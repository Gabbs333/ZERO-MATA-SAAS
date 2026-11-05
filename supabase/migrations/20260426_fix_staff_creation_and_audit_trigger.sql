-- Migration: Corrige la création de comptes personnel (erreur 500 côté Auth Admin API)
-- Causes corrigées :
--   1. Le trigger d'audit pouvait faire échouer l'insertion du profil
--      (cast JSONB sur "request.headers" vide, details_apres NOT NULL en DELETE, etc.),
--      ce qui annulait toute la transaction de création d'utilisateur Auth.
--   2. handle_new_user restait vulnérable aux contraintes (établissement NULL, etc.).

-- ============================================================================
-- 1. TRIGGER D'AUDIT INFALLIBLE (ne bloque JAMAIS l'opération principale)
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
  audit_row audit_logs;
  v_headers JSONB;
BEGIN
  BEGIN
    -- Déterminer l'action
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
      audit_row.details_apres := '{}'::jsonb;
      audit_row.entite_id := COALESCE(OLD.id::TEXT, 'unknown');
    END IF;

    -- Champs communs
    audit_row.utilisateur_id := auth.uid();
    audit_row.entite := TG_TABLE_NAME;
    audit_row.details_apres := COALESCE(audit_row.details_apres, '{}'::jsonb);

    -- Extraction sécurisée de l'IP (évite l'erreur "invalid input syntax for type json")
    BEGIN
      v_headers := NULLIF(current_setting('request.headers', true), '')::jsonb;
      audit_row.adresse_ip := v_headers->>'x-forwarded-for';
    EXCEPTION WHEN OTHERS THEN
      audit_row.adresse_ip := NULL;
    END;

    audit_row.date_creation := NOW();

    INSERT INTO audit_logs (
      utilisateur_id, action, entite, entite_id,
      details_avant, details_apres, adresse_ip, date_creation
    ) VALUES (
      audit_row.utilisateur_id, audit_row.action, audit_row.entite, audit_row.entite_id,
      audit_row.details_avant, audit_row.details_apres, audit_row.adresse_ip, audit_row.date_creation
    );
  EXCEPTION WHEN OTHERS THEN
    -- L'audit ne doit jamais empêcher une opération métier
    RAISE WARNING 'audit_trigger_function (non-bloquant): %', SQLERRM;
  END;

  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- S'assurer que le trigger d'audit est bien présent sur profiles
DROP TRIGGER IF EXISTS audit_profiles_trigger ON profiles;
CREATE TRIGGER audit_profiles_trigger
  AFTER INSERT OR UPDATE OR DELETE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_function();

-- ============================================================================
-- 2. HANDLE_NEW_USER INFALLIBLE
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT;
  v_nom TEXT;
  v_prenom TEXT;
  v_etablissement_id UUID;
BEGIN
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'serveuse');
  v_nom := COALESCE(NEW.raw_user_meta_data->>'nom', 'Non renseigné');
  v_prenom := COALESCE(NEW.raw_user_meta_data->>'prenom', 'Non renseigné');

  IF NEW.raw_user_meta_data->>'etablissement_id' IS NOT NULL THEN
    BEGIN
      v_etablissement_id := (NEW.raw_user_meta_data->>'etablissement_id')::UUID;
    EXCEPTION WHEN OTHERS THEN
      v_etablissement_id := NULL;
    END;
  END IF;

  IF v_role <> 'admin' AND v_etablissement_id IS NULL THEN
    SELECT id INTO v_etablissement_id FROM public.etablissements LIMIT 1;
  END IF;

  IF v_role = 'admin' THEN
    v_etablissement_id := NULL;
  END IF;

  BEGIN
    INSERT INTO public.profiles (id, email, nom, prenom, role, etablissement_id, actif)
    VALUES (
      NEW.id,
      NEW.email,
      v_nom,
      v_prenom,
      v_role,
      v_etablissement_id,
      TRUE
    )
    ON CONFLICT (id) DO UPDATE SET
      email = COALESCE(EXCLUDED.email, profiles.email),
      etablissement_id = COALESCE(EXCLUDED.etablissement_id, profiles.etablissement_id),
      role = COALESCE(EXCLUDED.role, profiles.role),
      nom = COALESCE(EXCLUDED.nom, profiles.nom),
      prenom = COALESCE(EXCLUDED.prenom, profiles.prenom),
      actif = COALESCE(EXCLUDED.actif, profiles.actif);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user (non-bloquant): %', SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 3. RÉPARATION DES PROFILS ORPHELINS (utilisateurs auth sans profil)
-- ============================================================================

DO $$
DECLARE
  v_default_etab_id UUID;
BEGIN
  SELECT id INTO v_default_etab_id FROM public.etablissements LIMIT 1;

  INSERT INTO public.profiles (id, email, nom, prenom, role, etablissement_id, actif)
  SELECT
    u.id,
    u.email,
    COALESCE(u.raw_user_meta_data->>'nom', 'Non renseigné'),
    COALESCE(u.raw_user_meta_data->>'prenom', 'Non renseigné'),
    COALESCE(u.raw_user_meta_data->>'role', 'serveuse'),
    CASE
      WHEN COALESCE(u.raw_user_meta_data->>'role', 'serveuse') = 'admin' THEN NULL
      WHEN u.raw_user_meta_data->>'etablissement_id' IS NOT NULL THEN (u.raw_user_meta_data->>'etablissement_id')::UUID
      ELSE v_default_etab_id
    END,
    TRUE
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE p.id IS NULL;
END $$;
