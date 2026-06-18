/*
  # Create user_sessions table for session management
  
  1. New Table Structure
    - `user_sessions` (tracks active user sessions)
      - `id` (uuid, primary key)
      - `user_id` (uuid, stores staff_users.id without FK constraint)
      - `device_info` (text, optional)
      - `ip_address` (text, optional)
      - `login_at` (timestamptz, default now)
      - `last_activity_at` (timestamptz, default now)
      - `is_active` (boolean, default true)
      - `created_at` (timestamptz, default now)
  
  2. Indexes
    - Fast lookup by user_id
    - Filter active sessions only
  
  3. Security
    - Enable RLS
    - Users can view own sessions
    - Admins can manage all sessions
    
  NOTE: No foreign key constraint to avoid issues with staff_users structure
*/

-- Step 1: Create user_sessions table (WITHOUT foreign key)
CREATE TABLE IF NOT EXISTS user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  device_info text,
  ip_address text,
  login_at timestamptz DEFAULT now(),
  last_activity_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Step 2: Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_sessions_login_at ON user_sessions(login_at);

-- Step 3: Enable Row Level Security
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Step 4: Create policies
-- Users can view their own active sessions (using user_id match)
CREATE POLICY "Users can view own sessions"
  ON user_sessions
  FOR SELECT
  USING (
    user_id = (
      SELECT id FROM staff_users 
      WHERE id_number = current_setting('app.current_user_id', true)
    )
  );

-- Admins can view and manage all sessions
CREATE POLICY "Admins can manage all sessions"
  ON user_sessions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM staff_users 
      WHERE staff_users.id = (
        SELECT id FROM staff_users 
        WHERE id_number = current_setting('app.current_user_id', true)
      )
      AND staff_users.is_admin = true
    )
  );

-- Step 5: Create function to auto-update last_activity_at
CREATE OR REPLACE FUNCTION update_session_activity()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_activity_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Create trigger for activity tracking
DROP TRIGGER IF EXISTS update_user_session_activity ON user_sessions;
CREATE TRIGGER update_user_session_activity
  BEFORE UPDATE ON user_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_session_activity();

-- Step 7: Log creation
DO $$
BEGIN
  RAISE NOTICE 'User sessions table created successfully!';
END $$;
