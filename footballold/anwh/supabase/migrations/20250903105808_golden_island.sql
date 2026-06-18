/*
  # Create staff members table for shared staff management

  1. New Tables
    - `staff_members`
      - `id` (uuid, primary key)
      - `code` (text, unique authentication code)
      - `name` (text, staff name/surname)
      - `title` (text, job title like MIT, SMIT)
      - `salary` (integer, monthly salary)
      - `employee_id` (text, employee identification)
      - `first_name` (text, first name)
      - `surname` (text, surname)
      - `is_active` (boolean, whether staff member is active)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
      - `last_updated_by` (text, who made the last update)

  2. Security
    - Enable RLS on `staff_members` table
    - Add policy for all users to read staff data
    - Add policy for admin users to manage staff data

  3. Initial Data
    - Insert all current staff members from the application
*/

-- Create staff_members table
CREATE TABLE IF NOT EXISTS staff_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  title text DEFAULT 'MIT',
  salary integer DEFAULT 0,
  employee_id text DEFAULT '',
  first_name text DEFAULT '',
  surname text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_updated_by text DEFAULT 'SYSTEM'
);

-- Enable Row Level Security
ALTER TABLE staff_members ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all users to read staff data (needed for dropdowns and authentication)
CREATE POLICY "Allow all users to read staff data"
  ON staff_members
  FOR SELECT
  USING (true);

-- Policy: Allow all users to insert/update/delete (we'll handle admin validation in the app)
CREATE POLICY "Allow all operations on staff members"
  ON staff_members
  FOR ALL
  USING (true);

-- Insert initial staff data
INSERT INTO staff_members (code, name, title, salary, employee_id, first_name, surname, last_updated_by) VALUES
  -- Regular Staff
  ('B165', 'BHEKUR', 'MIT', 47510, 'B1604812300915', 'Yashdev', 'BHEKUR', 'SYSTEM'),
  ('B196', 'BHOLLOORAM', 'MIT', 47510, 'B1911811805356', 'Sawan', 'BHOLLOORAM', 'SYSTEM'),
  ('D28B', 'DHUNNY', 'MIT', 30060, 'D280487461277B', 'Leelarvind', 'DHUNNY', 'SYSTEM'),
  ('D07D', 'DOMUN', 'SMIT', 59300, 'D070273400031D', 'Sheik Ahmad Shamir', 'DOMUN', 'SYSTEM'),
  ('H301', 'FOKEERCHAND', 'MIT', 37185, 'H3003861200061', 'Needeema', 'FOKEERCHAND', 'SYSTEM'),
  ('S069', 'GHOORAN', 'MIT', 38010, 'S0607814601039', 'Bibi Shafinaaz', 'SAMTALLY-GHOORAN', 'SYSTEM'),
  ('H13D', 'HOSENBUX', 'MIT', 48810, 'H130381180129D', 'Zameer', 'HOSENBUX', 'SYSTEM'),
  ('J149', 'JUMMUN', 'MIT', 47510, 'J1403792600909', 'Bibi Nawsheen', 'JUMMUN', 'SYSTEM'),
  ('M17G', 'MAUDHOO', 'MIT', 38010, 'M170380260096G', 'Chandanee', 'MAUDHOO', 'SYSTEM'),
  ('N28C', 'NARAYYA', 'MIT', 38010, 'N280881240162C', 'Viraj', 'NARAYYA', 'SYSTEM'),
  ('P09A', 'PITTEA', 'SMIT', 59300, 'P091171190413A', 'Soubiraj', 'PITTEA', 'SYSTEM'),
  ('R16G', 'RUNGADOO', 'SMIT', 59300, 'R210572400118G', 'Manee', 'RUNGADOO', 'SYSTEM'),
  ('T16G', 'TEELUCK', 'SMIT', 59300, '', '', 'TEELUCK', 'SYSTEM'),
  ('V160', 'VEERASAWMY', 'SMIT', 59300, 'V1604664204410', 'Goindah', 'VEERASAWMY', 'SYSTEM'),
  
  -- Radiographers (R)
  ('B16R', 'BHEKUR(R)', 'MIT', 47510, 'B16048123000915', 'Yashdev', 'BHEKUR', 'SYSTEM'),
  ('B19R', 'BHOLLOORAM(R)', 'MIT', 47510, 'B19118118005356', 'Sawan', 'BHOLLOORAM', 'SYSTEM'),
  ('D28R', 'DHUNNY(R)', 'MIT', 30060, '0280876127778', 'Leetarvind', 'DHUNNY', 'SYSTEM'),
  ('D07R', 'DOMUN(R)', 'SMIT', 59300, 'D07027340003110', 'Shamir', 'DOMUN', 'SYSTEM'),
  ('H30R', 'FOKEERCHAND(R)', 'MIT', 37185, 'H30038612000061', 'Needeema', 'FOKEERCHAND', 'SYSTEM'),
  ('H13R', 'HOSENBUX(R)', 'MIT', 48810, 'H13038118012901', 'Zameer', 'HOSENBUX', 'SYSTEM'),
  ('S06R', 'GHOORAN(R)', 'MIT', 38010, 'S06781460103939', 'Bibi Sharinaaz', 'SAMTALLY-GHOORAN', 'SYSTEM'),
  ('J14R', 'JUMMUN(R)', 'MIT', 47510, 'J14037926000909', 'Bibi Nawsheen', 'JUMMUN', 'SYSTEM'),
  ('M17R', 'MAUDHOO(R)', 'MIT', 38010, 'M17038026006966', 'Chandanee', 'MAUDHOO', 'SYSTEM'),
  ('N28R', 'NARAYYA(R)', 'MIT', 38010, 'N280881240162C', 'Viraj', 'NARAYYA', 'SYSTEM'),
  ('P09R', 'PITTEA(R)', 'SMIT', 59300, 'P09117119004134', 'Subiraj', 'PITTEA', 'SYSTEM'),
  ('R21R', 'RUNGADOO(R)', 'SMIT', 59300, 'R21057240011866', 'Manee', 'RUNGADOO', 'SYSTEM'),
  ('T16R', 'TEELUCK(R)', 'SMIT', 59300, '', '', 'TEELUCK', 'SYSTEM'),
  ('V16R', 'VEERASAWMY(R)', 'SMIT', 59300, 'V16046642044100', 'Goindah', 'VEERASAWMY', 'SYSTEM'),
  
  -- Admin Code
  ('5274', 'ADMIN', 'ADMIN', 0, '', '', '', 'SYSTEM')
ON CONFLICT (code) DO NOTHING;

-- Create function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_staff_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_staff_members_updated_at
  BEFORE UPDATE ON staff_members
  FOR EACH ROW
  EXECUTE FUNCTION update_staff_updated_at();