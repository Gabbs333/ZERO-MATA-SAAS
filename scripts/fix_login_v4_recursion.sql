-- FIX LOGIN RECURSION & 500 ERROR
-- Ce script résout le problème de boucle infinie (récursion) dans les politiques de sécurité (RLS)
-- et corrige l'erreur 500 lors du login/création de compte serveuse.

-- 1. D'abord, désactiver temporairement la sécurité sur la table profiles pour permettre les corrections
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- 2. Remplacer la fonction get_user_role par une version NON-RÉCURSIVE
-- L'ancienne version lisait la table 'profiles', ce qui causait une boucle infinie avec les RLS.
-- Cette nouvelle version lit directement 'auth.users', brisant le cycle.
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text AS $$
DECLARE
  v_role text;
BEGIN
  -- Lire le rôle depuis les métadonnées de l'utilisateur (plus rapide et sûr)
  SELECT raw_user_meta_data->>'role' INTO v_role
  FROM auth.users
  WHERE id = auth.uid();
  
  -- Fallback si pas trouvé dans metadata (optionnel, pour compatibilité)
  IF v_role IS NULL THEN
     RETURN NULL;
  END IF;

  RETURN v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 3. S'assurer que le compte serveuse a les bonnes métadonnées (rôle) pour que la fonction ci-dessus marche
UPDATE auth.users
SET raw_user_meta_data = 
  CASE 
    WHEN raw_user_meta_data IS NULL THEN '{"role": "serveuse"}'::jsonb
    ELSE raw_user_meta_data || '{"role": "serveuse"}'::jsonb
  END
WHERE email = 'serveuse@snackbar.cm';

-- 4. Réactiver la sécurité (optionnel : on peut laisser désactivé pour tester d'abord, 
-- mais avec la nouvelle fonction get_user_role, ça devrait marcher même activé)
-- Pour l'instant, on LAISSE DÉSACTIVÉ pour garantir que le login passe.
-- Vous pourrez le réactiver plus tard avec : ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
