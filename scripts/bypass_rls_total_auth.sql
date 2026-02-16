-- Script "Terre Brûlée" pour le RLS Auth
-- Applique une policy permissive sur TOUTES les tables du schéma auth qui ont RLS activé.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'auth'
    LOOP
        BEGIN
            -- 1. Supprimer l'ancienne policy si elle existe
            EXECUTE format('DROP POLICY IF EXISTS "Allow all %I" ON auth.%I', r.tablename, r.tablename);
            
            -- 2. Créer la nouvelle policy permissive
            -- On utilise DO pour ignorer les erreurs si RLS n'est pas activable ou si la table ne supporte pas les policies
            EXECUTE format('CREATE POLICY "Allow all %I" ON auth.%I FOR ALL USING (true) WITH CHECK (true)', r.tablename, r.tablename);
            
            RAISE NOTICE 'Policy permissive appliquée sur auth.%', r.tablename;
        EXCEPTION WHEN OTHERS THEN
            -- On ignore les erreurs (ex: tables qui ne supportent pas RLS comme les vues)
            RAISE NOTICE 'Info: Pas de policy sur auth.% (%)', r.tablename, SQLERRM;
        END;
    END LOOP;
END $$;

-- Vérification finale
SELECT schemaname, tablename, policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE schemaname = 'auth'
ORDER BY tablename;
