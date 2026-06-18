-- NUCLEAR OPTION: Disable ALL triggers, update, then drop them permanently

BEGIN;

-- Step 1: Disable ALL triggers on staff_users
ALTER TABLE staff_users DISABLE TRIGGER ALL;

-- Step 2: Force update ALL roster_display_name values
UPDATE staff_users 
SET roster_display_name = CONCAT(UPPER(surname), '_', UPPER(id_number))
WHERE is_active = true;

-- Step 3: Verify it worked THIS time
SELECT surname, name, id_number, institution_code, roster_display_name
FROM staff_users
WHERE is_active = true
ORDER BY institution_code, surname;

-- Step 4: Drop the problematic trigger function (we don't need auto-generation anymore)
DROP FUNCTION IF EXISTS trg_manage_roster_display_name() CASCADE;
DROP FUNCTION IF EXISTS generate_roster_display_name(TEXT, TEXT) CASCADE;

COMMIT;

-- Verify triggers are gone
SELECT 
    trigger_name
FROM information_schema.triggers
WHERE event_object_table = 'staff_users';
