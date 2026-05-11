-- Migration: Gestion des ventes à crédit et suivi du crédit client
-- Description: Ajoute les limites de crédit, le suivi des paiements crédit,
-- et une vue des créances clients avec alertes de dépassement.
-- Created: 2026-04-14

-- ============================================================================
-- 1. AJOUT DES COLONNES DE CRÉDIT SUR CLIENTS
-- ============================================================================

ALTER TABLE clients
ADD COLUMN IF NOT EXISTS credit_active BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE clients
ADD COLUMN IF NOT EXISTS credit_limit INTEGER DEFAULT 0 CHECK (credit_limit >= 0);

COMMENT ON COLUMN clients.credit_active IS 'Si true, ce client peut acheter à crédit.';
COMMENT ON COLUMN clients.credit_limit IS 'Plafond de crédit autorisé pour ce client (en XAF). 0 = illimité.';

-- ============================================================================
-- 2. COLONNE credit_sur sur factures (marquer une facture comme vente à crédit)
-- ============================================================================

ALTER TABLE factures
ADD COLUMN IF NOT EXISTS credit_sur BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN factures.credit_sur IS 'Si true, cette facture est une vente à crédit (paiement différé).';

-- ============================================================================
-- 3. TABLE DES PAIEMENTS CRÉDIT (paiements globaux sur le solde client)
-- ============================================================================

CREATE TABLE IF NOT EXISTS credit_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id),
  montant INTEGER NOT NULL CHECK (montant > 0),
  mode_paiement TEXT NOT NULL CHECK (mode_paiement IN ('especes', 'mobile_money', 'carte_bancaire')),
  reference TEXT,
  notes TEXT,
  utilisateur_id UUID NOT NULL REFERENCES profiles(id),
  date_paiement TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  etablissement_id UUID NOT NULL REFERENCES etablissements(id)
);

CREATE INDEX IF NOT EXISTS idx_credit_payments_client ON credit_payments(client_id);
CREATE INDEX IF NOT EXISTS idx_credit_payments_date ON credit_payments(date_paiement);
CREATE INDEX IF NOT EXISTS idx_credit_payments_etablissement ON credit_payments(etablissement_id);

COMMENT ON TABLE credit_payments IS 'Paiements effectués par un client sur son solde crédit global.';

-- ============================================================================
-- 4. VUE : Créances clients (impayés avec statut de dépassement)
-- ============================================================================

CREATE OR REPLACE VIEW creances_clients AS
SELECT
  cl.id AS client_id,
  cl.nom,
  cl.prenom,
  cl.telephone,
  cl.credit_active,
  cl.credit_limit,
  COALESCE(SUM(f.montant_restant), 0) AS solde_du,
  COUNT(DISTINCT f.id) AS nb_factures_impayees,
  MAX(f.date_generation) AS plus_ancienne_facture,
  -- Jours depuis la plus ancienne facture impayée
  EXTRACT(DAY FROM NOW() - MAX(f.date_generation))::INTEGER AS jours_retard,
  -- Dépassement de la limite de crédit
  CASE
    WHEN cl.credit_limit > 0 AND COALESCE(SUM(f.montant_restant), 0) > cl.credit_limit THEN true
    ELSE false
  END AS depassement_credit,
  cl.etablissement_id
FROM clients cl
JOIN factures f ON f.commande_id IN (
  SELECT c.id FROM commandes c WHERE c.client_id = cl.id AND c.statut = 'validee'
)
WHERE f.statut != 'payee'
  AND cl.credit_active = true
GROUP BY cl.id, cl.nom, cl.prenom, cl.telephone, cl.credit_active, cl.credit_limit, cl.etablissement_id
HAVING COALESCE(SUM(f.montant_restant), 0) > 0
ORDER BY solde_du DESC;

-- ============================================================================
-- 5. FONCTION : Enregistrer un paiement crédit client
-- ============================================================================

