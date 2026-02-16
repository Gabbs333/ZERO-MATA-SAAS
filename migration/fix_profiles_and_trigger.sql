-- ============================================================================
-- FIX: Ensure profiles table has etablissement_id and trigger is correct
-- ============================================================================

-- 1. Create etablissements table if it doesn't exist (it should, but safety first)
CREATE TABLE IF NOT EXISTS public.etablissements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nom TEXT NOT NULL,
  adresse TEXT,
  telephone TEXT,
  email TEXT,
  logo_url TEXT,
  statut_abonnement TEXT NOT NULL CHECK (statut_abonnement IN ('actif', 'expire', 'suspendu')) DEFAULT 'actif',
  date_debut TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  date_fin TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '12 months'),
  actif BOOLEAN NOT NULL DEFAULT true,
  dernier_paiement_date TIMESTAMPTZ,
  dernier_paiement_confirme_par UUID REFERENCES auth.users(id),
  date_creation TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  date_modification TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Add etablissement_id to profiles if missing
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS etablissement_id UUID REFERENCES public.etablissements(id) ON DELETE RESTRICT;

-- 3. Redefine the trigger function (now that column definitely exists)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nom, prenom, role, actif, etablissement_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nom', 'Non renseigné'),
    COALESCE(NEW.raw_user_meta_data->>'prenom', 'Non renseigné'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'serveuse'),
    TRUE,
    (NEW.raw_user_meta_data->>'etablissement_id')::UUID
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
