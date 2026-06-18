-- Simple migration: Update ALL staff to use SURNAME_IDNUMBER format
-- This will update every active staff member

BEGIN;

-- Update all active staff_users to use new format: SURNAME_IDNUMBER
UPDATE staff_users 
SET roster_display_name = CONCAT(UPPER(surname), '_', UPPER(id_number))
WHERE is_active = true;

COMMIT;

-- Verify the changes
SELECT 
    surname,
    name,
    id_number,
    institution_code,
    roster_display_name,
    is_active
FROM staff_users
WHERE is_active = true
ORDER BY institution_code, UPPER(surname), name;
