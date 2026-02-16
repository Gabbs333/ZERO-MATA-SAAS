-- ============================================================================
-- SCRIPT DE CORRECTION FORCÉE (FORCE RENAME)
-- ============================================================================
-- Ce script corrige l'erreur "column quantite_actuelle does not exist".
-- Il force le renommage de la colonne dans la table 'stocks'.

-- 1. Renommer la colonne 'quantite' en 'quantite_actuelle'
-- Si cette commande échoue avec "column quantite does not exist", vérifiez si elle s'appelle déjà 'quantite_actuelle'.
ALTER TABLE stocks RENAME COLUMN quantite TO quantite_actuelle;

-- 2. Ajouter les colonnes potentiellement manquantes
ALTER TABLE stocks ADD COLUMN IF NOT EXISTS seuil_alerte INTEGER DEFAULT 10;
ALTER TABLE stocks ADD COLUMN IF NOT EXISTS derniere_mise_a_jour TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 3. Vérification (optionnel)
-- SELECT * FROM stocks LIMIT 1;
