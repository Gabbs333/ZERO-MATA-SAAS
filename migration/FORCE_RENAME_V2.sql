-- ============================================================================
-- SCRIPT DE CORRECTION FORCÉE - TENTATIVE 2
-- ============================================================================
-- Il semble que la colonne s'appelle 'quantite_disponible' dans le schéma initial,
-- et non 'quantite' ni 'quantite_actuelle'.
-- Ce script va tout normaliser vers 'quantite_actuelle' pour correspondre au frontend.

DO $$
BEGIN
    -- 1. Si 'quantite_disponible' existe, on la renomme en 'quantite_actuelle'
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stocks' AND column_name = 'quantite_disponible') THEN
        ALTER TABLE stocks RENAME COLUMN quantite_disponible TO quantite_actuelle;
    END IF;

    -- 2. Si 'quantite' existe, on la renomme en 'quantite_actuelle' (au cas où)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stocks' AND column_name = 'quantite') THEN
        ALTER TABLE stocks RENAME COLUMN quantite TO quantite_actuelle;
    END IF;

    -- 3. Si aucune des deux n'existe mais que 'quantite_actuelle' n'existe pas non plus, on crée la colonne
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stocks' AND column_name = 'quantite_actuelle') THEN
        ALTER TABLE stocks ADD COLUMN quantite_actuelle INTEGER DEFAULT 0;
    END IF;
END $$;

-- 4. Ajouter les autres colonnes manquantes (si nécessaire)
ALTER TABLE stocks ADD COLUMN IF NOT EXISTS seuil_alerte INTEGER DEFAULT 10;
ALTER TABLE stocks ADD COLUMN IF NOT EXISTS derniere_mise_a_jour TIMESTAMP WITH TIME ZONE DEFAULT NOW();
