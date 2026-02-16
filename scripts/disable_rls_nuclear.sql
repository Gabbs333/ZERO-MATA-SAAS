-- OPTION NUCLÉAIRE : DÉSACTIVATION TOTALE DE LA SÉCURITÉ POUR ISOLER LE BUG
-- Le script Node.js a montré un TIMEOUT (10 secondes), ce qui indique une BOUCLE INFINIE.
-- C'est typique d'une politique RLS qui s'appelle elle-même récursivement.

BEGIN;

-- 1. Désactiver RLS sur la table profiles (Arrêt immédiat de toute vérification de sécurité)
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- 2. Nettoyer les triggers sur auth.sessions (au cas où ils lancent des boucles)
DO $$
DECLARE
    trig RECORD;
BEGIN
    FOR trig IN 
        SELECT trigger_name 
        FROM information_schema.triggers 
        WHERE event_object_schema = 'auth' 
        AND (event_object_table = 'sessions' OR event_object_table = 'refresh_tokens')
        AND trigger_name NOT LIKE 'supabase_%'
        AND trigger_name NOT LIKE 'gotrue_%'
    LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS "' || trig.trigger_name || '" ON ' || trig.event_object_schema || '.' || trig.event_object_table || ';';
        RAISE NOTICE 'Trigger supprimé : %', trig.trigger_name;
    END LOOP;
END $$;

COMMIT;

SELECT 'RLS désactivé sur profiles. Si le login marche maintenant, c''était une boucle RLS.' as status;
