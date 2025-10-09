-- ============================================================================
-- Fix RLS Policies for Password-Based Authentication
-- ============================================================================
-- Purpose: Allow password verification queries before user is authenticated
-- Issue: RLS policies block user queries needed for password authentication
-- ============================================================================

-- Drop existing restrictive policies on users table
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Super users can view all users" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Super users can manage all users" ON public.users;

-- Create new policies that allow password-based authentication

-- 1. Allow reading users for authentication (password verification)
CREATE POLICY "Allow authentication queries" ON public.users
  FOR SELECT
  USING (true);  -- Allow all SELECT queries for password verification

-- 2. Users can update their own profile (after authentication)
CREATE POLICY "Users can update their own profile" ON public.users
  FOR UPDATE
  USING (
    id::TEXT = current_setting('app.current_user_id', true)
    OR email = current_setting('app.current_user_email', true)
  );

-- 3. Allow INSERT for user creation (registration)
CREATE POLICY "Allow user creation" ON public.users
  FOR INSERT
  WITH CHECK (true);

-- Fix failed_login_attempts table to allow inserts
DROP POLICY IF EXISTS "Users can view their own failed logins" ON public.failed_login_attempts;
DROP POLICY IF EXISTS "Admins can view all failed logins" ON public.failed_login_attempts;
DROP POLICY IF EXISTS "System can insert failed login attempts" ON public.failed_login_attempts;

CREATE POLICY "Allow failed login recording" ON public.failed_login_attempts
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- RLS Policies Updated for Password-Based Authentication
-- ============================================================================