CREATE OR REPLACE FUNCTION record_credit_payment(
  p_client_id UUID,
  p_montant INTEGER,
  p_mode_paiement TEXT,
  p_reference TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_etablissement_id UUID;
  v_payment_id UUID;
  v_remaining INTEGER := p_montant;
  v_facture RECORD;
  v_applied INTEGER;
  v_total_applied INTEGER := 0;
  v_factures_paid INTEGER := 0;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Vous devez être connecté.';
  END IF;

  SELECT etablissement_id INTO v_etablissement_id FROM profiles WHERE id = v_caller_id;
  IF v_etablissement_id IS NULL THEN
    RAISE EXCEPTION 'Aucun établissement associé.';
  END IF;

  -- Enregistrer le paiement crédit
  INSERT INTO credit_payments (client_id, montant, mode_paiement, reference, notes, utilisateur_id, etablissement_id)
  VALUES (p_client_id, p_montant, p_mode_paiement, p_reference, p_notes, v_caller_id, v_etablissement_id)
  RETURNING id INTO v_payment_id;

  -- Appliquer le paiement aux factures impayées du client (FIFO : les plus anciennes d'abord)
  FOR v_facture IN
    SELECT f.id, f.montant_restant, f.montant_paye, f.montant_total, f.statut
    FROM factures f
    JOIN commandes c ON f.commande_id = c.id
    WHERE c.client_id = p_client_id
      AND f.statut != 'payee'
      AND c.statut = 'validee'
    ORDER BY f.date_generation ASC
  LOOP
    IF v_remaining <= 0 THEN EXIT; END IF;

    IF v_remaining >= v_facture.montant_restant THEN
      -- Paiement complet de cette facture
      v_applied := v_facture.montant_restant;
      UPDATE factures SET
        montant_paye = montant_total,
        montant_restant = 0,
        statut = 'payee',
        date_paiement_complet = NOW()
      WHERE id = v_facture.id;
      v_factures_paid := v_factures_paid + 1;
    ELSE
      -- Paiement partiel
      v_applied := v_remaining;
      UPDATE factures SET
        montant_paye = montant_paye + v_applied,
        montant_restant = montant_restant - v_applied,
        statut = 'partiellement_payee'
      WHERE id = v_facture.id;
    END IF;

    -- Créer un encaissement pour tracer le paiement
    INSERT INTO encaissements (facture_id, montant, mode_paiement, reference, utilisateur_id, etablissement_id)
    VALUES (v_facture.id, v_applied, p_mode_paiement, 'CREDIT-' || v_payment_id::TEXT, v_caller_id, v_etablissement_id);

    v_remaining := v_remaining - v_applied;
    v_total_applied := v_total_applied + v_applied;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'montant_paye', p_montant,
    'montant_applique', v_total_applied,
    'factures_soldees', v_factures_paid,
    'solde_restant', v_remaining
  );
END;
$$;

-- ============================================================================
-- 6. RLS POUR CREDIT_PAYMENTS
-- ============================================================================

ALTER TABLE credit_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_read_credit_payments"
  ON credit_payments FOR SELECT
  TO authenticated
  USING (
    etablissement_id = (SELECT public.get_user_etablissement_id())
  );

CREATE POLICY "staff_insert_credit_payments"
  ON credit_payments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('patron', 'gerant', 'comptoir')
      AND p.etablissement_id = credit_payments.etablissement_id
    )
  );

-- ============================================================================
-- 7. PERMISSIONS
-- ============================================================================

GRANT SELECT ON creances_clients TO authenticated;
GRANT EXECUTE ON FUNCTION record_credit_payment(UUID, INTEGER, TEXT, TEXT, TEXT) TO authenticated;

-- ============================================================================
-- 8. COMMENTAIRES
-- ============================================================================

COMMENT ON VIEW creances_clients IS 'Créances clients actives : solde dû, jours de retard, dépassement de limite.';
COMMENT ON FUNCTION record_credit_payment(UUID, INTEGER, TEXT, TEXT, TEXT) IS 'Enregistre un paiement crédit et l''applique aux factures impayées du client (FIFO).';
