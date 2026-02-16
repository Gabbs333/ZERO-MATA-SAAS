-- NUCLEAR TRIGGER CLEANUP
-- Ce script supprime TOUS les triggers potentiels sur auth.users sauf celui de création standard.
-- Il désactive aussi le RLS sur profiles de manière définitive pour le debug.

-- 1. Désactiver le RLS sur profiles (Force brute)
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- 2. Supprimer les triggers connus qui pourraient causer des boucles
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
DROP TRIGGER IF EXISTS on_user_logged_in ON auth.users;
DROP TRIGGER IF EXISTS sync_user_profile ON auth.users;
DROP TRIGGER IF EXISTS update_profile_on_login ON auth.users;
DROP TRIGGER IF EXISTS check_role_on_login ON auth.users;

-- 3. Supprimer tout trigger sur auth.users qui s'exécuterait en UPDATE
-- Attention : code dynamique pour nettoyer ce qu'on ne connait pas par nom
DO $$
DECLARE
    trg_name text;
BEGIN
    FOR trg_name IN 
        SELECT tgname 
        FROM pg_trigger 
        JOIN pg_class ON pg_trigger.tgrelid = pg_class.oid 
        JOIN pg_namespace ON pg_class.relnamespace = pg_namespace.oid 
        WHERE nspname = 'auth' AND relname = 'users' 
        AND tgname != 'on_auth_user_created' -- On garde celui-ci (création profil)
    LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(trg_name) || ' ON auth.users CASCADE';
        RAISE NOTICE 'Trigger supprimé : %', trg_name;
    END LOOP;
END $$;

-- 4. Vérifier qu'il ne reste QUE le trigger de création (INSERT)
SELECT tgname, tgtype 
FROM pg_trigger 
JOIN pg_class ON pg_trigger.tgrelid = pg_class.oid 
JOIN pg_namespace ON pg_class.relnamespace = pg_namespace.oid 
WHERE nspname = 'auth' AND relname = 'users';
