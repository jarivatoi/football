-- Supabase Migration for Users Table (Totelepep Project)
-- Run this SQL in your Supabase SQL Editor

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  id_number VARCHAR(14) UNIQUE NOT NULL,
  surname VARCHAR(100) NOT NULL,
  name VARCHAR(100) NOT NULL,
  passcode VARCHAR(4) NOT NULL,
  is_admin BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow public read access for login"
  ON users
  FOR SELECT
  USING (true);

CREATE POLICY "Allow users to update their own data"
  ON users
  FOR UPDATE
  USING (true);

CREATE POLICY "Allow admin to manage all users"
  ON users
  FOR ALL
  USING (true);

-- Insert default admin user (ID: 5274)
INSERT INTO users (id_number, surname, name, passcode, is_admin, is_active)
VALUES ('5274', 'ADMIN', 'System', '5274', true, true)
ON CONFLICT (id_number) DO NOTHING;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_id_number ON users(id_number);
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login DESC);
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
