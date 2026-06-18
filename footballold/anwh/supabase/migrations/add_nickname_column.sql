-- Add nickname column to staff_users table
-- This column stores optional nicknames for roster display purposes
-- Only editable by: the staff member themselves, their institution admin, or master admin (5274)

ALTER TABLE staff_users 
ADD COLUMN IF NOT EXISTS nickname TEXT NULL;

-- Add a comment to document the purpose
COMMENT ON COLUMN staff_users.nickname IS 'Optional nickname for roster display only. PDF exports and official documents use full name.';

-- Create an index for faster lookups (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_staff_users_nickname ON staff_users(nickname);
