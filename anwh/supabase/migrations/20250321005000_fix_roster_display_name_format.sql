-- Migration: Fix roster_display_name format with name in parentheses for duplicates
-- Created: 2025-03-21
-- Purpose: Update trigger to use format: SURNAME_(Name)_IDNUMBER when duplicates exist IN SAME INSTITUTION

-- First, update ALL existing staff with correct format
WITH surname_counts AS (
    SELECT 
        UPPER(surname) as upper_surname,
        institution_code,
        COUNT(*) as count
    FROM staff_users
    GROUP BY UPPER(surname), institution_code
)
UPDATE staff_users su
SET roster_display_name = CASE 
    -- If duplicate surname exists IN SAME INSTITUTION, use format: SURNAME_(Name)_IDNUMBER
    WHEN sc.count > 1 THEN CONCAT(UPPER(su.surname), '_(', su.name, ')_', su.id_number)
    -- If unique surname in that institution, use format: SURNAME_IDNUMBER
    ELSE CONCAT(UPPER(su.surname), '_', su.id_number)
END
FROM surname_counts sc
WHERE UPPER(su.surname) = sc.upper_surname
AND (su.institution_code = sc.institution_code OR (su.institution_code IS NULL AND sc.institution_code IS NULL))
AND (su.roster_display_name IS NULL OR su.roster_display_name NOT LIKE '%\_(%\_%');

-- Verify the update
SELECT 
    id,
    surname,
    name,
    id_number,
    roster_display_name,
    CASE 
        WHEN roster_display_name IS NULL THEN '❌ Still NULL'
        WHEN roster_display_name LIKE '%\_(%\_%' THEN '✅ Has name (duplicate)'
        ELSE '✅ Simple format (unique)'
    END as status
FROM staff_users
ORDER BY surname, name;

-- Now create/update the trigger function for future inserts/updates
CREATE OR REPLACE FUNCTION update_roster_display_name()
RETURNS TRIGGER AS $$
DECLARE
    surname_count INTEGER;
BEGIN
    -- Count how many staff have the same surname IN THE SAME INSTITUTION (case-insensitive)
    SELECT COUNT(*) INTO surname_count
    FROM staff_users
    WHERE UPPER(surname) = UPPER(NEW.surname)
    AND (institution_code = NEW.institution_code OR (institution_code IS NULL AND NEW.institution_code IS NULL))
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'); -- Exclude self on updates
    
    -- Set roster_display_name based on whether there are duplicates in same institution
    IF surname_count > 0 THEN
        -- Duplicate exists in same institution: use format SURNAME_(Name)_IDNUMBER
        NEW.roster_display_name := CONCAT(UPPER(NEW.surname), '_(', NEW.name, ')_', NEW.id_number);
        RAISE NOTICE 'Duplicate found in %: % -> %', NEW.institution_code, NEW.surname, NEW.roster_display_name;
    ELSE
        -- Unique surname in this institution: use format SURNAME_IDNUMBER
        NEW.roster_display_name := CONCAT(UPPER(NEW.surname), '_', NEW.id_number);
        RAISE NOTICE 'Unique in %: % -> %', NEW.institution_code, NEW.surname, NEW.roster_display_name;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trg_update_roster_display_name ON staff_users;

-- Create trigger to run BEFORE insert or update
CREATE TRIGGER trg_update_roster_display_name
BEFORE INSERT OR UPDATE OF surname, name, id_number ON staff_users
FOR EACH ROW
EXECUTE FUNCTION update_roster_display_name();
