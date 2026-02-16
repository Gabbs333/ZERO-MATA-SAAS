-- FIX COMPLET DES PERMISSIONS ET DONNÉES
-- 1. Réparer les permissions du rôle d'authentification (Supabase Auth)
-- 2. Mettre à jour les données pour débloquer l'App Patron

BEGIN;

-- =================================================================
-- 1. FIX SYSTEME & AUTH (Pour l'erreur "Database error querying schema")
-- =================================================================

-- S'assurer que le schéma extensions existe et est accessible
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, authenticated, anon, service_role, dashboard_user;
-- IMPORTANT: Le rôle supabase_auth_admin est celui utilisé par GoTrue
GRANT USAGE ON SCHEMA extensions TO supabase_auth_admin;

-- S'assurer que pgcrypto est bien là (utilisé pour le hashage des mots de passe)
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

-- Accorder les droits sur le schéma public à supabase_auth_admin
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT ALL ON ALL TABLES IN SCHEMA public TO supabase_auth_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO supabase_auth_admin;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO supabase_auth_admin;

-- Accorder les droits sur le schéma auth (critique)
GRANT USAGE ON SCHEMA auth TO supabase_auth_admin;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO supabase_auth_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO supabase_auth_admin;
GRANT ALL ON ALL ROUTINES IN SCHEMA auth TO supabase_auth_admin;

-- Configurer le search_path pour être sûr
ALTER ROLE supabase_auth_admin SET search_path = public, auth, extensions;

-- =================================================================
-- 2. FIX DONNÉES PATRON & COMPTOIR (Pour l'erreur d'abonnement)
-- =================================================================

-- Activer tous les établissements et mettre leur abonnement à 'actif'
UPDATE public.etablissements
SET 
    actif = true,
    statut_abonnement = 'actif',
    updated_at = NOW();

-- S'assurer que le profil Patron/Gérant est lié à un établissement actif
-- (On suppose ici qu'il y a un établissement de test, sinon on en crée un)
DO $$
DECLARE
    v_etablissement_id UUID;
BEGIN
    -- Chercher un établissement existant
    SELECT id INTO v_etablissement_id FROM public.etablissements LIMIT 1;

    -- Si pas d'établissement, en créer un
    IF v_etablissement_id IS NULL THEN
        v_etablissement_id := gen_random_uuid();
        INSERT INTO public.etablissements (id, nom, code_unique, actif, statut_abonnement)
        VALUES (v_etablissement_id, 'Bar Test', 'TEST01', true, 'actif');
    END IF;

    -- Lier tous les profils (sauf Admin système) à cet établissement pour les tests
    UPDATE public.profiles
    SET etablissement_id = v_etablissement_id
    WHERE role != 'admin' AND etablissement_id IS NULL;
END $$;

-- =================================================================
-- 3. NETTOYAGE FINAL
-- =================================================================

-- Recharger la configuration du schéma (PostgREST)
NOTIFY pgrst, 'reload schema';

COMMIT;
