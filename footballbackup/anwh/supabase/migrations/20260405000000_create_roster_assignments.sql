-- Create roster_assignments table
CREATE TABLE IF NOT EXISTS roster_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_code TEXT NOT NULL,
  date DATE NOT NULL,
  shift_id TEXT NOT NULL,
  staff_name TEXT NOT NULL,
  markers TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_roster_institution_date 
  ON roster_assignments(institution_code, date);

-- Enable RLS
ALTER TABLE roster_assignments ENABLE ROW LEVEL SECURITY;

-- For now, allow all operations (you can tighten this later based on your auth setup)
-- Policy: Allow all authenticated users to manage roster
CREATE POLICY "Enable all access for authenticated users"
  ON roster_assignments
  FOR ALL
  USING (true)
  WITH CHECK (true);
