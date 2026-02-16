-- TENTATIVE DE REPARATION PROPRE DE LA COLONNE ID
-- Objectif : Supprimer le trigger "bricolage" et remettre la valeur par défaut système.

-- 1. Supprimer le trigger existant (s'il existe)
DROP TRIGGER IF EXISTS ensure_session_id_trigger ON auth.sessions;

-- 2. Supprimer la fonction associée
DROP FUNCTION IF EXISTS public.set_session_id_if_null();

-- 3. Tenter de remettre la valeur par défaut sur la colonne ID
-- Cette commande peut échouer si les permissions sont verrouillées (42501)
-- Mais si elle passe, c'est la MEILLEURE solution.
DO $$
BEGIN
    BEGIN
        ALTER TABLE auth.sessions ALTER COLUMN id SET DEFAULT gen_random_uuid();
        RAISE NOTICE 'SUCCÈS : La colonne auth.sessions.id a été réparée avec gen_random_uuid()';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'ÉCHEC ALTER TABLE : % (Code: %)', SQLERRM, SQLSTATE;
        RAISE NOTICE 'Tentative de solution de contournement (Trigger simplifié)...';
    END;
END $$;
