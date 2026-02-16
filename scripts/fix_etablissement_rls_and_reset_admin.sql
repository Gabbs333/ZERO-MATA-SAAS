-- FIX COMPLET : ETABLISSEMENT RLS & RESET ADMIN
-- 1. Restaure les droits de lecture sur les établissements (Fix Patron/Comptoir)
-- 2. Recrée proprement l'utilisateur Admin (Fix Admin Login)

BEGIN;

-- ==============================================================================
-- 1. CORRECTION RLS ETABLISSEMENTS (Source du bug "Abonnement expiré")
-- ==============================================================================
-- Le problème est que les utilisateurs ne peuvent pas LIRE leur propre établissement
-- pour vérifier s'il est actif. S'ils ne peuvent pas le lire, le code reçoit NULL
-- et déclenche l'erreur "Abonnement expiré".

ALTER TABLE public.etablissements ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes politiques potentiellement conflictuelles
DROP POLICY IF EXISTS "admin_read_all_etablissements" ON etablissements;
DROP POLICY IF EXISTS "users_read_own_etablissement" ON etablissements;
DROP POLICY IF EXISTS "Admin view all etablissements" ON etablissements;
DROP POLICY IF EXISTS "Patron view own etablissement" ON etablissements;

-- Politique Admin : Voit tout
CREATE POLICY "admin_read_all_etablissements"
  ON etablissements FOR SELECT
  TO authenticated
  USING (get_user_role() = 'admin');

-- Politique Utilisateurs (Patron, Comptoir, Serveur) : Voient LEUR établissement
CREATE POLICY "users_read_own_etablissement"
  ON etablissements FOR SELECT
  TO authenticated
  USING (
    id = (SELECT etablissement_id FROM public.profiles WHERE id = auth.uid())
  );


-- ==============================================================================
-- 2. RESET COMPLET DE L'ADMIN (Source du bug "Database error querying schema")
-- ==============================================================================
-- L'erreur suggère une corruption des métadonnées ou un état incohérent pour l'Admin.
-- On le recrée proprement.

-- Supprimer l'ancien admin (s'il existe)
DELETE FROM public.profiles WHERE role = 'admin';
DELETE FROM auth.users WHERE email = 'admin@snackbar.cm';

-- Créer le nouvel admin
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    'a0000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'admin@snackbar.cm',
    crypt('password123', gen_salt('bf')),
    NOW(),
    '{"provider": "email", "providers": ["email"]}',
    '{"nom": "Admin", "prenom": "Systeme"}',
    NOW(),
    NOW()
);

-- Créer le profil admin associé
INSERT INTO public.profiles (
    id,
    role,
    nom,
    prenom,
    actif,
    created_at,
    updated_at
) VALUES (
    'a0000000-0000-0000-0000-000000000000',
    'admin',
    'Admin',
    'Systeme',
    true,
    NOW(),
    NOW()
);

COMMIT;

DO $$
BEGIN
  RAISE NOTICE 'Fix appliqué : RLS Etablissements restaurée & Admin recréé.';
END $$;
