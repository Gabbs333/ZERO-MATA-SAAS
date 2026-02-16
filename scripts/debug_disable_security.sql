-- DEBUG : DÉSACTIVATION TEMPORAIRE SÉCURITÉ
-- Objectif : Déterminer si l'erreur "Database error querying schema" vient des RLS ou des Triggers.

BEGIN;

-- 1. Désactiver RLS sur profiles
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- 2. Désactiver uniquement les triggers utilisateurs (pas les contraintes système)
ALTER TABLE public.profiles DISABLE TRIGGER USER;

-- 3. Forcer le rechargement du schéma PostgREST (au cas où il aurait gardé un cache invalide)
NOTIFY pgrst, 'reload schema';

COMMIT;

DO $$
BEGIN
  RAISE NOTICE 'DEBUG : RLS et Triggers désactivés sur profiles. Schéma rechargé.';
END $$;
