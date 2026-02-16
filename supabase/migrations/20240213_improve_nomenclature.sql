-- Migration: Improve Order Number Nomenclature
-- Description: Updates the generate_numero_commande function to include Date and Table Number for better readability.
-- Format: CMD-{DDMM}-{TABLE}-{SEQ} (e.g., CMD-1302-T05-001)

CREATE OR REPLACE FUNCTION generate_numero_commande()
RETURNS TRIGGER AS $$
DECLARE
  v_date_str TEXT;
  v_sequence INT;
  v_table_numero TEXT;
  v_new_numero TEXT;
BEGIN
  -- Get formatted date (DDMM)
  v_date_str := to_char(NOW(), 'DDMM');
  
  -- Get table number if exists, otherwise 'EMP' (Emporter) or 'UNK' (Unknown)
  IF NEW.table_id IS NOT NULL THEN
    SELECT numero INTO v_table_numero FROM tables WHERE id = NEW.table_id;
    -- If table number is found, format it (e.g., T05)
    IF v_table_numero IS NOT NULL THEN
       v_table_numero := 'T' || v_table_numero;
    ELSE
       v_table_numero := 'UNK';
    END IF;
  ELSE
    v_table_numero := 'EMP';
  END IF;

  -- Get next sequence number for this day
  -- We use a sequence or count. For simplicity and robustness, let's count orders today.
  -- Note: This is not strictly concurrency-safe but acceptable for this scale.
  -- Ideally we would use a sequence reset daily, but a simple count + 1 is easier to maintain here.
  SELECT COUNT(*) + 1 INTO v_sequence
  FROM commandes
  WHERE date_creation >= CURRENT_DATE 
  AND date_creation < CURRENT_DATE + 1;

  -- Format: CMD-DDMM-TABLE-SEQ (e.g., CMD-1302-T5-001)
  v_new_numero := 'CMD-' || v_date_str || '-' || v_table_numero || '-' || lpad(v_sequence::text, 3, '0');

  -- Assign to NEW record
  NEW.numero_commande := v_new_numero;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-attach trigger (just to be safe, though REPLACE FUNCTION is enough if trigger already points to it)
DROP TRIGGER IF EXISTS trigger_generate_numero_commande ON commandes;
CREATE TRIGGER trigger_generate_numero_commande
  BEFORE INSERT ON commandes
  FOR EACH ROW
  EXECUTE FUNCTION generate_numero_commande();
