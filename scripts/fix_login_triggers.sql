-- Script de réparation du Login (Supression des triggers bloquants sur auth.users)
-- Ce script supprime les triggers qui s'exécutent lors de la connexion (UPDATE sur auth.users)
-- et qui provoquent l'erreur "Database error querying schema".

BEGIN;

-- 1. Supprimer TOUS les triggers sur auth.users qui pourraient bloquer le Login
-- Ces triggers sont souvent utilisés pour synchroniser la date de connexion, 
-- mais s'ils sont mal codés, ils bloquent tout le système d'authentification.
DROP TRIGGER IF EXISTS on_auth_user_login ON auth.users;
DROP TRIGGER IF EXISTS update_derniere_connexion_trigger ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users; 
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;

-- 2. Fonction robuste pour la création de nouvel utilisateur (SignUp)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nom, prenom, role, actif, etablissement_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nom', 'Utilisateur'),
    COALESCE(NEW.raw_user_meta_data->>'prenom', 'Inconnu'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'serveuse'),
    TRUE,
    NULL
  )
  ON CONFLICT (id) DO NOTHING; -- Évite les erreurs si le profil existe déjà
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- En cas d'erreur, on ne bloque pas la création du compte auth
  RAISE WARNING 'Erreur création profil: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Recréer UNIQUEMENT le trigger de création (INSERT), pas de trigger sur UPDATE (Login)
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

COMMIT;
