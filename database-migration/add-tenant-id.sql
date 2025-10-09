-- ============================================================================
-- Add tenant_id column to all tables for CareXPS isolation
-- ============================================================================
-- Purpose: Add tenant_id to enforce 100% database isolation per DATABASE_LOCKDOWN_POLICY
-- Target: https://anifqpihbnuuciqxddqi.supabase.co
-- Created: 2025-10-08
-- ============================================================================

-- Add tenant_id to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'carexps';

-- Add tenant_id to user_settings table
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'carexps';

-- Add tenant_id to user_profiles table
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'carexps';

-- Add tenant_id to user_mfa_configs table
ALTER TABLE public.user_mfa_configs ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'carexps';

-- Add tenant_id to mfa_challenges table
ALTER TABLE public.mfa_challenges ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'carexps';

-- Add tenant_id to audit_logs table
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'carexps';

-- Add tenant_id to failed_login_attempts table
ALTER TABLE public.failed_login_attempts ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'carexps';

-- Add tenant_id to notes table
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'carexps';

-- Add tenant_id to system_credentials table
ALTER TABLE public.system_credentials ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'carexps';

-- Create indexes for tenant_id
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON public.users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_tenant_id ON public.user_settings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_tenant_id ON public.user_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_mfa_configs_tenant_id ON public.user_mfa_configs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mfa_challenges_tenant_id ON public.mfa_challenges(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON public.audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_failed_login_tenant_id ON public.failed_login_attempts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notes_tenant_id ON public.notes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_system_credentials_tenant_id ON public.system_credentials(tenant_id);

-- Update existing records to have tenant_id = 'carexps'
UPDATE public.users SET tenant_id = 'carexps' WHERE tenant_id IS NULL;
UPDATE public.user_settings SET tenant_id = 'carexps' WHERE tenant_id IS NULL;
UPDATE public.user_profiles SET tenant_id = 'carexps' WHERE tenant_id IS NULL;
UPDATE public.user_mfa_configs SET tenant_id = 'carexps' WHERE tenant_id IS NULL;
UPDATE public.mfa_challenges SET tenant_id = 'carexps' WHERE tenant_id IS NULL;
UPDATE public.audit_logs SET tenant_id = 'carexps' WHERE tenant_id IS NULL;
UPDATE public.failed_login_attempts SET tenant_id = 'carexps' WHERE tenant_id IS NULL;
UPDATE public.notes SET tenant_id = 'carexps' WHERE tenant_id IS NULL;
UPDATE public.system_credentials SET tenant_id = 'carexps' WHERE tenant_id IS NULL;

-- Add NOT NULL constraint after setting default values
ALTER TABLE public.users ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.user_settings ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.user_profiles ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.user_mfa_configs ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.mfa_challenges ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.audit_logs ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.failed_login_attempts ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.notes ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.system_credentials ALTER COLUMN tenant_id SET NOT NULL;

-- ============================================================================
-- Migration Complete - tenant_id column added to all tables
-- All records set to 'carexps' for 100% database isolation
-- ============================================================================
