-- =====================================================
-- FIX STAFF_USERS TABLE - ID COLUMN DEFAULT
-- Run this in Supabase SQL Editor
-- =====================================================

-- First, let's check the current table structure
SELECT column_name, column_default, is_nullable, data_type
FROM information_schema.columns
WHERE table_name = 'staff_users' AND column_name = 'id';

-- Drop the primary key constraint if it exists
ALTER TABLE staff_users DROP CONSTRAINT IF EXISTS staff_users_pkey;

-- Drop the id column and recreate it with proper default
ALTER TABLE staff_users DROP COLUMN IF EXISTS id;

-- Add id column back with UUID generation
ALTER TABLE staff_users ADD COLUMN id uuid DEFAULT gen_random_uuid();

-- Set NOT NULL constraint (after adding default)
ALTER TABLE staff_users ALTER COLUMN id SET NOT NULL;

-- Add primary key constraint
ALTER TABLE staff_users ADD CONSTRAINT staff_users_pkey PRIMARY KEY (id);

-- Create index on id for performance
CREATE INDEX IF NOT EXISTS idx_staff_users_id ON staff_users(id);

-- Verify the fix
SELECT column_name, column_default, is_nullable, data_type
FROM information_schema.columns
WHERE table_name = 'staff_users' AND column_name = 'id';

-- Test insert (should work now)
-- INSERT INTO staff_users (surname, name, id_number, passcode, institution_code, is_admin, is_active)
-- VALUES ('TEST', 'User', 'TEST1234567890', '1234', 'JNH', false, true);
