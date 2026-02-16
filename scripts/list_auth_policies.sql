-- LISTER ET SUPPRIMER LES POLITIQUES SUR AUTH
-- Comme on ne peut pas désactiver le RLS (permission denied), on va chercher et supprimer les politiques individuelles.

-- 1. Lister les politiques existantes sur le schéma auth
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    roles
FROM pg_policies
WHERE schemaname = 'auth';

-- 2. Si des politiques apparaissent ci-dessus, il faudra exécuter :
-- DROP POLICY "nom_politique" ON auth.nom_table;
