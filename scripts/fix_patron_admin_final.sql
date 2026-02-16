-- FIX PATRON ET ADMIN
-- 1. Active l'établissement pour le Patron
-- 2. Donne les droits d'insertion dans audit_logs pour l'Admin

BEGIN;

-- ==============================================================================
-- 1. ACTIVER L'ÉTABLISSEMENT (Pour le Patron)
-- ==============================================================================
-- On s'assure que l'établissement lié au patron test est actif
UPDATE public.etablissements
SET 
  actif = true, 
  statut_abonnement = 'actif'
WHERE id = 'e0000000-0000-0000-0000-000000000001'; -- ID fixe utilisé dans setup_test_data.sql

-- Au cas où le patron serait lié à un autre établissement, on le force aussi
UPDATE public.etablissements
SET 
  actif = true, 
  statut_abonnement = 'actif'
WHERE id IN (
  SELECT etablissement_id FROM public.profiles WHERE role = 'patron'
);


-- ==============================================================================
-- 2. DROITS AUDIT LOGS (Pour l'Admin)
-- ==============================================================================
-- L'admin essaie d'écrire dans audit_logs via log_audit_action.
-- On doit s'assurer que la table est accessible.

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre à TOUT utilisateur authentifié d'insérer des logs
-- C'est nécessaire car tout le monde log des actions (login, etc.)
-- La sécurité est gérée par le fait qu'on ne peut pas modifier/supprimer les logs des autres
DROP POLICY IF EXISTS "Authenticated can insert audit logs" ON audit_logs;

CREATE POLICY "Authenticated can insert audit logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true); -- Tout le monde peut écrire un log

-- Politique de lecture pour l'admin (pour voir les logs)
DROP POLICY IF EXISTS "Admin read audit logs" ON audit_logs;

CREATE POLICY "Admin read audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (get_user_role() = 'admin');

-- Politique de lecture pour le patron (ses propres logs ou ceux de son établissement)
DROP POLICY IF EXISTS "Patron read audit logs" ON audit_logs;

CREATE POLICY "Patron read audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    get_user_role() = 'patron' AND 
    (
       etablissement_id = get_current_user_etablissement_id() OR
       etablissement_id IS NULL -- Voir les logs système globaux si nécessaire
    )
  );


COMMIT;

DO $$
BEGIN
  RAISE NOTICE 'Correctifs appliqués : Établissement activé et droits Audit Logs ouverts.';
END $$;
