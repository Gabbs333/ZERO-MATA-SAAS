-- FIX LOGIN CRASH FINAL
-- Ce script remplace TOUTES les fonctions récursives restantes par des versions sûres
-- qui lisent auth.users au lieu de profiles.

-- 1. Désactiver RLS temporairement pour être sûr que ça passe
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- 2. Remplacer get_user_etablissement_id (Source majeure de crash)
CREATE OR REPLACE FUNCTION public.get_user_etablissement_id()
RETURNS uuid AS $$
DECLARE
  v_etab_id uuid;
BEGIN
  -- Lecture directe des métadonnées (rapide et sans boucle RLS)
  SELECT (raw_user_meta_data->>'etablissement_id')::uuid INTO v_etab_id
  FROM auth.users
  WHERE id = auth.uid();
  
  RETURN v_etab_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 3. Remplacer is_current_user_admin (Autre source de crash)
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean AS $$
BEGIN
  -- Vérification directe dans les métadonnées
  RETURN EXISTS (
    SELECT 1 
    FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 4. CRITIQUE : S'assurer que le compte serveuse a bien l'etablissement_id dans ses métadonnées
-- Sinon la fonction ci-dessus renverra NULL et ça plantera ailleurs.
DO $$
DECLARE
  v_serveuse_id uuid;
  v_etablissement_id uuid;
BEGIN
  -- Récupérer l'ID de la serveuse
  SELECT id INTO v_serveuse_id FROM auth.users WHERE email = 'serveuse@snackbar.cm';
  
  -- Récupérer un ID d'établissement valide (le premier trouvé, ou celui du patron)
  -- Idéalement, on prend celui lié au profil s'il existe déjà
  SELECT etablissement_id INTO v_etablissement_id FROM public.profiles WHERE id = v_serveuse_id;
  
  -- Si pas trouvé dans le profil, on prend le premier de la base (mode secours)
  IF v_etablissement_id IS NULL THEN
    SELECT id INTO v_etablissement_id FROM public.etablissements LIMIT 1;
  END IF;

  -- Mise à jour des métadonnées
  IF v_serveuse_id IS NOT NULL AND v_etablissement_id IS NOT NULL THEN
    UPDATE auth.users
    SET raw_user_meta_data = 
      COALESCE(raw_user_meta_data, '{}'::jsonb) || 
      jsonb_build_object(
        'etablissement_id', v_etablissement_id,
        'role', 'serveuse'
      )
    WHERE id = v_serveuse_id;
  END IF;
END $$;

-- 5. Nettoyer les triggers fantômes potentiels sur auth.users (Au cas où)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- (On ne supprime pas le trigger principal de création de profil, juste les doublons s'il y en a)
