-- Step 1: Drop the existing trigger
DROP TRIGGER IF EXISTS trg_manage_roster_display_name ON staff_users;

-- Step 2: Update ALL staff to use SURNAME_IDNUMBER format
UPDATE staff_users 
SET roster_display_name = CONCAT(UPPER(surname), '_', UPPER(id_number))
WHERE is_active = true;

-- Step 3: Verify the update worked
SELECT surname, name, id_number, institution_code, roster_display_name
FROM staff_users
WHERE is_active = true
ORDER BY institution_code, surname;

-- Step 4: Recreate the trigger with NEW logic that preserves ID-based format
CREATE OR REPLACE FUNCTION trg_manage_roster_display_name()
RETURNS TRIGGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Only process if roster_display_name is NULL or explicitly being reset
  -- Don't override if it already contains an underscore (ID-based format)
  IF NEW.roster_display_name IS NULL 
     OR NEW.roster_display_name = OLD.surname
     OR (OLD.roster_display_name NOT LIKE '%\_%' AND NEW.roster_display_name NOT LIKE '%\_%') THEN
    
    -- Check how many staff have this surname in same institution (excluding current row)
    SELECT COUNT(*) INTO v_count
    FROM staff_users
    WHERE UPPER(surname) = UPPER(NEW.surname)
      AND institution_code = NEW.institution_code
      AND is_active = true
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000');
    
    IF v_count = 0 THEN
      -- No duplicates in same institution - use SURNAME_IDNUMBER format
      NEW.roster_display_name := CONCAT(UPPER(NEW.surname), '_', UPPER(NEW.id_number));
    ELSE
      -- Has duplicates in same institution - use SURNAME_(INITIALS)_IDNUMBER format
      DECLARE
        v_initials TEXT;
        v_candidate TEXT;
        v_exists BOOLEAN;
      BEGIN
        -- Extract first letter of given name
        v_initials := UPPER(SUBSTRING(NEW.name FROM 1 FOR 1));
        v_candidate := CONCAT(UPPER(NEW.surname), '_(', v_initials, ')_', UPPER(NEW.id_number));
        
        -- Check if this format already exists
        SELECT EXISTS(
          SELECT 1 FROM staff_users
          WHERE roster_display_name = v_candidate
            AND institution_code = NEW.institution_code
            AND is_active = true
            AND id != NEW.id
        ) INTO v_exists;
        
        IF v_exists THEN
          -- Initials also taken - use full first name
          NEW.roster_display_name := CONCAT(UPPER(NEW.surname), '_(', SPLIT_PART(NEW.name, ' ', 1), ')_', UPPER(NEW.id_number));
        ELSE
          NEW.roster_display_name := v_candidate;
        END IF;
      END;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Recreate the trigger
CREATE TRIGGER trg_manage_roster_display_name
  BEFORE INSERT OR UPDATE ON staff_users
  FOR EACH ROW
  EXECUTE FUNCTION trg_manage_roster_display_name();
