-- Migration: Création de la table clients et lien avec les commandes
-- Description: Permet de gérer des contacts clients, les lier aux commandes,
-- et suivre les ventes à crédit, la valeur client, et les notes cumulatives.
-- Created: 2026-04-14

-- ============================================================================
-- TABLE CLIENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL DEFAULT '',
  telephone TEXT,
  email TEXT,
  notes TEXT,
  actif BOOLEAN NOT NULL DEFAULT true,
  etablissement_id UUID NOT NULL REFERENCES etablissements(id),
  date_creation TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  date_modification TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- UNIQUE : un client par établissement (nom + prénom + téléphone)
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_unique
  ON clients (etablissement_id, nom, prenom, COALESCE(telephone, ''));

-- ============================================================================
-- AJOUT DE client_id SUR commandes
-- ============================================================================

ALTER TABLE commandes
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_commandes_client ON commandes(client_id);

-- ============================================================================
-- VUE : Statistiques clients
-- ============================================================================

CREATE OR REPLACE VIEW client_stats AS
SELECT
  cl.id AS client_id,
  cl.nom,
  cl.prenom,
  cl.telephone,
  cl.email,
  cl.etablissement_id,
  COUNT(DISTINCT c.id) AS nombre_commandes,
  COALESCE(SUM(c.montant_total), 0) AS chiffre_affaires_total,
  COALESCE(SUM(f.montant_restant), 0) AS solde_restant,
  COALESCE(SUM(f.montant_paye), 0) AS montant_paye_total,
  MAX(c.date_creation) AS derniere_commande,
  MIN(c.date_creation) AS premiere_commande,
  COUNT(DISTINCT DATE(c.date_creation)) AS jours_actifs
FROM clients cl
LEFT JOIN commandes c ON c.client_id = cl.id AND c.statut = 'validee'
LEFT JOIN factures f ON f.commande_id = c.id
GROUP BY cl.id, cl.nom, cl.prenom, cl.telephone, cl.email, cl.etablissement_id;

-- ============================================================================
-- VUE : Commandes du jour par client (pour note cumulative de soirée)
-- ============================================================================

CREATE OR REPLACE VIEW client_commandes_jour AS
SELECT
  cl.id AS client_id,
  cl.nom,
  cl.prenom,
  cl.etablissement_id,
  DATE(c.date_creation) AS jour,
  COUNT(DISTINCT c.id) AS nb_commandes_jour,
  COALESCE(SUM(c.montant_total), 0) AS total_jour,
  COALESCE(SUM(f.montant_paye), 0) AS paye_jour,
  COALESCE(SUM(f.montant_restant), 0) AS restant_jour
FROM clients cl
JOIN commandes c ON c.client_id = cl.id AND c.statut = 'validee'
LEFT JOIN factures f ON f.commande_id = c.id
WHERE DATE(c.date_creation) = CURRENT_DATE
GROUP BY cl.id, cl.nom, cl.prenom, cl.etablissement_id, DATE(c.date_creation);

-- ============================================================================
-- FONCTION : Note client (cumul des commandes de la soirée)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_note_client(
  p_client_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'client_id', cl.id,
    'nom', cl.nom,
    'prenom', cl.prenom,
    'date', p_date,
    'nombre_commandes', COUNT(DISTINCT c.id),
    'total_consomme', COALESCE(SUM(c.montant_total), 0),
    'total_paye', COALESCE(SUM(f.montant_paye), 0),
    'reste_a_payer', COALESCE(SUM(f.montant_restant), 0),
    'commandes', (
      SELECT json_agg(json_build_object(
        'commande_id', cmd.id,
        'numero_commande', cmd.numero_commande,
        'montant_total', cmd.montant_total,
        'table_numero', t.numero,
        'heure', TO_CHAR(cmd.date_creation, 'HH24:MI')
      ) ORDER BY cmd.date_creation)
      FROM commandes cmd
      JOIN tables t ON cmd.table_id = t.id
      WHERE cmd.client_id = cl.id
        AND cmd.statut = 'validee'
        AND DATE(cmd.date_creation) = p_date
    )
  ) INTO v_result
  FROM clients cl
  LEFT JOIN commandes c ON c.client_id = cl.id AND c.statut = 'validee' AND DATE(c.date_creation) = p_date
  LEFT JOIN factures f ON f.commande_id = c.id
  WHERE cl.id = p_client_id
  GROUP BY cl.id, cl.nom, cl.prenom;

  RETURN v_result;
END;
$$;

-- ============================================================================
-- RLS
-- ============================================================================

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_read_establishment_clients"
  ON clients FOR SELECT
  TO authenticated
  USING (
    etablissement_id = (SELECT public.get_user_etablissement_id())
  );

CREATE POLICY "staff_insert_clients"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('patron', 'gerant', 'comptoir')
      AND p.actif = true
      AND p.etablissement_id = clients.etablissement_id
    )
  );

CREATE POLICY "staff_update_clients"
  ON clients FOR UPDATE
  TO authenticated
  USING (
    etablissement_id = (SELECT public.get_user_etablissement_id())
  )
  WITH CHECK (
    etablissement_id = (SELECT public.get_user_etablissement_id())
  );

-- ============================================================================
-- PERMISSIONS
-- ============================================================================

GRANT SELECT ON client_stats TO authenticated;
GRANT SELECT ON client_commandes_jour TO authenticated;
GRANT EXECUTE ON FUNCTION get_note_client(UUID, DATE) TO authenticated;

-- ============================================================================
-- COMMENTAIRES
-- ============================================================================

COMMENT ON TABLE clients IS 'Contacts clients pour le suivi des ventes à crédit et la valeur client.';
COMMENT ON COLUMN commandes.client_id IS 'Lien optionnel vers un client (pour ventes à crédit, note de soirée).';
COMMENT ON VIEW client_stats IS 'Statistiques agrégées par client : CA total, solde restant, fréquence.';
COMMENT ON VIEW client_commandes_jour IS 'Commandes du jour groupées par client pour la note de soirée.';
COMMENT ON FUNCTION get_note_client(UUID, DATE) IS 'Retourne la note consolidée d''un client pour une date donnée : toutes les commandes, total, reste à payer.';
