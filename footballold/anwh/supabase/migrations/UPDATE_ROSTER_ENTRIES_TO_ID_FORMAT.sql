-- Update roster_entries to use new ID-based roster_display_name format

BEGIN;

-- Step 1: Show current state of roster_entries for March 2026
SELECT 
    date,
    assigned_name,
    shift_type,
    remarks
FROM roster_entries
WHERE date >= '2026-03-01' AND date < '2026-04-01'
ORDER BY date;

-- Step 2: Update roster_entries assigned_name to match new staff_users format
-- This joins with staff_users to get the correct new roster_display_name
UPDATE roster_entries re
SET assigned_name = su.roster_display_name
FROM staff_users su
WHERE 
    -- Match by stripping (R) suffix and comparing base names
    REPLACE(REPLACE(re.assigned_name, '(R)', ''), ' ', '') = 
    REPLACE(REPLACE(su.surname, '(R)', ''), ' ', '')
    AND su.is_active = true;

-- Step 3: Verify the update worked for March 2026
SELECT 
    re.date,
    re.assigned_name as new_assigned_name,
    re.shift_type,
    re.remarks,
    su.name as staff_name,
    su.institution_code
FROM roster_entries re
LEFT JOIN staff_users su ON re.assigned_name = su.roster_display_name
WHERE re.date >= '2026-03-01' AND re.date < '2026-04-01'
ORDER BY re.date;

COMMIT;
