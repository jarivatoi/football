-- Add roster_display_name column with smart duplicate handling
-- This creates a trigger that automatically adds suffixes when duplicates exist within the same institution

BEGIN;

-- Step 1: Add roster_display_name column if not exists
ALTER TABLE staff_users 
ADD COLUMN IF NOT EXISTS roster_display_name text;

-- Step 2: Create function to generate unique roster_display_name
CREATE OR REPLACE FUNCTION generate_roster_display_name()
RETURNS TRIGGER AS $$
DECLARE
    base_surname TEXT;
    candidate_name TEXT;
    duplicate_count INTEGER;
    other_duplicates RECORD;
BEGIN
    -- Base surname is always uppercase
    base_surname := UPPER(NEW.surname);
    
    -- Check if there are other ACTIVE staff with same surname in SAME institution
    -- Exclude current record (for updates)
    SELECT COUNT(*) INTO duplicate_count
    FROM staff_users
    WHERE UPPER(surname) = base_surname
      AND institution_code = NEW.institution_code
      AND is_active = true
      AND id != COALESCE(NEW.id, NULL);  -- Exclude self on updates
    
    IF duplicate_count = 0 THEN
        -- No duplicates - use plain surname
        NEW.roster_display_name := base_surname;
    ELSE
        -- Duplicates exist - need to add suffix
        -- First, check if we already have a suffixed name
        IF NEW.roster_display_name IS NOT NULL AND NEW.roster_display_name LIKE base_surname || '_%' THEN
            -- Keep existing suffixed name if it's unique
            candidate_name := NEW.roster_display_name;
            
            -- Check if this name is still valid (no conflicts)
            SELECT COUNT(*) INTO duplicate_count
            FROM staff_users
            WHERE roster_display_name = candidate_name
              AND institution_code = NEW.institution_code
              AND is_active = true
              AND id != NEW.id;
            
            IF duplicate_count = 0 THEN
                NEW.roster_display_name := candidate_name;
            ELSE
                -- Need to regenerate
                NEW.roster_display_name := NULL;
            END IF;
        END IF;
        
        -- Generate new suffixed name if needed
        IF NEW.roster_display_name IS NULL OR NEW.roster_display_name LIKE base_surname || '_%' THEN
            -- Get first initial of given name for suffix
            candidate_name := base_surname || '_' || UPPER(LEFT(NEW.name, 1));
            
            -- Check if this candidate is available
            SELECT COUNT(*) INTO duplicate_count
            FROM staff_users
            WHERE roster_display_name = candidate_name
              AND institution_code = NEW.institution_code
              AND is_active = true
              AND id != COALESCE(NEW.id, NULL);
            
            IF duplicate_count = 0 THEN
                NEW.roster_display_name := candidate_name;
            ELSE
                -- Fallback: use numbered suffix
                SELECT COUNT(*) + 1 INTO duplicate_count
                FROM staff_users
                WHERE roster_display_name LIKE base_surname || '_%'
                  AND institution_code = NEW.institution_code
                  AND is_active = true;
                
                NEW.roster_display_name := base_surname || '_' || LPAD(duplicate_count::text, 2, '0');
            END IF;
        END IF;
    END IF;
    
    -- Update ALL other staff with same surname to ensure they also have suffixes
    FOR other_duplicates IN 
        SELECT id, name, roster_display_name
        FROM staff_users
        WHERE UPPER(surname) = base_surname
          AND institution_code = NEW.institution_code
          AND is_active = true
          AND id != COALESCE(NEW.id, NULL)
          AND (roster_display_name IS NULL OR roster_display_name = base_surname)
    LOOP
        -- Generate suffix for them too
        candidate_name := base_surname || '_' || UPPER(LEFT(other_duplicates.name, 1));
        
        UPDATE staff_users
        SET roster_display_name = candidate_name
        WHERE id = other_duplicates.id;
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create trigger to auto-generate roster_display_name
DROP TRIGGER IF EXISTS set_roster_display_name ON staff_users;
CREATE TRIGGER set_roster_display_name
    BEFORE INSERT OR UPDATE ON staff_users
    FOR EACH ROW
    EXECUTE FUNCTION generate_roster_display_name();

-- Step 4: Backfill existing records
UPDATE staff_users su
SET roster_display_name = subq.new_name
FROM (
    SELECT 
        su2.id,
        CASE 
            WHEN dup_count > 1 THEN 
                UPPER(su2.surname) || '_' || UPPER(LEFT(su2.name, 1))
            ELSE 
                UPPER(su2.surname)
        END as new_name
    FROM staff_users su2
    JOIN (
        SELECT institution_code, UPPER(surname) as upper_surname, COUNT(*) as dup_count
        FROM staff_users
        WHERE is_active = true
        GROUP BY institution_code, UPPER(surname)
        HAVING COUNT(*) > 1
    ) dups ON UPPER(su2.surname) = dups.upper_surname 
           AND su2.institution_code = dups.institution_code
) subq
WHERE su.id = subq.id;

COMMIT;

-- Verify the results
SELECT 
    surname, 
    name, 
    institution_code, 
    roster_display_name,
    is_active
FROM staff_users
WHERE is_active = true
ORDER BY institution_code, UPPER(surname), name;
