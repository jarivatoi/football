-- Remove the unique constraint on roster_display_name
-- This allows staff from different institutions to have the same surname-based display name
-- Institution separation is handled by institution_code field

BEGIN;

-- Drop the unique constraint if it exists
DO $$
BEGIN
    -- Try to drop the constraint (constraint name might vary)
    ALTER TABLE staff_users DROP CONSTRAINT IF EXISTS staff_users_roster_display_name_key;
    
    -- Also try alternative naming conventions
    ALTER TABLE staff_users DROP CONSTRAINT IF EXISTS staff_users_roster_display_name_unique;
    
    RAISE NOTICE 'Unique constraint on roster_display_name removed successfully';
END $$;

COMMIT;

-- Verify the constraint was removed
SELECT 
    conname as constraint_name,
    contype as constraint_type
FROM pg_constraint 
WHERE conrelid = 'staff_users'::regclass 
  AND contype = 'u';
