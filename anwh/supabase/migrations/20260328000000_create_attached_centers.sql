/*
  # Create attached_centers table for satellite center management
  
  1. New Table Structure
    - `attached_centers` (manage satellite/attached centers per institution)
      - `id` (uuid, primary key)
      - `institution_code` (text, parent institution)
      - `marker` (text, '*', '**', '***' etc.)
      - `center_name` (text, full name of attached center)
      - `created_at` (timestamp)
  
  2. Purpose
    - Allow staff to be posted to satellite centers while managed under main institution
    - Markers (*) appear in roster next to staff names
    - Center name appears in remarks field for billing/PDF export
  
  3. Examples
    - Institution: JEETOO, Marker: "*", Center: "ENT Hospital"
    - Institution: JEETOO, Marker: "**", Center: "Souillac Hospital"
    - Institution: JNH, Marker: "*", Center: "Cardiology Wing"
  
  4. Security
    - Enable RLS
    - Allow read for all authenticated users
    - Allow write only for admins
*/

-- Step 1: Create attached_centers table
CREATE TABLE IF NOT EXISTS attached_centers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_code text NOT NULL,
  marker text NOT NULL,
  center_name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT unique_institution_marker UNIQUE (institution_code, marker)
);

-- Step 2: Enable Row Level Security
ALTER TABLE attached_centers ENABLE ROW LEVEL SECURITY;

-- Step 3: Create policies
-- Allow all authenticated users to read attached centers
CREATE POLICY "Allow all users to read attached_centers"
  ON attached_centers
  FOR SELECT
  USING (true);

-- Allow admins to manage attached centers (INSERT, UPDATE, DELETE)
CREATE POLICY "Admins can manage attached_centers"
  ON attached_centers
  FOR ALL
  USING (true);

-- Step 4: Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_attached_centers_institution ON attached_centers(institution_code);
CREATE INDEX IF NOT EXISTS idx_attached_centers_marker ON attached_centers(marker);

-- Step 5: Insert sample data (optional - remove if not needed)
-- INSERT INTO attached_centers (institution_code, marker, center_name) VALUES
--   ('JEETOO', '*', 'ENT Hospital'),
--   ('JEETOO', '**', 'Souillac Hospital'),
--   ('JNH', '*', 'Cardiology Wing');

-- Step 6: Log creation
DO $$
BEGIN
  RAISE NOTICE 'attached_centers table created successfully!';
END $$;
