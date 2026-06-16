-- Add columns for anonymous user management
ALTER TABLE staff_users 
ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_pending_registration BOOLEAN DEFAULT FALSE;

-- Add comment to explain the columns
COMMENT ON COLUMN staff_users.is_anonymous IS 'True if this is an anonymous placeholder created during PDF import';
COMMENT ON COLUMN staff_users.is_pending_registration IS 'True if user has registered but not yet approved';

-- Create index for faster anonymous user lookups by surname
CREATE INDEX IF NOT EXISTS idx_staff_users_surname_anonymous 
ON staff_users(surname, is_anonymous);
