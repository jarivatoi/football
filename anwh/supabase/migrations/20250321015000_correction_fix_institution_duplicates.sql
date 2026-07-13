-- CORRECTION: Fix roster_display_name to respect institution boundaries
-- This fixes names that were incorrectly marked as duplicates across institutions

-- Reset ALL roster_display_name values based on institution-scoped duplicates
WITH surname_counts AS (
    SELECT 
        id,
        UPPER(surname) as upper_surname,
        institution_code,
        COUNT(*) OVER (PARTITION BY UPPER(surname), institution_code) as count_in_institution
    FROM staff_users
)
UPDATE staff_users su
SET roster_display_name = CASE 
    -- If duplicate surname exists IN SAME INSTITUTION, use format: SURNAME_(Name)_IDNUMBER
    WHEN sc.count_in_institution > 1 THEN CONCAT(UPPER(su.surname), '_(', su.name, ')_', su.id_number)
    -- If unique surname in that institution, use format: SURNAME_IDNUMBER
    ELSE CONCAT(UPPER(su.surname), '_', su.id_number)
END
FROM surname_counts sc
WHERE su.id = sc.id;

-- Verify the results grouped by institution
SELECT 
    institution_code,
    surname,
    name,
    id_number,
    roster_display_name,
    CASE 
        WHEN roster_display_name LIKE '%\_(%\_%' THEN '⚠️ Has name suffix (duplicate in this institution)'
        ELSE '✅ Simple format (unique in this institution)'
    END as status
FROM staff_users
ORDER BY institution_code, surname, name;
