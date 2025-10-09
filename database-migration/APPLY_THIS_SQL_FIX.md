# Failed Login Attempts Table - Schema Fix

## Problem Identified

The application is getting 400 Bad Request errors when trying to INSERT into `failed_login_attempts` because of column name mismatches:

**Application expects:**
- `ip_address`
- `reason`
- `attempted_at`

**Database actually has:**
- `source_ip`
- `failure_reason`
- `timestamp`

## Solution

Apply the SQL below in your Supabase SQL Editor to fix the schema:

### Step-by-Step Instructions:

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/anifqpihbnuuciqxddqi
2. Click on "SQL Editor" in the left sidebar
3. Click "New query"
4. Copy and paste the ENTIRE SQL block below
5. Click "Run" or press Ctrl+Enter

---

## SQL Fix (Copy this entire block):

```sql
-- ============================================================================
-- FIX: failed_login_attempts Schema Mismatch
-- ============================================================================

-- Step 1: Add the missing columns that the app expects
ALTER TABLE public.failed_login_attempts
  ADD COLUMN IF NOT EXISTS ip_address TEXT;

ALTER TABLE public.failed_login_attempts
  ADD COLUMN IF NOT EXISTS reason TEXT;

ALTER TABLE public.failed_login_attempts
  ADD COLUMN IF NOT EXISTS attempted_at TIMESTAMPTZ;

-- Step 2: Add tenant_id if it doesn't exist (for CareXPS isolation)
ALTER TABLE public.failed_login_attempts
  ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'carexps';

-- Step 3: Create a trigger to sync the column values
CREATE OR REPLACE FUNCTION sync_failed_login_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- Sync from new columns to old columns
  IF NEW.ip_address IS NOT NULL AND NEW.source_ip IS NULL THEN
    NEW.source_ip = NEW.ip_address;
  END IF;

  IF NEW.reason IS NOT NULL AND NEW.failure_reason IS NULL THEN
    NEW.failure_reason = NEW.reason;
  END IF;

  IF NEW.attempted_at IS NOT NULL AND NEW.timestamp IS NULL THEN
    NEW.timestamp = NEW.attempted_at;
  END IF;

  -- Sync from old columns to new columns (for compatibility)
  IF NEW.source_ip IS NOT NULL AND NEW.ip_address IS NULL THEN
    NEW.ip_address = NEW.source_ip;
  END IF;

  IF NEW.failure_reason IS NOT NULL AND NEW.reason IS NULL THEN
    NEW.reason = NEW.failure_reason;
  END IF;

  IF NEW.timestamp IS NOT NULL AND NEW.attempted_at IS NULL THEN
    NEW.attempted_at = NEW.timestamp;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the trigger if it exists and create it fresh
DROP TRIGGER IF EXISTS sync_failed_login_columns_trigger ON public.failed_login_attempts;

CREATE TRIGGER sync_failed_login_columns_trigger
  BEFORE INSERT OR UPDATE ON public.failed_login_attempts
  FOR EACH ROW
  EXECUTE FUNCTION sync_failed_login_columns();

-- Step 4: Create indexes on new columns for performance
CREATE INDEX IF NOT EXISTS idx_failed_login_ip_address ON public.failed_login_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_failed_login_attempted_at ON public.failed_login_attempts(attempted_at);
CREATE INDEX IF NOT EXISTS idx_failed_login_tenant_id ON public.failed_login_attempts(tenant_id);

-- Step 5: Update RLS policy to ensure tenant isolation
DROP POLICY IF EXISTS "Tenant isolation for failed logins" ON public.failed_login_attempts;

CREATE POLICY "Tenant isolation for failed logins" ON public.failed_login_attempts
  FOR ALL USING (tenant_id = 'carexps');

-- Step 6: Backfill existing data to have values in both column sets
UPDATE public.failed_login_attempts
SET
  ip_address = source_ip,
  reason = failure_reason,
  attempted_at = timestamp,
  tenant_id = COALESCE(tenant_id, 'carexps')
WHERE ip_address IS NULL OR reason IS NULL OR attempted_at IS NULL OR tenant_id IS NULL;

-- Step 7: Test the fix
INSERT INTO public.failed_login_attempts (
  email, ip_address, user_agent, reason, attempted_at, tenant_id
) VALUES (
  'test@carexps.com', '127.0.0.1', 'Test Browser', 'Test failure', NOW(), 'carexps'
);

-- Verify both column sets have data
SELECT
  email,
  ip_address,
  source_ip,
  reason,
  failure_reason,
  attempted_at,
  timestamp,
  tenant_id
FROM public.failed_login_attempts
WHERE email = 'test@carexps.com'
LIMIT 1;

-- Clean up test data
DELETE FROM public.failed_login_attempts WHERE email = 'test@carexps.com';
```

---

## After Running the SQL

You should see output similar to:

```
Success. No rows returned
Success. No rows returned
Success. No rows returned
Success. No rows returned
Success. Rows: 1
...
```

The SELECT query in the middle will show you that BOTH column sets are populated (ip_address AND source_ip will have the same value).

## What This Fix Does

1. **Adds missing columns**: `ip_address`, `reason`, `attempted_at` (what your app code expects)
2. **Keeps existing columns**: `source_ip`, `failure_reason`, `timestamp` (for backward compatibility)
3. **Creates a sync trigger**: Automatically copies values between old and new column names on INSERT/UPDATE
4. **Adds tenant_id**: Ensures CareXPS database isolation with `tenant_id = 'carexps'`
5. **Updates RLS policies**: Enforces tenant isolation at the database level
6. **Backfills data**: Copies existing data to new columns

## Expected Result

After applying this fix, your application will be able to successfully INSERT failed login attempts without getting 400 Bad Request errors.

The application will use:
- `ip_address` → automatically synced to `source_ip`
- `reason` → automatically synced to `failure_reason`
- `attempted_at` → automatically synced to `timestamp`

## Verification

To verify the fix worked, try logging into your application with wrong credentials. The failed login should be recorded without errors.

You can check the failed_login_attempts table in Supabase to see the records:

```sql
SELECT * FROM public.failed_login_attempts
ORDER BY attempted_at DESC
LIMIT 10;
```

Both the new columns (ip_address, reason, attempted_at) and old columns (source_ip, failure_reason, timestamp) will have the same values.
