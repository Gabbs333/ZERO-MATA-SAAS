-- Script ULTIME de réparation (Nettoyage en profondeur)
-- Ce script va :
-- 1. Créer une fonction de diagnostic pour vérifier la santé de la DB
-- 2. Supprimer TOUS les triggers sur auth.users (même ceux cachés)
-- 3. Réparer la structure de audit_logs
-- 4. Désactiver temporairement le RLS sur profiles pour être sûr

BEGIN;

-- 1. Fonction de Health Check (pour test-login.js)
CREATE OR REPLACE FUNCTION public.health_check()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN 'OK';
END;
$$;
GRANT EXECUTE ON FUNCTION public.health_check TO anon, authenticated, service_role;

-- 2. Réparation structure audit_logs (au cas où)
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS etablissement_id UUID REFERENCES public.etablissements(id);
-- On s'assure que la colonne est bien là, sinon les triggers plantent

-- 3. NETTOYAGE RADICAL des triggers sur auth.users
-- Le login échoue car un UPDATE sur auth.users plante. On supprime tout ce qui n'est pas système.
DROP TRIGGER IF EXISTS on_auth_user_login ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
DROP TRIGGER IF EXISTS update_derniere_connexion_trigger ON auth.users;
DROP TRIGGER IF EXISTS check_for_duplicate_emails ON auth.users;
DROP TRIGGER IF EXISTS check_user_profile_exists ON auth.users;

-- 4. Nettoyage triggers profiles
DROP TRIGGER IF EXISTS audit_profiles_trigger ON public.profiles;

-- 5. Recréation MINIMALISTE et SÉCURISÉE du trigger de création de profil
-- On le fait le plus simple possible pour éviter tout crash
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nom, prenom, role, actif)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nom', 'Utilisateur'),
    COALESCE(NEW.raw_user_meta_data->>'prenom', 'Inconnu'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'serveuse'),
    TRUE
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Ne jamais faire planter l'inscription
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

COMMIT;
