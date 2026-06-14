-- Manual test: Update specific staff members to new format
-- Run this to test if the update works

BEGIN;

-- Update Subita NARAYYA from JEETOO
UPDATE staff_users 
SET roster_display_name = 'NARAYYA_12345678910111'
WHERE surname = 'NARAYYA' 
  AND name = 'Subita' 
  AND institution_code = 'JEETOO';

-- Update Viraj NARAYYA from JNH
UPDATE staff_users 
SET roster_display_name = 'NARAYYA_N280881240162C'
WHERE surname = 'NARAYYA' 
  AND name = 'Viraj' 
  AND institution_code = 'JNH';

-- Update Manoj HALKHORY from JEETOO
UPDATE staff_users 
SET roster_display_name = 'HALKHORY_' || id_number
WHERE surname = 'HALKHORY' 
  AND name = 'Manoj' 
  AND institution_code = 'JEETOO';

COMMIT;

-- Verify
SELECT surname, name, id_number, institution_code, roster_display_name
FROM staff_users
WHERE is_active = true
ORDER BY institution_code, surname;
