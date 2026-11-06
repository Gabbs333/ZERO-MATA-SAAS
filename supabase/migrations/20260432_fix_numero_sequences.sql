-- Migration: Correction de la numérotation séquentielle (échanges, retours, ravitaillements)
-- Description:
--   Les triggers utilisaient SUBSTRING(x FROM 13) alors que le numéro commence
--   en position 14 (préfixe "XXX-YYYYMMDD-" = 13 caractères). Le MAX calculé
--   était donc négatif/0, la séquence repartait à 001 et provoquait :
--   duplicate key value violates unique constraint "echanges_numero_echange_key"
--   (idem pour retours et ravitaillements).
--
--   Correction : extraction du suffixe numérique via expression régulière
--   ancrée sur le préfixe du jour, verrou transactionnel pour éviter les
--   collisions concurrentes, et boucle anti-collision en dernier recours.
-- Created: 2026-04-32

-- ============================================================================
-- 1. ÉCHANGES — ECH-YYYYMMDD-NNN
-- ============================================================================

CREATE OR REPLACE FUNCTION public.generate_numero_echange()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date_part TEXT;
  v_prefix TEXT;
  v_next INTEGER;
  v_candidate TEXT;
BEGIN
  IF NEW.numero_echange IS NOT NULL AND NEW.numero_echange <> '' THEN
    RETURN NEW;
  END IF;

  v_date_part := TO_CHAR(NOW(), 'YYYYMMDD');
  v_prefix := 'ECH-' || v_date_part || '-';

  -- Évite deux numéros identiques si deux échanges sont validés simultanément
  PERFORM pg_advisory_xact_lock(hashtext('numero_echange'), hashtext(v_date_part));

  SELECT COALESCE(MAX(
           CASE
             WHEN numero_echange ~ ('^' || v_prefix || '[0-9]+$')
             THEN CAST(SUBSTRING(numero_echange FROM ('^' || v_prefix || '([0-9]+)$')) AS INTEGER)
           END
         ), 0) + 1
  INTO v_next
  FROM echanges;

  LOOP
    v_candidate := v_prefix || LPAD(v_next::TEXT, 3, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM echanges WHERE numero_echange = v_candidate);
    v_next := v_next + 1;
  END LOOP;

  NEW.numero_echange := v_candidate;
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 2. RETOURS — RET-YYYYMMDD-NNN
-- ============================================================================

CREATE OR REPLACE FUNCTION public.generate_numero_retour()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date_part TEXT;
  v_prefix TEXT;
  v_next INTEGER;
  v_candidate TEXT;
BEGIN
  IF NEW.numero_retour IS NOT NULL AND NEW.numero_retour <> '' THEN
    RETURN NEW;
  END IF;

  v_date_part := TO_CHAR(NOW(), 'YYYYMMDD');
  v_prefix := 'RET-' || v_date_part || '-';

  PERFORM pg_advisory_xact_lock(hashtext('numero_retour'), hashtext(v_date_part));

  SELECT COALESCE(MAX(
           CASE
             WHEN numero_retour ~ ('^' || v_prefix || '[0-9]+$')
             THEN CAST(SUBSTRING(numero_retour FROM ('^' || v_prefix || '([0-9]+)$')) AS INTEGER)
           END
         ), 0) + 1
  INTO v_next
  FROM retours;

  LOOP
    v_candidate := v_prefix || LPAD(v_next::TEXT, 3, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM retours WHERE numero_retour = v_candidate);
    v_next := v_next + 1;
  END LOOP;

  NEW.numero_retour := v_candidate;
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 3. RAVITAILLEMENTS — RAV-YYYYMMDD-NNN
-- ============================================================================

CREATE OR REPLACE FUNCTION public.generate_numero_ravitaillement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date_part TEXT;
  v_prefix TEXT;
  v_next INTEGER;
  v_candidate TEXT;
BEGIN
  IF NEW.numero_ravitaillement IS NOT NULL AND NEW.numero_ravitaillement <> '' THEN
    RETURN NEW;
  END IF;

  v_date_part := TO_CHAR(NOW(), 'YYYYMMDD');
  v_prefix := 'RAV-' || v_date_part || '-';

  PERFORM pg_advisory_xact_lock(hashtext('numero_ravitaillement'), hashtext(v_date_part));

  SELECT COALESCE(MAX(
           CASE
             WHEN numero_ravitaillement ~ ('^' || v_prefix || '[0-9]+$')
             THEN CAST(SUBSTRING(numero_ravitaillement FROM ('^' || v_prefix || '([0-9]+)$')) AS INTEGER)
           END
         ), 0) + 1
  INTO v_next
  FROM ravitaillements;

  LOOP
    v_candidate := v_prefix || LPAD(v_next::TEXT, 3, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM ravitaillements WHERE numero_ravitaillement = v_candidate);
    v_next := v_next + 1;
  END LOOP;

  NEW.numero_ravitaillement := v_candidate;
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 4. S'ASSURER QUE LES TRIGGERS SONT BIEN ATTACHÉS
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_generate_numero_echange ON echanges;
CREATE TRIGGER trigger_generate_numero_echange
  BEFORE INSERT ON echanges
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_numero_echange();

DROP TRIGGER IF EXISTS trigger_generate_numero_retour ON retours;
CREATE TRIGGER trigger_generate_numero_retour
  BEFORE INSERT ON retours
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_numero_retour();

DROP TRIGGER IF EXISTS trigger_generate_numero_ravitaillement ON ravitaillements;
CREATE TRIGGER trigger_generate_numero_ravitaillement
  BEFORE INSERT ON ravitaillements
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_numero_ravitaillement();

NOTIFY pgrst, 'reload schema';
