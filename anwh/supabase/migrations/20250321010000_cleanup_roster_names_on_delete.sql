-- Function: Clean up roster_display_name after staff deletion
-- Purpose: When a staff member is deleted, check if remaining staff with same surname
--          IN THE SAME INSTITUTION can have their disambiguation suffix removed

CREATE OR REPLACE FUNCTION cleanup_roster_display_names_after_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if there are other staff with the same surname IN THE SAME INSTITUTION
    WITH surname_counts AS (
        SELECT 
            UPPER(surname) as upper_surname,
            institution_code,
            COUNT(*) as count
        FROM staff_users
        WHERE UPPER(surname) = UPPER(OLD.surname)
        AND (institution_code = OLD.institution_code OR (institution_code IS NULL AND OLD.institution_code IS NULL))
        GROUP BY UPPER(surname), institution_code
    )
    SELECT count INTO surname_counts.count
    FROM surname_counts;
    
    -- If only ONE staff remains with this surname IN THIS INSTITUTION, update to simple format (no name needed)
    IF surname_counts.count = 1 THEN
        UPDATE staff_users
        SET roster_display_name = CONCAT(UPPER(surname), '_', id_number)
        WHERE UPPER(surname) = UPPER(OLD.surname)
        AND (institution_code = OLD.institution_code OR (institution_code IS NULL AND OLD.institution_code IS NULL))
        AND id != OLD.id;
        
        RAISE NOTICE 'Cleaned up roster_display_name for remaining staff with surname % in institution %', OLD.surname, OLD.institution_code;
    END IF;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trg_cleanup_roster_names_after_delete ON staff_users;

-- Create trigger to run AFTER a staff member is deleted
CREATE TRIGGER trg_cleanup_roster_names_after_delete
AFTER DELETE ON staff_users
FOR EACH ROW
EXECUTE FUNCTION cleanup_roster_display_names_after_delete();
