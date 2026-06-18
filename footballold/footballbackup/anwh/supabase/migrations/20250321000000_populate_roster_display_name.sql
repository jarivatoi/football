-- Migration: Populate roster_display_name for existing staff
-- Created: 2025-03-21
-- Purpose: Fill NULL roster_display_name values with format: SURNAME_IDNUMBER

-- Update all staff_users where roster_display_name is NULL
UPDATE staff_users 
SET roster_display_name = CONCAT(
    UPPER(surname), 
    '_', 
    id_number
)
WHERE roster_display_name IS NULL;

-- Verify the update
SELECT 
    id,
    surname,
    name,
    id_number,
    roster_display_name,
    CASE 
        WHEN roster_display_name IS NULL THEN '❌ Still NULL'
        WHEN roster_display_name LIKE '%null%' THEN '❌ Contains "null"'
        ELSE '✅ OK'
    END as status
FROM staff_users
ORDER BY created_at DESC;
