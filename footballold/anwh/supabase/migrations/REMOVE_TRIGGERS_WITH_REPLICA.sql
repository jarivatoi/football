-- COMPLETE TRIGGER REMOVAL WITH REPLICA IDENTITY FIX

BEGIN;

-- Step 1: Set replica identity to allow updates
ALTER TABLE staff_users REPLICA IDENTITY FULL;

-- Step 2: Drop all custom triggers
DROP TRIGGER IF EXISTS trg_manage_roster_display_name ON staff_users;
DROP TRIGGER IF EXISTS trg_update_roster_display_name ON staff_users;
DROP TRIGGER IF EXISTS trg_auto_generate_name ON staff_users;

-- Step 3: Drop trigger functions with CASCADE
DROP FUNCTION IF EXISTS trg_manage_roster_display_name() CASCADE;
DROP FUNCTION IF EXISTS generate_roster_display_name(TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS trg_update_roster_display_name() CASCADE;
DROP FUNCTION IF EXISTS trg_auto_generate_name() CASCADE;

-- Step 4: Verify triggers are gone
SELECT 
    tgname as remaining_triggers
FROM pg_trigger
WHERE tgrelid = (SELECT oid FROM pg_class WHERE relname = 'staff_users')
  AND tgname NOT LIKE 'RI_ConstraintTrigger%';

COMMIT;

-- Step 5: Update roster_display_name
BEGIN;

UPDATE staff_users 
SET roster_display_name = CONCAT(UPPER(surname), '_', UPPER(id_number))
WHERE is_active = true;

-- Verify
SELECT 
    name,
    surname,
    id_number,
    institution_code,
    roster_display_name
FROM staff_users
WHERE is_active = true
ORDER BY surname;

COMMIT;
