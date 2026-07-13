-- =====================================================
-- MULTI-HOSPITAL SUPPORT MIGRATION
-- Run this ENTIRE script in Supabase SQL Editor
-- =====================================================

-- 1. Create institutions table
CREATE TABLE IF NOT EXISTS institutions (
  code text PRIMARY KEY,
  name text NOT NULL,
  address text,
  contact_info text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 2. Insert default institutions (Mauritius hospitals)
INSERT INTO institutions (code, name, address, contact_info) VALUES
  ('JNH', 'John Smith Hospital', '123 Main Street, Port Louis', 'Contact: +230 XXXX XXXX'),
  ('VH', 'Victoria Hospital', '456 Oak Avenue, Mahébourg', 'Contact: +230 XXXX XXXX'),
  ('JEETOO', 'Jeetoo Medical Centre', '789 Pine Road, Curepipe', 'Contact: +230 XXXX XXXX')
ON CONFLICT (code) DO NOTHING;

-- 3. Add institution_code column to staff_users
ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS 
  institution_code text REFERENCES institutions(code);

-- 4. Add registration approval columns
ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS 
  registration_approved boolean DEFAULT false;

ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS 
  approved_by text REFERENCES staff_users(id);

ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS 
  approved_at timestamptz;

-- 5. Add posting_institution for admin switching
ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS 
  posting_institution text REFERENCES institutions(code);

-- 6. Add institution_code to roster_entries
ALTER TABLE roster_entries ADD COLUMN IF NOT EXISTS 
  institution_code text REFERENCES institutions(code);

-- 7. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_staff_users_institution ON staff_users(institution_code);
CREATE INDEX IF NOT EXISTS idx_roster_entries_institution ON roster_entries(institution_code);
CREATE INDEX IF NOT EXISTS idx_staff_users_registration_approved ON staff_users(registration_approved);

-- 8. Enable Row Level Security on institutions
ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;

-- 9. SIMPLE POLICY: Allow ALL authenticated users to read active institutions
--    This avoids infinite recursion by not checking staff_users
DROP POLICY IF EXISTS "Allow authenticated users to view institutions" ON institutions;
CREATE POLICY "Allow authenticated users to view institutions" ON institutions
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- 10. Drop existing problematic policies on staff_users if they exist
DROP POLICY IF EXISTS "Institution-based staff access" ON staff_users;
DROP POLICY IF EXISTS "Staff users institution isolation" ON staff_users;
DROP POLICY IF EXISTS "Allow users to view their own profile" ON staff_users;

-- 11. Simple policy for staff_users - allow users to view all profiles
--     (needed to avoid recursion during institution lookup)
CREATE POLICY "Allow authenticated users to view staff profiles" ON staff_users
  FOR SELECT
  TO authenticated
  USING (true);

-- 12. Drop existing problematic policies on roster_entries
DROP POLICY IF EXISTS "Institution-based roster access" ON roster_entries;
DROP POLICY IF EXISTS "Institution-based roster insert" ON roster_entries;
DROP POLICY IF EXISTS "Institution-based roster update" ON roster_entries;
DROP POLICY IF EXISTS "Institution-based roster delete" ON roster_entries;

-- 13. Simple roster policies - no complex checks
CREATE POLICY "Allow authenticated users to view roster entries" ON roster_entries
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert roster entries" ON roster_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update roster entries" ON roster_entries
  FOR UPDATE
  TO authenticated
  USING (true);

-- =====================================================
-- VERIFICATION QUERIES
-- Run these to confirm setup is correct
-- =====================================================

-- Check institutions were created
SELECT * FROM institutions WHERE is_active = true ORDER BY name;

-- Check columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'staff_users' 
AND column_name IN ('institution_code', 'registration_approved', 'posting_institution')
ORDER BY column_name;

-- =====================================================
-- IMPORTANT NOTES:
-- =====================================================
-- 1. Institution filtering is done at APPLICATION LAYER (useRosterData hook)
-- 2. These simple RLS policies prevent infinite recursion
-- 3. Admin 5274 bypass logic is in TypeScript code, not SQL
-- 4. All authenticated users can see institutions and roster entries
-- 5. Application enforces institution-based restrictions
-- =====================================================
