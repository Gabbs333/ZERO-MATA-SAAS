-- Insérer un établissement de test
-- À exécuter dans l'éditeur SQL de Supabase

INSERT INTO public.etablissements (nom, adresse, telephone, email, statut_abonnement, actif)
SELECT 'Etablissement Test', '123 Rue du Test, Yaoundé', '+237 600000000', 'contact@test.com', 'actif', true
WHERE NOT EXISTS (
    SELECT 1 FROM public.etablissements WHERE nom = 'Etablissement Test'
);

-- Vérifier l'insertion
SELECT * FROM public.etablissements WHERE nom = 'Etablissement Test';
