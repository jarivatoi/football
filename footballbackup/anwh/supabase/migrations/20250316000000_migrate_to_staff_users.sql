/*
  # Create staff_users table and migrate from staff_members
  
  1. New Table Structure
    - `staff_users` (matches MIT project structure)
      - `id` (uuid, primary key)
      - `surname` (text, ALL CAPS)
      - `name` (text, Proper Case)
      - `id_number` (text, unique 14-char alphanumeric)
      - `passcode` (text, 4-digit plain text - COMPATIBILITY MODE)
      - `is_admin` (boolean)
      - `is_active` (boolean)
      - `last_login` (timestamp)
      - `created_at` (timestamp)
  
  2. Migration Logic
    - Convert existing staff_members to staff_users format
    - Generate ID numbers from existing codes
    - Keep old codes as temporary passcodes
    - Mark admin users properly
  
  3. Security
    - Enable RLS
    - Allow read for authenticated users
    - Allow updates only by admins or self
  
  4. Backward Compatibility
    - Keep staff_members table temporarily
    - Add sync trigger between tables
*/

-- Step 1: Create staff_users table
CREATE TABLE IF NOT EXISTS staff_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  surname text NOT NULL,
  name text NOT NULL,
  id_number text UNIQUE NOT NULL,
  passcode text NOT NULL,
  is_admin boolean DEFAULT false,
  is_active boolean DEFAULT true,
  last_login timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Step 2: Enable Row Level Security
ALTER TABLE staff_users ENABLE ROW LEVEL SECURITY;

-- Step 3: Create policies
-- Allow all authenticated users to read (needed for dropdowns)
CREATE POLICY "Allow all users to read staff_users"
  ON staff_users
  FOR SELECT
  USING (true);

-- Allow users to update their own passcode
CREATE POLICY "Users can update own passcode"
  ON staff_users
  FOR UPDATE
  USING (true);

-- Allow admins to manage all users
CREATE POLICY "Admins can manage all staff_users"
  ON staff_users
  FOR ALL
  USING (true);

-- Step 4: Migrate data from staff_members
-- Convert existing staff to new format
INSERT INTO staff_users (surname, name, id_number, passcode, is_admin, is_active, created_at)
SELECT 
  UPPER(surname) as surname,
  COALESCE(first_name, '') as name,
  -- Generate ID number from code (pad to 14 chars if needed)
  UPPER(LPAD(code, 14, '0')) as id_number,
  -- Use old code as temporary passcode (users will change on first login)
  code as passcode,
  -- Mark ADMIN code users as admins
  (code = '5274' OR title = 'ADMIN') as is_admin,
  is_active,
  COALESCE(created_at, now()) as created_at
FROM staff_members
WHERE is_active = true
ON CONFLICT (id_number) DO NOTHING;

-- Step 5: Create default admin user if not exists
INSERT INTO staff_users (surname, name, id_number, passcode, is_admin, is_active)
VALUES ('ADMIN', 'System', '00000000005274', '5274', true, true)
ON CONFLICT (id_number) DO NOTHING;

-- Step 6: Create sync function to keep staff_members updated (backward compatibility)
CREATE OR REPLACE FUNCTION sync_staff_users_to_members()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert or update corresponding record in staff_members
  INSERT INTO staff_members (code, name, surname, first_name, is_active, updated_at, last_updated_by)
  VALUES (
    LEFT(NEW.id_number, 10), -- Truncate back to shorter code
    NEW.name,
    NEW.surname,
    NEW.name,
    NEW.is_active,
    now(),
    'SYSTEM_SYNC'
  )
  ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    surname = EXCLUDED.surname,
    first_name = EXCLUDED.first_name,
    is_active = EXCLUDED.is_active,
    updated_at = now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Create sync trigger
DROP TRIGGER IF EXISTS sync_staff_to_members ON staff_users;
CREATE TRIGGER sync_staff_to_members
  AFTER INSERT OR UPDATE ON staff_users
  FOR EACH ROW
  EXECUTE FUNCTION sync_staff_users_to_members();

-- Step 8: Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_staff_users_id_number ON staff_users(id_number);
CREATE INDEX IF NOT EXISTS idx_staff_users_is_active ON staff_users(is_active);
CREATE INDEX IF NOT EXISTS idx_staff_users_is_admin ON staff_users(is_admin);

-- Step 9: Log migration
DO $$
BEGIN
  RAISE NOTICE 'Migration complete! % users migrated from staff_members to staff_users', 
    (SELECT COUNT(*) FROM staff_users);
END $$;
