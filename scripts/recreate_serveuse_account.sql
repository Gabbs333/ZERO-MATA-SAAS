-- RECREATION TOTALE DU COMPTE SERVEUSE (CORRIGÉ)
-- Objectif : Supprimer l'ancien compte et en recréer un neuf en contournant les contraintes du trigger.
-- Stratégie : Fournir les métadonnées nécessaires au trigger lors de la création, puis les nettoyer pour s'aligner sur les comptes fonctionnels.

BEGIN;

-- 1. Nettoyage préalable (Profils et Users)
-- On utilise une suppression en cascade manuelle pour être sûr
DELETE FROM public.profiles 
WHERE id IN (SELECT id FROM auth.users WHERE email = 'serveuse@snackbar.cm');

DELETE FROM auth.users 
WHERE email = 'serveuse@snackbar.cm';

-- 2. Création intelligente avec gestion du trigger
DO $$
DECLARE
  v_etablissement_id uuid;
  v_new_user_id uuid;
BEGIN
  -- Récupération d'un établissement valide (le premier trouvé)
  SELECT id INTO v_etablissement_id FROM public.etablissements LIMIT 1;
  
  IF v_etablissement_id IS NULL THEN
    RAISE EXCEPTION 'Impossible de recréer le compte : aucun établissement trouvé dans la base.';
  END IF;

  v_new_user_id := gen_random_uuid();

  -- 3. Insertion dans auth.users avec métadonnées temporaires
  -- Ces métadonnées (etablissement_id, role, etc.) permettent au trigger handle_new_user 
  -- de créer correctement le profil sans violer la contrainte "profiles_admin_etablissement_check".
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data, -- <--- C'est ici que ça se joue
    created_at,
    updated_at,
    confirmation_token,
    is_super_admin
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_new_user_id,
    'authenticated',
    'authenticated',
    'serveuse@snackbar.cm',
    crypt('password123', gen_salt('bf')),
    NOW(),
    NULL,
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object(
      'nom', 'Marie',
      'prenom', 'Kamga',
      'role', 'serveuse',
      'etablissement_id', v_etablissement_id
    ),
    NOW(),
    NOW(),
    '',
    FALSE
  );

  -- À ce stade, le trigger handle_new_user a dû s'exécuter et créer le profil.
  -- On vérifie si le profil existe, sinon on le crée manuellement (ceinture et bretelles)
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_new_user_id) THEN
    INSERT INTO public.profiles (id, nom, prenom, role, etablissement_id, actif)
    VALUES (v_new_user_id, 'Marie', 'Kamga', 'serveuse', v_etablissement_id, TRUE);
  END IF;

  -- 4. Nettoyage des métadonnées pour alignement strict
  -- On vide raw_user_meta_data pour correspondre exactement à la configuration des comptes Patron/Comptoir qui fonctionnent.
  UPDATE auth.users 
  SET raw_user_meta_data = '{}'::jsonb
  WHERE id = v_new_user_id;

END $$;

COMMIT;

SELECT 'Compte serveuse recréé avec succès (Trigger satisfait puis nettoyé)' as resultat;
