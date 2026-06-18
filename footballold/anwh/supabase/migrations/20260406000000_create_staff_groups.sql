-- Create staff_groups table
CREATE TABLE IF NOT EXISTS staff_groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  members TEXT[] NOT NULL,
  institution_code TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_staff_groups_institution 
  ON staff_groups(institution_code, name);

-- Enable RLS
ALTER TABLE staff_groups ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all authenticated users to manage groups
CREATE POLICY "Enable all access for authenticated users"
  ON staff_groups
  FOR ALL
  USING (true)
  WITH CHECK (true);
