-- Migration: Update commande status constraint
-- Description: Updates the check constraint on commandes.statut to include 'terminee'

-- 1. Drop the existing check constraint
ALTER TABLE commandes 
DROP CONSTRAINT IF EXISTS commandes_statut_check;

-- 2. Add the new check constraint with 'terminee'
ALTER TABLE commandes
ADD CONSTRAINT commandes_statut_check 
CHECK (statut IN ('en_attente', 'validee', 'annulee', 'terminee'));
