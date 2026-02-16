-- Migration: Improve Invoice Number Nomenclature
-- Description: Updates the generate_numero_facture function to include Date and Table Number.
-- Format: FAC-{DDMM}-{TABLE}-{SEQ} (e.g., FAC-1302-T05-001)

CREATE OR REPLACE FUNCTION generate_numero_facture()
RETURNS TRIGGER AS $$
DECLARE
  v_date_str TEXT;
  v_sequence INT;
  v_table_numero TEXT;
  v_table_id UUID;
  v_new_numero TEXT;
BEGIN
  -- Get formatted date (DDMM)
  v_date_str := to_char(NOW(), 'DDMM');
  
  -- Get table number via commande
  IF NEW.commande_id IS NOT NULL THEN
    SELECT table_id INTO v_table_id FROM commandes WHERE id = NEW.commande_id;
    
    IF v_table_id IS NOT NULL THEN
      SELECT numero INTO v_table_numero FROM tables WHERE id = v_table_id;
      
      IF v_table_numero IS NOT NULL THEN
         v_table_numero := 'T' || v_table_numero;
      ELSE
         v_table_numero := 'UNK';
      END IF;
    ELSE
      v_table_numero := 'EMP'; -- Emporter or no table
    END IF;
  ELSE
    v_table_numero := 'UNK';
  END IF;

  -- Get next sequence number for this day
  SELECT COUNT(*) + 1 INTO v_sequence
  FROM factures
  WHERE date_generation >= CURRENT_DATE 
  AND date_generation < CURRENT_DATE + 1;

  -- Format: FAC-DDMM-TABLE-SEQ (e.g., FAC-1302-T5-001)
  v_new_numero := 'FAC-' || v_date_str || '-' || v_table_numero || '-' || lpad(v_sequence::text, 3, '0');

  -- Assign to NEW record
  NEW.numero_facture := v_new_numero;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-attach trigger
DROP TRIGGER IF EXISTS trigger_generate_numero_facture ON factures;
CREATE TRIGGER trigger_generate_numero_facture
  BEFORE INSERT ON factures
  FOR EACH ROW
  EXECUTE FUNCTION generate_numero_facture();
