-- CLEANUP SCRIPT (ROBUST & TRIGGER-PROOF)
-- Ce script nettoie TOUTES les données liées à l'établissement de test.
-- Il gère les contraintes de clés étrangères et les triggers qui pourraient régénérer des logs.

DO $$
DECLARE
    v_etab_id UUID;
BEGIN
    -- 1. Récupérer l'ID de l'établissement de test
    SELECT id INTO v_etab_id FROM public.etablissements WHERE nom = 'Etablissement Test';

    IF v_etab_id IS NOT NULL THEN
        RAISE NOTICE 'Nettoyage des données pour l''établissement: %', v_etab_id;

        -- OPTIONNEL: Désactiver les triggers sur audit_logs pour éviter les blocages/régénérations
        -- (Nécessite des droits admin, ignoré si échec)
        BEGIN
            EXECUTE 'ALTER TABLE public.audit_logs DISABLE TRIGGER ALL';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Note: Impossible de désactiver les triggers sur audit_logs (droits insuffisants), continuation...';
        END;

        -- 2. Supprimer les données dépendantes
        
        -- Logs et Audit (Premier passage)
        DELETE FROM public.audit_logs WHERE etablissement_id = v_etab_id;
        
        -- Finance
        DELETE FROM public.encaissements WHERE etablissement_id = v_etab_id;
        DELETE FROM public.factures WHERE etablissement_id = v_etab_id;
        
        -- Opérations
        DELETE FROM public.commande_items WHERE etablissement_id = v_etab_id;
        DELETE FROM public.commandes WHERE etablissement_id = v_etab_id;
        DELETE FROM public.ravitaillement_items WHERE etablissement_id = v_etab_id;
        DELETE FROM public.ravitaillements WHERE etablissement_id = v_etab_id;
        
        -- Stock et Produits
        DELETE FROM public.mouvements_stock WHERE etablissement_id = v_etab_id;
        DELETE FROM public.stock WHERE etablissement_id = v_etab_id;
        DELETE FROM public.produits WHERE etablissement_id = v_etab_id;
        
        -- Infrastructure
        DELETE FROM public.tables WHERE etablissement_id = v_etab_id;
        
        -- Utilisateurs (Profils)
        -- Attention: La suppression des profils peut déclencher des logs d'audit via trigger!
        DELETE FROM public.profiles WHERE etablissement_id = v_etab_id;
        
        -- 3. NETTOYAGE FINAL DES LOGS (CRITIQUE)
        -- Si des triggers ont recréé des logs lors des suppressions précédentes, on les supprime maintenant.
        DELETE FROM public.audit_logs WHERE etablissement_id = v_etab_id;
        
        -- 4. Enfin, l'établissement lui-même
        DELETE FROM public.etablissements WHERE id = v_etab_id;
        
        -- Réactiver les triggers
        BEGIN
            EXECUTE 'ALTER TABLE public.audit_logs ENABLE TRIGGER ALL';
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;

        RAISE NOTICE '✅ Données de l''établissement supprimées avec succès.';
    ELSE
        RAISE NOTICE '⚠️ Etablissement Test non trouvé (déjà supprimé ?).';
    END IF;

    -- 5. Nettoyage de sécurité par email (utilisateurs orphelins)
    DELETE FROM public.profiles 
    WHERE email IN ('patron@test.com', 'serveuse@test.com', 'comptoir@test.com', 'gerant@test.com');
    
    RAISE NOTICE 'Nettoyage terminé.';
END $$;

-- 6. Tentative de suppression des utilisateurs Auth
DO $$
DECLARE
    user_rec RECORD;
BEGIN
    FOR user_rec IN 
        SELECT id FROM auth.users 
        WHERE email IN ('patron@test.com', 'serveuse@test.com', 'comptoir@test.com', 'gerant@test.com')
    LOOP
        BEGIN
            DELETE FROM auth.users WHERE id = user_rec.id;
            RAISE NOTICE 'Utilisateur Auth supprimé: %', user_rec.id;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '⚠️ Impossible de supprimer l''utilisateur Auth % (Permissions insuffisantes). Faites-le manuellement.', user_rec.id;
        END;
    END LOOP;
END $$;
