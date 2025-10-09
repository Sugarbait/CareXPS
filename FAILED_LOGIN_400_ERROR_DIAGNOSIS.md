# Failed Login Attempts 400 Error - Root Cause Analysis

## Executive Summary
**Root Cause:** PostgREST schema cache is stale and doesn't recognize the new columns (`ip_address`, `reason`, `attempted_at`)

**Impact:** Application cannot insert failed login attempts using the new column names

**Solution:** Use the old column names that PostgREST recognizes OR force a schema cache reload

---

## Detailed Diagnosis

### 1. Actual Error Message
```
HTTP 400 Bad Request
{
  "code": "PGRST204",
  "message": "Could not find the 'attempted_at' column of 'failed_login_attempts' in the schema cache"
}
```

### 2. What PostgREST Currently Knows
The schema cache recognizes these columns:
- `id` (UUID, primary key)
- `user_id` (UUID, nullable)
- `email` (TEXT)
- `source_ip` (TEXT, nullable) ← OLD name for IP address
- `user_agent` (TEXT, nullable)
- `failure_reason` (TEXT, nullable) ← OLD name for reason
- `timestamp` (TIMESTAMPTZ, auto-generated) ← OLD name for attempted_at
- `tenant_id` (TEXT, default 'carexps')

### 3. What the Application is Trying to Use
The app code tries to INSERT with:
- `email` ✅ (recognized)
- `ip_address` ❌ (NOT in cache - should be `source_ip`)
- `user_agent` ✅ (recognized)
- `reason` ❌ (NOT in cache - should be `failure_reason`)
- `attempted_at` ❌ (NOT in cache - should be `timestamp`)

### 4. Test Results

**FAILED INSERT (400 Error):**
```bash
curl -X POST "https://anifqpihbnuuciqxddqi.supabase.co/rest/v1/failed_login_attempts" \
  -H "Authorization: Bearer [SERVICE_ROLE_KEY]" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "ip_address": "127.0.0.1",      # NOT RECOGNIZED
    "user_agent": "TestAgent",
    "reason": "Invalid password",    # NOT RECOGNIZED
    "attempted_at": "2025-10-09T01:56:00Z"  # NOT RECOGNIZED
  }'

# ERROR: "Could not find the 'attempted_at' column..."
```

**SUCCESSFUL INSERT (201 Created):**
```bash
curl -X POST "https://anifqpihbnuuciqxddqi.supabase.co/rest/v1/failed_login_attempts" \
  -H "Authorization: Bearer [SERVICE_ROLE_KEY]" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "user_agent": "TestAgent"
  }'

# SUCCESS: Returns created record with auto-generated timestamp
```

---

## Solutions

### ✅ **Solution 1: Use Old Column Names (IMMEDIATE FIX)**

**Update application code to use the column names PostgREST recognizes:**

```typescript
// In userManagementService.ts around line 524-532
const { data, error } = await supabase
  .from('failed_login_attempts')
  .insert({
    email,
    source_ip: await this.getClientIP(),      // CHANGED: ip_address → source_ip
    user_agent: navigator.userAgent,
    failure_reason: reason,                    // CHANGED: reason → failure_reason
    // timestamp is auto-generated, don't include it
  });
```

**This will work immediately** because these columns exist in both the database AND PostgREST's schema cache.

### ⚠️ **Solution 2: Force PostgREST Schema Cache Reload**

PostgREST caches the database schema for performance. When you add columns, you need to reload the cache.

**Option A: Wait for Automatic Reload**
- PostgREST automatically reloads schema cache periodically (usually every few minutes)
- The new columns should work eventually without any action

**Option B: Restart PostgREST (Supabase Dashboard)**
1. Go to Supabase Dashboard
2. Navigate to Settings → Database → Connection pooling
3. Restart the PostgREST service
4. This forces an immediate schema cache reload

**Option C: SQL Function to Trigger Reload (Advanced)**
Create this function to manually trigger schema reload:

```sql
-- Create notification function
CREATE OR REPLACE FUNCTION notify_pgrst()
RETURNS void AS $$
BEGIN
  NOTIFY pgrst, 'reload schema';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to service_role
GRANT EXECUTE ON FUNCTION notify_pgrst() TO service_role;

-- Then call it via REST API:
-- POST /rest/v1/rpc/notify_pgrst
```

