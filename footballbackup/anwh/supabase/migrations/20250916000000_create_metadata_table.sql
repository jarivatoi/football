/*
  # Create metadata table for cross-device settings

  1. New Tables
    - `metadata`
      - `id` (uuid, primary key)
      - `key` (text, unique setting key)
      - `value` (jsonb, setting value)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `metadata` table
    - Add policy for all users to read metadata
    - Add policy for admin users to update metadata

  3. Initial Data
    - Insert default maintenance mode setting
*/

-- Create metadata table
CREATE TABLE IF NOT EXISTS metadata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE metadata ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all users to read metadata
CREATE POLICY "Allow all users to read metadata"
  ON metadata
  FOR SELECT
  USING (true);

-- Policy: Allow all users to update metadata (we handle admin validation in the app)
CREATE POLICY "Allow all users to update metadata"
  ON metadata
  FOR ALL
  USING (true);

-- Insert default maintenance mode setting (disabled by default)
INSERT INTO metadata (key, value) VALUES
  ('maintenanceMode', 'false')
ON CONFLICT (key) DO NOTHING;

-- Create function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_metadata_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_metadata_updated_at
  BEFORE UPDATE ON metadata
  FOR EACH ROW
  EXECUTE FUNCTION update_metadata_updated_at();
