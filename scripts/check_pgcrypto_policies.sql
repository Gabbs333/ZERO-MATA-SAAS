-- VERIFICATION DE L'ENVIRONNEMENT ET DES POLICIES EXACTES
-- Ce script vérifie si pgcrypto est accessible et dump la définition exacte des policies

-- 1. VERIFICATION DE PGCRYPTO
SELECT * FROM pg_extension WHERE extname = 'pgcrypto';

-- 2. VERIFICATION DU CHEMIN DE RECHERCHE (SEARCH_PATH)
SHOW search_path;

-- 3. DEFINITION EXACTE DE LA POLICY "allow_all_sessions_policy"
-- On veut voir le QUAL et le WITH CHECK pour s'assurer qu'il n'y a pas de piège
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'auth' 
AND tablename = 'sessions'
AND policyname = 'allow_all_sessions_policy';

-- 4. LOG DEPUIS LE TRIGGER (SI POSSIBLE)
-- On modifie temporairement le trigger pour logger (maintenant que la table existe)
CREATE OR REPLACE FUNCTION public.force_session_id()
RETURNS TRIGGER AS $$
BEGIN
    BEGIN
        IF NEW.id IS NULL THEN
            -- Log avant tentative
            INSERT INTO public.debug_logs (message, details) VALUES ('force_session_id', 'ID is null, generating...');
            NEW.id := gen_random_uuid();
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Log en cas d'erreur
        INSERT INTO public.debug_logs (message, details) VALUES ('ERROR force_session_id', SQLERRM);
        RAISE; -- On laisse l'erreur remonter mais on l'a loggée
    END;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. VERIFICATION DU TRIGGER
SELECT 'TRIGGER UPDATED WITH LOGGING' as status;
