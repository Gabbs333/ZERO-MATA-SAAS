-- Script de vérification UNIQUEMENT
-- Lancez ce script APRÈS avoir fait la modification manuelle dans l'interface.

DO $$
DECLARE
    v_col_default text;
BEGIN
    SELECT column_default INTO v_col_default
    FROM information_schema.columns
    WHERE table_schema = 'auth' 
      AND table_name = 'sessions' 
      AND column_name = 'id';

    RAISE NOTICE '---------------------------------------------------';
    RAISE NOTICE 'VÉRIFICATION DU FIX';
    RAISE NOTICE 'Valeur par défaut trouvée : %', COALESCE(v_col_default, 'AUCUNE (Echec)');
    
    IF v_col_default IS NOT NULL THEN
        RAISE NOTICE '✅ SUCCÈS : La configuration est correcte !';
        RAISE NOTICE 'Vous pouvez maintenant tenter de vous connecter.';
    ELSE
        RAISE EXCEPTION '❌ ÉCHEC : La colonne n''a toujours pas de valeur par défaut.';
    END IF;
END $$;
