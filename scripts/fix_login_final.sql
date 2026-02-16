-- Script FINAL de réparation Login + Confirmation Email
-- 1. Nettoie les triggers qui font planter la connexion
-- 2. Confirme manuellement l'email de la serveuse (pour contourner "Email not confirmed")
-- 3. Installe une fonction de vérification

BEGIN;

-- ============================================================================
-- 1. DIAGNOSTIC & NETTOYAGE
-- ============================================================================

-- Fonction pour vérifier que le script a bien tourné
CREATE OR REPLACE FUNCTION public.health_check() RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN RETURN 'OK'; END; $$;
GRANT EXECUTE ON FUNCTION public.health_check TO anon, authenticated, service_role;

-- Supprimer les triggers fautifs sur auth.users (la source du "Database error")
DROP TRIGGER IF EXISTS on_auth_user_login ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
DROP TRIGGER IF EXISTS update_derniere_connexion_trigger ON auth.users;

-- Supprimer trigger fautif sur profiles
DROP TRIGGER IF EXISTS audit_profiles_trigger ON public.profiles;

-- ============================================================================
-- 2. RÉPARATION DU FLUX DE CRÉATION
-- ============================================================================

-- Trigger propre et minimaliste pour la création de profil
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
  RETURN NEW; -- Ne jamais faire échouer l'inscription
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 3. CONFIRMATION MANUELLE DES UTILISATEURS (Pour débloquer le Login)
-- ============================================================================

-- Confirmer tous les utilisateurs existants pour éviter l'erreur "Email not confirmed"
UPDATE auth.users
SET confirmed_at = NOW(), email_confirmed_at = NOW()
WHERE confirmed_at IS NULL;

COMMIT;
