-- Script de correction CRITIQUE pour le Trigger d'Audit
-- Ce script corrige 3 bugs majeurs qui font planter le login et l'inscription :
-- 1. 'entite' était NULL (violant la contrainte NOT NULL)
-- 2. 'details_apres' était NULL lors d'une suppression (violant la contrainte NOT NULL)
-- 3. 'created_at' n'existe pas, c'est 'date_creation'

BEGIN;

-- 1. Désactiver temporairement le trigger pour éviter les conflits pendant la mise à jour
DROP TRIGGER IF EXISTS audit_profiles_trigger ON public.profiles;

-- 2. Remplacer la fonction fautive
CREATE OR REPLACE FUNCTION public.audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
  v_action TEXT;
  v_entite TEXT;
  v_entite_id TEXT;
  v_details_avant JSONB;
  v_details_apres JSONB;
  v_etablissement_id UUID;
  v_user_id UUID;
BEGIN
  -- Récupérer l'ID utilisateur de manière sécurisée
  v_user_id := auth.uid();

  -- Déterminer l'établissement (NULL pour Admin/SaaS Owner ou si non trouvé)
  IF v_user_id IS NOT NULL THEN
    BEGIN
      SELECT etablissement_id INTO v_etablissement_id
      FROM public.profiles
      WHERE id = v_user_id;
    EXCEPTION WHEN OTHERS THEN
      v_etablissement_id := NULL;
    END;
  ELSE
    v_etablissement_id := NULL;
  END IF;

  -- Préparer les données
  v_entite := TG_TABLE_NAME; -- FIX 1: Assigner le nom de la table
  
  IF (TG_OP = 'INSERT') THEN
    v_action := TG_TABLE_NAME || '.created';
    v_details_avant := NULL;
    v_details_apres := to_jsonb(NEW);
    v_entite_id := COALESCE(NEW.id::TEXT, 'unknown');
  ELSIF (TG_OP = 'UPDATE') THEN
    v_action := TG_TABLE_NAME || '.updated';
    v_details_avant := to_jsonb(OLD);
    v_details_apres := to_jsonb(NEW);
    v_entite_id := COALESCE(NEW.id::TEXT, OLD.id::TEXT, 'unknown');
  ELSIF (TG_OP = 'DELETE') THEN
    v_action := TG_TABLE_NAME || '.deleted';
    v_details_avant := to_jsonb(OLD);
    v_details_apres := '{}'::jsonb; -- FIX 2: Ne jamais laisser NULL (contrainte NOT NULL)
    v_entite_id := COALESCE(OLD.id::TEXT, 'unknown');
  END IF;
  
  -- Insertion sécurisée
  INSERT INTO public.audit_logs (
    utilisateur_id,
    action,
    entite,
    entite_id,
    etablissement_id,
    details_avant,
    details_apres,
    date_creation -- FIX 3: Utiliser le bon nom de colonne (pas created_at)
  ) VALUES (
    v_user_id,
    v_action,
    v_entite,
    v_entite_id,
    v_etablissement_id,
    v_details_avant,
    v_details_apres,
    NOW()
  );
  
  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- En cas d'erreur, on log mais on ne bloque pas la transaction
  RAISE WARNING 'Audit log failed: %', SQLERRM;
  IF (TG_OP = 'DELETE') THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Réactiver le trigger
CREATE TRIGGER audit_profiles_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_trigger_function();

COMMIT;