### ❌ **Solution 3: Remove New Columns (NOT RECOMMENDED)**

If you want to stick with old column names, remove the new columns:

```sql
ALTER TABLE failed_login_attempts
  DROP COLUMN IF EXISTS ip_address,
  DROP COLUMN IF EXISTS reason,
  DROP COLUMN IF EXISTS attempted_at;
```

**Not recommended** because the sync trigger is already in place.

---

## Recommended Action Plan

### ✅ **IMMEDIATE FIX (Use Old Column Names)**

Update the code in `userManagementService.ts` at **lines 524-532** to use the column names PostgREST recognizes:

```typescript
// BEFORE (FAILING - lines 524-532):
const { error } = await supabase
  .from('failed_login_attempts')
  .insert({
    email,
    ip_address: await this.getClientIP(),      // ❌ NOT RECOGNIZED
    user_agent: navigator.userAgent,
    reason,                                     // ❌ NOT RECOGNIZED
    attempted_at: new Date().toISOString()      // ❌ NOT RECOGNIZED
  })

// AFTER (WORKING - use this):
const { error } = await supabase
  .from('failed_login_attempts')
  .insert({
    email,
    source_ip: await this.getClientIP(),       // ✅ RECOGNIZED
    user_agent: navigator.userAgent,
    failure_reason: reason,                     // ✅ RECOGNIZED
    // timestamp is auto-generated - don't include it
  })
```

### Also Update localStorage Fallback (lines 543-549)

The localStorage fallback uses the same new column names and needs to be updated:

```typescript
// BEFORE (lines 543-549):
const attemptData = {
  email,
  ip_address: await this.getClientIP(),      // Keep for localStorage
  user_agent: navigator.userAgent,
  reason,                                    // Keep for localStorage
  attempted_at: new Date().toISOString()     // Keep for localStorage
}

// AFTER: Keep as-is for localStorage (this is fine)
// localStorage doesn't care about column names, only the app reads it
```

**Actually, the localStorage fallback is fine as-is** because it's just JSON storage, not database INSERT.

### Long-term Fix (Optional - After Schema Cache Refresh)
1. Wait for automatic PostgREST schema cache reload (happens periodically)
2. OR manually restart PostgREST service in Supabase Dashboard
3. Once cache is refreshed, you can switch back to new column names if desired

---

## Technical Details

### Why This Happens
PostgREST caches the database schema in memory for performance. When you use raw SQL to add columns (via migrations), PostgREST doesn't automatically know about them until it reloads the cache.

### Schema Cache Lifecycle
1. PostgREST starts and loads schema into cache
2. Cache remains static until reload trigger
3. Reload triggers:
   - Manual NOTIFY pgrst, 'reload schema'
   - Periodic automatic reload (configuration-dependent)
   - PostgREST service restart

### Why Old Columns Work
The old columns (`source_ip`, `failure_reason`, `timestamp`) were in the schema when PostgREST last loaded its cache, so they're recognized.

---

## Verification

After applying Solution 1, verify with:

```bash
curl -X POST "https://anifqpihbnuuciqxddqi.supabase.co/rest/v1/failed_login_attempts" \
  -H "apikey: [ANON_KEY]" \
  -H "Authorization: Bearer [SERVICE_ROLE_KEY]" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "verify@test.com",
    "source_ip": "192.168.1.1",
    "user_agent": "Verification Test",
    "failure_reason": "Test reason"
  }'

# Expected: 201 Created with record details
```

---

## Files to Update

1. `src/services/userManagementService.ts` - Lines 524-532
2. Any other code that inserts into `failed_login_attempts`

## Search for Usage

```bash
# Find all INSERT operations to this table
grep -r "failed_login_attempts" src/ --include="*.ts" --include="*.tsx"
grep -r "ip_address.*reason.*attempted_at" src/ --include="*.ts" --include="*.tsx"
```

---

**Generated:** October 9, 2025
**Status:** Root cause identified, immediate fix available
