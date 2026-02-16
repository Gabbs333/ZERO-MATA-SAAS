-- Script de restauration du mode production
-- Ce script réactive toutes les sécurités, triggers et contraintes qui ont pu être désactivés temporairement.
-- À exécuter dans l'éditeur SQL de Supabase.

-- 1. Réactiver le trigger d'audit sur les établissements
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_log_etablissement_creation') THEN
        ALTER TABLE public.etablissements ENABLE TRIGGER trigger_log_etablissement_creation;
        RAISE NOTICE 'Trigger trigger_log_etablissement_creation réactivé.';
    END IF;
END $$;

-- 2. Réactiver le trigger d'audit sur les profils
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_profiles_trigger') THEN
        ALTER TABLE public.profiles ENABLE TRIGGER audit_profiles_trigger;
        RAISE NOTICE 'Trigger audit_profiles_trigger réactivé.';
    END IF;
END $$;

-- 3. Rétablir la contrainte de validation des rôles et établissements
-- On supprime l'ancienne version si elle existe pour s'assurer d'avoir la définition stricte
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_admin_etablissement_check;

-- On recrée la contrainte stricte
ALTER TABLE public.profiles ADD CONSTRAINT profiles_admin_etablissement_check 
CHECK (
  (role = 'admin' AND etablissement_id IS NULL) OR
  (role != 'admin' AND etablissement_id IS NOT NULL)
);

RAISE NOTICE 'Contrainte profiles_admin_etablissement_check rétablie.';

-- Note sur la fonction handle_new_user :
-- La modification apportée à handle_new_user (suppression de l'insertion de l'email) est conservée
-- car elle corrige un bug structurel (la colonne email n'existe plus dans la table profiles).
-- C'est donc la version correcte pour la production.
