-- FINAL ATTEMPT: Remove ALL triggers and update roster_display_name

BEGIN;

-- Step 1: Drop the trigger function (CASCADE will remove dependent triggers)
DROP FUNCTION IF EXISTS trg_manage_roster_display_name() CASCADE;
DROP FUNCTION IF EXISTS generate_roster_display_name(TEXT, TEXT) CASCADE;

-- Step 2: Verify triggers are gone (should only show system RI_ConstraintTrigger)
SELECT tgname as remaining_triggers
FROM pg_trigger
WHERE tgrelid = (SELECT oid FROM pg_class WHERE relname = 'staff_users')
  AND tgname NOT LIKE 'RI_ConstraintTrigger%';

-- Step 3: Force update ALL staff to ID-based format
UPDATE staff_users 
SET roster_display_name = CONCAT(UPPER(surname), '_', UPPER(id_number))
WHERE is_active = true;

-- Step 4: Verify the update worked for everyone
SELECT 
    name,
    surname,
    id_number,
    institution_code,
    roster_display_name,
    CASE 
        WHEN roster_display_name LIKE '%_%' THEN '✅ Has ID'
        ELSE '❌ Missing ID'
    END as status
FROM staff_users
WHERE is_active = true
ORDER BY institution_code, surname;

COMMIT;
