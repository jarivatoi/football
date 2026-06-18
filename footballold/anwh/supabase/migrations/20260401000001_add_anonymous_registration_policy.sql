-- =====================================================
-- ALLOW ANONYMOUS USER REGISTRATION
-- Run this in Supabase SQL Editor
-- =====================================================

-- Drop existing policies that might block registration
DROP POLICY IF EXISTS "Enable insert for anonymous users" ON staff_users;
DROP POLICY IF EXISTS "Allow public registration" ON staff_users;

-- Create policy to allow ANYONE (including anonymous) to INSERT new users
-- This is needed for user registration before they have authentication
CREATE POLICY "Enable insert for anonymous users"
ON staff_users
FOR INSERT
TO public
WITH CHECK (true);

-- Also ensure authenticated users can still insert
DROP POLICY IF EXISTS "Admins can manage all staff_users" ON staff_users;
CREATE POLICY "Admins can manage all staff_users"
ON staff_users
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Verify policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'staff_users'
ORDER BY policyname;
