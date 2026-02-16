-- TEST DE DIAGNOSTIC PRÉCIS : UPDATE vs INSERT SESSION
-- Ce script va tenter manuellement les opérations que fait le Login.
-- Regardez les messages (NOTICE) dans l'onglet "Messages" ou le résultat pour voir ce qui échoue.

DO $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Récupération de l'ID serveuse
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'serveuse@snackbar.cm';
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Utilisateur serveuse@snackbar.cm introuvable !';
  END IF;

  RAISE NOTICE 'User ID trouvé: %', v_user_id;

  -- Test 1: UPDATE auth.users (Simulation mise à jour last_sign_in_at)
  BEGIN
    UPDATE auth.users 
    SET last_sign_in_at = NOW() 
    WHERE id = v_user_id;
    
    RAISE NOTICE '✅ Test 1: UPDATE auth.users -> SUCCÈS';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ Test 1: UPDATE auth.users -> ÉCHEC: %', SQLERRM;
  END;

  -- Test 2: INSERT auth.sessions (Simulation création session)
  BEGIN
    INSERT INTO auth.sessions (id, user_id, created_at, updated_at)
    VALUES (gen_random_uuid(), v_user_id, NOW(), NOW());
    
    RAISE NOTICE '✅ Test 2: INSERT auth.sessions -> SUCCÈS';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ Test 2: INSERT auth.sessions -> ÉCHEC: %', SQLERRM;
  END;

END $$;
