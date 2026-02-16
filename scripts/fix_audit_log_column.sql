-- FIX: AJOUT DE LA COLONNE MANQUANTE DANS AUDIT_LOGS
-- Ce script vérifie et ajoute la colonne etablissement_id si elle manque
-- C'est probablement la cause de l'erreur "Database error querying schema" lors du login Admin

BEGIN;

-- 1. Ajouter la colonne si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'audit_logs' 
        AND column_name = 'etablissement_id'
    ) THEN
        ALTER TABLE public.audit_logs 
        ADD COLUMN etablissement_id UUID REFERENCES public.etablissements(id) ON DELETE SET NULL;
        
        RAISE NOTICE 'Colonne etablissement_id ajoutée à audit_logs';
    ELSE
        RAISE NOTICE 'Colonne etablissement_id existe déjà';
    END IF;
END $$;

-- 2. S'assurer que les politiques RLS sur audit_logs permettent l'insertion
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre aux utilisateurs authentifiés d'insérer des logs (via triggers ou RPC)
DROP POLICY IF EXISTS "Insert audit logs" ON public.audit_logs;
CREATE POLICY "Insert audit logs"
    ON public.audit_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Politique pour permettre à l'admin de voir les logs
DROP POLICY IF EXISTS "Admin view audit logs" ON public.audit_logs;
CREATE POLICY "Admin view audit logs"
    ON public.audit_logs
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role = 'admin'
        )
    );

-- 3. Accorder les droits explicites sur la séquence (si serial) ou table
GRANT ALL ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

-- 4. Redéfinir la fonction d'audit pour être sûr qu'elle est correcte
CREATE OR REPLACE FUNCTION public.log_audit_action(
  p_action TEXT,
  p_entite TEXT,
  p_entite_id TEXT, -- Changé en TEXT pour correspondre à la table (ou UUID casté)
  p_details JSONB DEFAULT NULL,
  p_etablissement_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_etablissement_id UUID;
  v_utilisateur_id UUID;
BEGIN
  -- Get current user ID
  v_utilisateur_id := auth.uid();
  
  -- Determine etablissement_id
  IF p_etablissement_id IS NOT NULL THEN
    v_etablissement_id := p_etablissement_id;
  ELSE
    -- Tentative de récupération depuis le profil si fonction existe
    -- Sinon NULL (pour éviter crash si get_current_user_etablissement_id n'existe pas)
    BEGIN
        SELECT etablissement_id INTO v_etablissement_id FROM public.profiles WHERE id = auth.uid();
    EXCEPTION WHEN OTHERS THEN
        v_etablissement_id := NULL;
    END;
  END IF;
  
  -- Insert audit log entry
  INSERT INTO public.audit_logs (
    utilisateur_id,
    action,
    entite,
    entite_id,
    etablissement_id,
    details_apres
  ) VALUES (
    v_utilisateur_id,
    p_action,
    p_entite,
    p_entite_id,
    v_etablissement_id,
    p_details
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMIT;
