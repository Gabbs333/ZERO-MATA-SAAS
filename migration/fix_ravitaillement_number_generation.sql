-- Fix the substring index for generating ravitaillement numbers
-- Previous version used FROM 13 which included the dash (e.g. '-001' -> -1), causing ID conflicts.
-- Prefix 'RAV-YYYYMMDD-' is 13 characters long, so the number starts at 14.

CREATE OR REPLACE FUNCTION generate_numero_ravitaillement()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
  date_part TEXT;
BEGIN
  date_part := TO_CHAR(NOW(), 'YYYYMMDD');
  
  -- Changed FROM 13 to FROM 14 to correctly parse the number part
  SELECT COALESCE(MAX(CAST(SUBSTRING(numero_ravitaillement FROM 14) AS INTEGER)), 0) + 1
  INTO next_num
  FROM ravitaillements
  WHERE numero_ravitaillement LIKE 'RAV-' || date_part || '-%';
  
  NEW.numero_ravitaillement := 'RAV-' || date_part || '-' || LPAD(next_num::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
