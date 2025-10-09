-- ============================================================================
-- Add Missing Columns to Match Application Requirements
-- ============================================================================
-- Purpose: Add columns that the application expects but are missing from schema
-- ============================================================================

-- Fix user_settings table - add 'settings' JSONB column
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;

-- Fix user_profiles table - add 'encrypted_retell_api_key' column
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS encrypted_retell_api_key TEXT;

-- Fix system_credentials table - add 'api_key', 'call_agent_id', 'sms_agent_id', 'user_id' columns
ALTER TABLE public.system_credentials ADD COLUMN IF NOT EXISTS api_key TEXT;
ALTER TABLE public.system_credentials ADD COLUMN IF NOT EXISTS call_agent_id TEXT;
ALTER TABLE public.system_credentials ADD COLUMN IF NOT EXISTS sms_agent_id TEXT;
ALTER TABLE public.system_credentials ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE public.system_credentials ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add email_notifications column to user_settings
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS email_notifications JSONB DEFAULT '{
  "enabled": true,
  "recipients": [],
  "types": {
    "newCall": true,
    "newSMS": true,
    "systemAlerts": true
  }
}'::jsonb;

-- Add company_settings table for logos
CREATE TABLE IF NOT EXISTS public.company_settings (
  id TEXT PRIMARY KEY,
  data JSONB DEFAULT '{}'::jsonb,
  tenant_id TEXT DEFAULT 'carexps',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on company_settings
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- Allow all operations on company_settings
CREATE POLICY "Allow all company settings operations" ON public.company_settings
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- Missing Columns Added Successfully
-- ============================================================================
