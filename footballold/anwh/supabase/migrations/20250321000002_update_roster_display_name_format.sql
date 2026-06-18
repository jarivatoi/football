-- Update roster_display_name format to SURNAME_IDNUMBER
-- This ensures uniqueness across all institutions and simplifies filtering

BEGIN;

-- Step 1: Update all staff_users to use new format
UPDATE staff_users su
SET roster_display_name = CONCAT(
  UPPER(su.surname), 
  '_', 
  UPPER(su.id_number)
)
WHERE su.is_active = true
  AND su.roster_display_name IS DISTINCT FROM CONCAT(UPPER(su.surname), '_', UPPER(su.id_number));

-- Step 2: Handle duplicates within same institution by adding initials
-- This is done via a function that will be called from the application layer
-- For now, we'll add a simple numbered suffix for any remaining conflicts

DO $$
DECLARE
    dup_record RECORD;
    counter INTEGER;
    new_name TEXT;
BEGIN
    -- Find duplicates (same surname + institution)
    FOR dup_record IN 
        SELECT 
            su1.id,
            su1.surname,
            su1.name,
            su1.institution_code,
            COUNT(*) OVER (PARTITION BY su1.institution_code, UPPER(su1.surname)) as dup_count
        FROM staff_users su1
        WHERE su1.is_active = true
          AND EXISTS (
            SELECT 1 FROM staff_users su2 
            WHERE su2.institution_code = su1.institution_code 
              AND UPPER(su2.surname) = UPPER(su1.surname)
              AND su2.id != su1.id
              AND su2.is_active = true
          )
    LOOP
        -- Add initials or numbered suffix
        IF dup_record.dup_count > 1 THEN
            counter := (
                SELECT COUNT(*) 
                FROM staff_users su3 
                WHERE su3.institution_code = dup_record.institution_code
                  AND UPPER(su3.surname) = dup_record.surname
                  AND su3.created_at <= dup_record.created_at
                  AND su3.is_active = true
            );
            
            -- Use first initial of name
            new_name := CONCAT(
                UPPER(dup_record.surname),
                '_(',
                UPPER(LEFT(dup_record.name, 1)),
                ')_',
                UPPER(dup_record.id_number)
            );
            
            UPDATE staff_users
            SET roster_display_name = new_name
            WHERE id = dup_record.id;
            
            RAISE NOTICE 'Updated duplicate % % in % to %', 
                dup_record.surname, dup_record.name, dup_record.institution_code, new_name;
        END IF;
    END LOOP;
END $$;

COMMIT;

-- Verify the changes
SELECT 
    surname,
    name,
    institution_code,
    roster_display_name,
    is_active
FROM staff_users
WHERE is_active = true
ORDER BY institution_code, UPPER(surname), name;
