-- COMPLETE TRIGGER REMOVAL SCRIPT
-- This will permanently remove ALL user-defined triggers from staff_users

BEGIN;

-- Step 1: Find and display all triggers on staff_users
SELECT 
    tgname as trigger_name,
    tgenabled as status,
    proname as function_name
FROM pg_trigger tg
JOIN pg_proc pr ON tg.tgfoid = pr.oid
WHERE tgrelid = (SELECT oid FROM pg_class WHERE relname = 'staff_users')
  AND tgname NOT LIKE 'RI_ConstraintTrigger%';

-- Step 2: Drop the main trigger (if exists)
DROP TRIGGER IF EXISTS trg_manage_roster_display_name ON staff_users;

-- Step 3: Drop any other custom triggers you might have
DROP TRIGGER IF EXISTS trg_update_roster_display_name ON staff_users;
DROP TRIGGER IF EXISTS trg_auto_generate_name ON staff_users;

-- Step 4: Drop the trigger functions (CASCADE removes dependencies)
DROP FUNCTION IF EXISTS trg_manage_roster_display_name() CASCADE;
DROP FUNCTION IF EXISTS generate_roster_display_name(TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS trg_update_roster_display_name() CASCADE;
DROP FUNCTION IF EXISTS trg_auto_generate_name() CASCADE;

-- Step 5: Verify ALL user triggers are gone
SELECT 
    tgname as remaining_triggers
FROM pg_trigger
WHERE tgrelid = (SELECT oid FROM pg_class WHERE relname = 'staff_users')
  AND tgname NOT LIKE 'RI_ConstraintTrigger%';

-- Should return 0 rows if successful

COMMIT;

-- Step 6: Now update roster_display_name to ID-based format
BEGIN;

UPDATE staff_users 
SET roster_display_name = CONCAT(UPPER(surname), '_', UPPER(id_number))
WHERE is_active = true;

-- Verify the update worked
SELECT 
    name,
    surname,
    id_number,
    institution_code,
    roster_display_name,
    CASE 
        WHEN roster_display_name LIKE '%_%' THEN '✅ Updated'
        ELSE '❌ Not updated'
    END as status
FROM staff_users
WHERE is_active = true
ORDER BY institution_code, surname;

COMMIT;
