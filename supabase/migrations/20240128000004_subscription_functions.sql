-- Migration: Subscription Management Functions
-- Description: Functions for payment confirmation, suspension, and reactivation
-- Requirements: 3.4, 3.5, 3.6, 12.3, 12.4, 12.5

-- Function: Confirm payment and extend subscription by 12 months
CREATE OR REPLACE FUNCTION public.confirm_payment_and_extend_subscription(
  p_etablissement_id UUID,
  p_admin_user_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_current_date_fin TIMESTAMPTZ;
  v_new_date_fin TIMESTAMPTZ;
BEGIN
  -- Verify caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = p_admin_user_id 
    AND role = 'admin'
    AND actif = true
  ) THEN
    RAISE EXCEPTION 'Only active admin users can confirm payments';
  END IF;
  
  -- Verify establishment exists
  IF NOT EXISTS (
    SELECT 1 FROM public.etablissements
    WHERE id = p_etablissement_id
  ) THEN
    RAISE EXCEPTION 'Establishment not found';
  END IF;
  
  -- Get current end date
  SELECT date_fin INTO v_current_date_fin
  FROM public.etablissements
  WHERE id = p_etablissement_id;
  
  -- Calculate new end date: extend by 12 months from current end date
  v_new_date_fin := v_current_date_fin + INTERVAL '12 months';
  
  -- Update establishment: extend subscription, reactivate if needed
  UPDATE public.etablissements
  SET 
    date_fin = v_new_date_fin,
    statut_abonnement = 'actif',
    actif = true,
    dernier_paiement_date = NOW(),
    dernier_paiement_confirme_par = p_admin_user_id,
    date_modification = NOW()
  WHERE id = p_etablissement_id;
  
  -- Log the payment confirmation action
  INSERT INTO public.audit_logs (
    user_id, 
    action, 
    table_name, 
    record_id, 
    details,
    etablissement_id
  )
  VALUES (
    p_admin_user_id,
    'PAYMENT_CONFIRMED',
    'etablissements',
    p_etablissement_id,
    jsonb_build_object(
      'previous_date_fin', v_current_date_fin,
      'new_date_fin', v_new_date_fin,
      'payment_date', NOW()
    ),
    p_etablissement_id
  );
END;
$$;

COMMENT ON FUNCTION public.confirm_payment_and_extend_subscription IS 
'Admin function to confirm manual payment and extend establishment subscription by 12 months';

-- Function: Suspend establishment
CREATE OR REPLACE FUNCTION public.suspend_etablissement(
  p_etablissement_id UUID,
  p_admin_user_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Verify caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = p_admin_user_id 
    AND role = 'admin'
    AND actif = true
  ) THEN
    RAISE EXCEPTION 'Only active admin users can suspend establishments';
  END IF;
  
  -- Verify establishment exists
  IF NOT EXISTS (
    SELECT 1 FROM public.etablissements
    WHERE id = p_etablissement_id
  ) THEN
    RAISE EXCEPTION 'Establishment not found';
  END IF;
  
  -- Update establishment status to suspended
  UPDATE public.etablissements
  SET 
    statut_abonnement = 'suspendu',
    actif = false,
    date_modification = NOW()
  WHERE id = p_etablissement_id;
  
  -- Log the suspension action
  INSERT INTO public.audit_logs (
    user_id, 
    action, 
    table_name, 
    record_id, 
    details,
    etablissement_id
  )
  VALUES (
    p_admin_user_id,
    'ESTABLISHMENT_SUSPENDED',
    'etablissements',
    p_etablissement_id,
    jsonb_build_object(
      'reason', COALESCE(p_reason, 'No reason provided'),
      'suspended_at', NOW()
    ),
    p_etablissement_id
  );
END;
$$;

COMMENT ON FUNCTION public.suspend_etablissement IS 
'Admin function to suspend an establishment and prevent user access';

-- Function: Reactivate establishment
CREATE OR REPLACE FUNCTION public.reactivate_etablissement(
  p_etablissement_id UUID,
  p_admin_user_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_date_fin TIMESTAMPTZ;
BEGIN
  -- Verify caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = p_admin_user_id 
    AND role = 'admin'
    AND actif = true
  ) THEN
    RAISE EXCEPTION 'Only active admin users can reactivate establishments';
  END IF;
  
  -- Verify establishment exists and get date_fin
  SELECT date_fin INTO v_date_fin
  FROM public.etablissements
  WHERE id = p_etablissement_id;
  
  IF v_date_fin IS NULL THEN
    RAISE EXCEPTION 'Establishment not found';
  END IF;
  
  -- Check if subscription has expired
  IF v_date_fin < NOW() THEN
    RAISE EXCEPTION 'Cannot reactivate expired establishment. Please confirm payment first to extend subscription.';
  END IF;
  
  -- Update establishment status to active
  UPDATE public.etablissements
  SET 
    statut_abonnement = 'actif',
    actif = true,
    date_modification = NOW()
  WHERE id = p_etablissement_id;
  
  -- Log the reactivation action
  INSERT INTO public.audit_logs (
    user_id, 
    action, 
    table_name, 
    record_id, 
    details,
    etablissement_id
  )
  VALUES (
    p_admin_user_id,
    'ESTABLISHMENT_REACTIVATED',
    'etablissements',
    p_etablissement_id,
    jsonb_build_object(
      'reactivated_at', NOW(),
      'date_fin', v_date_fin
    ),
    p_etablissement_id
  );
END;
$$;

COMMENT ON FUNCTION public.reactivate_etablissement IS 
'Admin function to reactivate a suspended establishment (only if subscription has not expired)';
