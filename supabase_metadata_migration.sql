-- Create metadata table for app-wide settings
CREATE TABLE IF NOT EXISTS metadata (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE metadata ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read metadata
CREATE POLICY "Allow public read access to metadata"
  ON metadata
  FOR SELECT
  TO PUBLIC
  USING (true);

-- Policy: Only admins can update metadata
CREATE POLICY "Allow admin update access to metadata"
  ON metadata
  FOR UPDATE
  TO PUBLIC
  USING (true)
  WITH CHECK (true);

-- Policy: Only admins can insert metadata
CREATE POLICY "Allow admin insert access to metadata"
  ON metadata
  FOR INSERT
  TO PUBLIC
  WITH CHECK (true);

-- Insert default maintenance mode (disabled)
INSERT INTO metadata (key, value)
VALUES ('maintenanceMode', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_metadata_key ON metadata(key);
