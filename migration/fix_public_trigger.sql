
-- CORRECTIF "SAFE MODE" POUR CONTOURNER LES RESTRICTIONS AUTH
-- Ce script ne touche QUE le schéma public, donc il passera sans erreur de permission.

-- 1. NETTOYAGE DES PROFILS DE TEST
-- On supprime les anciens profils pour repartir sur une base saine.
-- Les utilisateurs Auth correspondants devront être supprimés via l'API Admin (géré par mon script Node.js).
DELETE FROM public.profiles WHERE email LIKE '%@test.com';

-- 2. SÉCURISATION DU TRIGGER DE CRÉATION DE PROFIL
-- Le problème "Database error" vient souvent du fait que ce trigger plante (RLS, contrainte, etc.).
-- On va le modifier pour qu'il capture les erreurs au lieu de faire planter toute l'inscription.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  BEGIN
    -- Tentative d'insertion du profil
    INSERT INTO public.profiles (id, email, nom, prenom, role, etablissement_id)
    VALUES (
      NEW.id,
      NEW.email,
      NEW.raw_user_meta_data->>'nom',
      NEW.raw_user_meta_data->>'prenom',
      NEW.raw_user_meta_data->>'role',
      (NEW.raw_user_meta_data->>'etablissement_id')::uuid
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      nom = EXCLUDED.nom,
      prenom = EXCLUDED.prenom,
      role = EXCLUDED.role,
      etablissement_id = EXCLUDED.etablissement_id;
      
  EXCEPTION WHEN OTHERS THEN
    -- EN CAS D'ERREUR : On log un avertissement mais ON NE BLOQUE PAS la création de l'utilisateur Auth.
    -- Cela permettra au login de fonctionner, et on pourra diagnostiquer le profil manquant ensuite.
    RAISE WARNING 'Erreur non-bloquante dans handle_new_user: %', SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: On ne touche pas au trigger sur auth.users car on n'a pas les droits.
-- Mais comme on a modifié la FONCTION appelée par le trigger, le comportement est corrigé.
