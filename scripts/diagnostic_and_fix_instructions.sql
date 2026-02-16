-- Ce script diagnostique les permissions et tente de réparer l'ID de session.
-- S'il échoue, il vous donnera les instructions exactes pour le faire via l'interface Supabase.

DO $$
DECLARE
    v_owner text;
    v_user text;
BEGIN
    -- Récupérer l'utilisateur actuel et le propriétaire de la table
    SELECT current_user INTO v_user;
    SELECT tableowner INTO v_owner FROM pg_tables WHERE schemaname = 'auth' AND tablename = 'sessions';
    
    RAISE NOTICE '---------------------------------------------------';
    RAISE NOTICE 'DIAGNOSTIC PERMISSIONS';
    RAISE NOTICE 'Utilisateur actuel (SQL Editor) : %', v_user;
    RAISE NOTICE 'Propriétaire de auth.sessions   : %', v_owner;
    RAISE NOTICE '---------------------------------------------------';

    BEGIN
        -- Tentative de réparation automatique
        ALTER TABLE auth.sessions ALTER COLUMN id SET DEFAULT gen_random_uuid();
        RAISE NOTICE 'SUCCÈS MAGNIFIQUE : La colonne auth.sessions.id a été réparée via SQL !';
        RAISE NOTICE 'Vous pouvez maintenant retester la connexion.';
        
        -- Tentative de réparation pour refresh_tokens aussi
        BEGIN
            ALTER TABLE auth.refresh_tokens ALTER COLUMN id SET DEFAULT gen_random_uuid();
            RAISE NOTICE 'SUCCÈS : auth.refresh_tokens.id réparé aussi.';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Note: Impossible de réparer refresh_tokens (moins grave).';
        END;

    EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'ÉCHEC AUTOMATIQUE (Erreur 42501) : Droits insuffisants.';
        RAISE NOTICE '---------------------------------------------------';
        RAISE NOTICE 'ACTION REQUISE (SOLUTION VIA INTERFACE SUPABASE) :';
        RAISE NOTICE 'Veuillez suivre ces étapes simples dans le tableau de bord Supabase :';
        RAISE NOTICE '1. Cliquez sur l''icône "Table Editor" (la grille) dans la barre latérale gauche.';
        RAISE NOTICE '2. En haut de la liste des tables, changez le schéma de "public" à "auth".';
        RAISE NOTICE '3. Cliquez sur la table "sessions".';
        RAISE NOTICE '4. Repérez la colonne "id" (la première normalement).';
        RAISE NOTICE '5. Cliquez sur la petite flèche à droite du nom "id" -> "Edit Column".';
        RAISE NOTICE '6. Dans le champ "Default Value", écrivez exactement : gen_random_uuid()';
        RAISE NOTICE '   (Si gen_random_uuid() n''est pas proposé, essayez uuid_generate_v4())';
        RAISE NOTICE '7. Cliquez sur "Save".';
        RAISE NOTICE '---------------------------------------------------';
        RAISE NOTICE 'Une fois cela fait, la connexion fonctionnera.';
    WHEN OTHERS THEN
        RAISE NOTICE 'Erreur imprévue : %', SQLERRM;
    END;
END $$;
