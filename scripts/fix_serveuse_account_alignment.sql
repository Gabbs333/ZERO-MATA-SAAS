-- ALIGNER LE COMPTE SERVEUSE SUR LES COMPTES FONCTIONNELS
-- Basé sur vos observations : on reproduit la configuration exacte des comptes patron/comptoir
-- qui fonctionnent (confirmation_token vide, is_super_admin false, metadata vides).

BEGIN;

-- 1. Mise à jour directe de la table auth.users pour le compte serveuse
-- On force les valeurs qui semblent permettre le login sur les autres comptes
UPDATE auth.users
SET 
  confirmation_token = '',              -- Était NULL ou rempli, on le force à vide comme patron
  is_super_admin = FALSE,               -- Était NULL, on le force à FALSE comme patron
  raw_user_meta_data = '{}'::jsonb,     -- On vide les métadonnées qui pourraient faire planter un trigger
  email_confirmed_at = COALESCE(email_confirmed_at, NOW()), -- On confirme l'email si ce n'est pas fait
  updated_at = NOW(),
  last_sign_in_at = NULL                -- On laisse NULL pour forcer une "première" connexion propre
WHERE email = 'serveuse@snackbar.cm';

-- 2. On s'assure que les données "utiles" sont bien dans public.profiles
-- Puisqu'on a vidé les métadonnées de auth.users, il faut garantir que profiles est complet
DO $$
DECLARE
    v_etab_id UUID;
    v_user_id UUID;
BEGIN
    -- Récupérer le premier établissement disponible
    SELECT id INTO v_etab_id FROM public.etablissements LIMIT 1;
    
    -- Récupérer l'ID de l'utilisateur serveuse
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'serveuse@snackbar.cm';
    
    IF v_etab_id IS NOT NULL AND v_user_id IS NOT NULL THEN
        -- Insérer ou mettre à jour le profil
        INSERT INTO public.profiles (id, nom, prenom, role, etablissement_id, actif)
        VALUES (v_user_id, 'Marie', 'Kamga', 'serveuse', v_etab_id, true)
        ON CONFLICT (id) DO UPDATE
        SET 
            etablissement_id = v_etab_id,
            role = 'serveuse',
            actif = true;
            
        RAISE NOTICE 'Profil serveuse synchronisé avec établissement %', v_etab_id;
    END IF;
END $$;

COMMIT;

DO $$
BEGIN
  RAISE NOTICE 'Compte serveuse aligné sur la configuration Patron/Comptoir.';
END $$;
