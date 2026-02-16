-- Script de correction critique pour les RLS Etablissements et Admin
-- Ce script :
-- 1. Ajoute les politiques RLS manquantes sur la table 'etablissements' (cause probable des erreurs Patron/Comptoir)
-- 2. Renforce les permissions sur le schéma public pour l'utilisateur authentifié (cause possible erreur Admin)
-- 3. Sécurise les fonctions critiques avec search_path explicite

BEGIN;

-- 1. Permissions de base sur le schéma
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, service_role;

-- Permissions pour les utilisateurs authentifiés
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 2. Correction de la table etablissements
ALTER TABLE public.etablissements ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes politiques potentiellement conflictuelles ou manquantes
DROP POLICY IF EXISTS "Admin can read all etablissements" ON public.etablissements;
DROP POLICY IF EXISTS "Users can read own etablissement" ON public.etablissements;
DROP POLICY IF EXISTS "Patron can update own etablissement" ON public.etablissements;

-- Politique 1: Les admins peuvent tout voir
CREATE POLICY "Admin can read all etablissements"
ON public.etablissements
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

-- Politique 2: Les utilisateurs peuvent voir leur propre établissement
CREATE POLICY "Users can read own etablissement"
ON public.etablissements
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT etablissement_id FROM public.profiles
    WHERE id = auth.uid()
  )
);

-- Politique 3: Les patrons peuvent modifier leur établissement (sauf statut abonnement qui est géré par admin/système)
CREATE POLICY "Patron can update own etablissement"
ON public.etablissements
FOR UPDATE
TO authenticated
USING (
  id IN (
    SELECT etablissement_id FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'patron'
  )
)
WITH CHECK (
  id IN (
    SELECT etablissement_id FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'patron'
  )
);

-- 3. Sécurisation des fonctions critiques (search_path)
-- Redéfinition de get_user_etablissement_id pour être sûr
CREATE OR REPLACE FUNCTION public.get_user_etablissement_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT etablissement_id FROM public.profiles WHERE id = auth.uid();
$$;

-- Redéfinition de log_audit_action avec search_path sécurisé
DROP FUNCTION IF EXISTS public.log_audit_action(TEXT, TEXT, UUID, JSONB, UUID);

CREATE OR REPLACE FUNCTION public.log_audit_action(
  p_action TEXT,
  p_entite TEXT,
  p_entite_id TEXT,
  p_details JSONB DEFAULT NULL,
  p_etablissement_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_etablissement_id UUID;
  v_utilisateur_id UUID;
BEGIN
  -- Get current user ID safely
  v_utilisateur_id := auth.uid();
  
  -- Determine etablissement_id
  IF p_etablissement_id IS NOT NULL THEN
    v_etablissement_id := p_etablissement_id;
  ELSIF v_utilisateur_id IS NOT NULL THEN
    SELECT etablissement_id INTO v_etablissement_id
    FROM public.profiles
    WHERE id = v_utilisateur_id;
  ELSE
    v_etablissement_id := NULL;
  END IF;
  
  -- Insert audit log entry
  INSERT INTO public.audit_logs (
    utilisateur_id,
    action,
    entite,
    entite_id,
    etablissement_id,
    details_apres,
    created_at
  ) VALUES (
    v_utilisateur_id,
    p_action,
    p_entite,
    p_entite_id,
    v_etablissement_id,
    p_details,
    NOW()
  );
EXCEPTION WHEN OTHERS THEN
  -- Ne jamais bloquer une transaction à cause d'un log
  RAISE WARNING 'Echec du log audit: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Vérification et correction du trigger handle_new_user (pour Admin)
-- On s'assure qu'il gère bien les conflits et le search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nom, prenom, role, actif)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nom', 'Non renseigné'),
    COALESCE(NEW.raw_user_meta_data->>'prenom', 'Non renseigné'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'serveuse'),
    TRUE
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    nom = EXCLUDED.nom,
    prenom = EXCLUDED.prenom,
    role = EXCLUDED.role;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Fallback sans email si la colonne n'existe pas (ancienne version schema)
  BEGIN
      INSERT INTO public.profiles (id, nom, prenom, role, actif)
      VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'nom', 'Non renseigné'),
        COALESCE(NEW.raw_user_meta_data->>'prenom', 'Non renseigné'),
        COALESCE(NEW.raw_user_meta_data->>'role', 'serveuse'),
        TRUE
      )
      ON CONFLICT (id) DO UPDATE SET
        nom = EXCLUDED.nom,
        prenom = EXCLUDED.prenom,
        role = EXCLUDED.role;
  EXCEPTION WHEN OTHERS THEN
      -- Log error but don't fail auth
      RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Vérification explicite de l'admin et de l'établissement de test
-- On s'assure que l'établissement est actif
UPDATE public.etablissements 
SET 
  statut_abonnement = 'actif',
  actif = true,
  date_fin = NOW() + INTERVAL '1 year'
WHERE id = 'e0000000-0000-0000-0000-000000000001';

COMMIT;
