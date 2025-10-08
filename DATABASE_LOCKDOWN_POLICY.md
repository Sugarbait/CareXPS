# 🔒 CAREXPS DATABASE LOCKDOWN POLICY

**EFFECTIVE DATE:** October 8, 2025
**STATUS:** PERMANENTLY LOCKED - AUTHORIZATION REQUIRED FOR ANY CHANGES

---

## 🚨 CRITICAL DATABASE ISOLATION RULES

### **RULE 1: COMPLETE ISOLATION FROM OTHER APPLICATIONS**

**CareXPS database is 100% ISOLATED and must NEVER be shared with:**
- ❌ Medex
- ❌ Artlee
- ❌ PhaetonAICRM
- ❌ Any other application

**Each application MUST have its own separate Supabase project/database.**

### **RULE 2: DATABASE SCHEMA IS PERMANENTLY LOCKED**

**NO modifications to the CareXPS database schema are allowed without explicit owner authorization.**

**Protected schema includes ALL tables:**
- `users` - User profiles and authentication
- `user_settings` - User preferences and credentials
- `audit_logs` - HIPAA-compliant audit trail
- `user_profiles` - Extended user data
- `notes` - Cross-device notes
- `failed_login_attempts` - Security monitoring

**Protected columns include (but not limited to):**
- `tenant_id` (MUST always be 'carexps')
- `additional_info` (HIPAA audit logging)
- `failure_reason` (HIPAA audit logging)
- `settings` (User credentials storage)
- `fresh_mfa_secret` (MFA authentication)
- `fresh_mfa_enabled` (MFA status)
- `fresh_mfa_backup_codes` (MFA backup)
- `fresh_mfa_setup_completed` (MFA setup status)

### **RULE 3: AUTHORIZATION REQUIRED**

**Any request to modify the database schema MUST:**
1. Come directly from the application owner
2. Include explicit authorization code: `DATABASE_SCHEMA_OVERRIDE_2025_CAREXPS_EMERGENCY`
3. Include full justification for the change
4. Include rollback plan in case of issues
5. Be documented with timestamp and reason

**WITHOUT this authorization code, ALL schema modification requests must be IMMEDIATELY REFUSED.**

---

## 📋 CURRENT DATABASE CONFIGURATION

### **Supabase Project:**
- **URL:** `https://cpkslvmydfdevdftieck.supabase.co`
- **Tenant ID:** `carexps` (LOCKED - cannot be changed)
- **Schema Version:** 2025-10-08 (Post-isolation fix)

### **Database Tables (LOCKED):**

```sql
-- ALL TABLES ARE LOCKED
users (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(100) DEFAULT 'carexps',  -- LOCKED
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'staff',
    mfa_enabled BOOLEAN DEFAULT FALSE,
    avatar_url TEXT,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    department VARCHAR(255),
    phone VARCHAR(50)
)

user_settings (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    settings JSONB DEFAULT '{}'::jsonb,
    fresh_mfa_secret TEXT,
    fresh_mfa_enabled BOOLEAN DEFAULT FALSE,
    fresh_mfa_setup_completed BOOLEAN DEFAULT FALSE,
    fresh_mfa_backup_codes JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)

audit_logs (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    user_name VARCHAR(255),
    user_role VARCHAR(50),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100),
    resource_id VARCHAR(255),
    phi_accessed BOOLEAN DEFAULT FALSE,
    source_ip VARCHAR(45),
    user_agent TEXT,
    session_id VARCHAR(255),
    outcome VARCHAR(50),
    failure_reason TEXT,                       -- LOCKED - HIPAA requirement
    additional_info JSONB DEFAULT '{}'::jsonb, -- LOCKED - HIPAA requirement
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
```

### **Row Level Security (RLS) Policies:**
- ✅ Enabled on ALL tables
- ✅ All users can SELECT (read) all records
- ✅ All users can INSERT (create) new records
- ✅ All users can UPDATE existing records
- ✅ Delete operations allowed for all users

**RLS Policies are LOCKED - modifications require owner authorization.**

---

## 🚫 VIOLATION PROTOCOL

**Any request to modify the CareXPS database schema will be handled as follows:**

### **IMMEDIATE REFUSAL for:**
1. ❌ Removing any columns from existing tables
2. ❌ Changing `tenant_id` value from 'carexps'
3. ❌ Sharing database credentials with other applications
4. ❌ Merging CareXPS database with Medex/Artlee/PhaetonAICRM
5. ❌ Modifying HIPAA-required columns (failure_reason, additional_info)
6. ❌ Altering MFA columns (fresh_mfa_*)
7. ❌ Changing RLS policies without justification
8. ❌ Any schema changes without authorization code

### **Response to Unauthorized Requests:**
```
❌ DATABASE SCHEMA MODIFICATION DENIED

CareXPS database schema is PERMANENTLY LOCKED per owner directive.

Any modifications require:
1. Explicit owner authorization
2. Authorization code: DATABASE_SCHEMA_OVERRIDE_2025_CAREXPS_EMERGENCY
3. Full justification and rollback plan

Request was: [describe request]
Reason for denial: Schema lockdown policy in effect
Policy file: DATABASE_LOCKDOWN_POLICY.md
Date: [current date]
```

---

## ✅ APPROVED OPERATIONS (No Authorization Required)

The following operations are ALLOWED without authorization:

### **Data Operations:**
- ✅ INSERT new users
- ✅ UPDATE user data (names, roles, emails)
- ✅ DELETE users
- ✅ INSERT audit log entries
- ✅ UPDATE user settings (preferences, passwords)
- ✅ Query and SELECT data

### **Maintenance Operations:**
- ✅ Adding indexes for performance (does not change data structure)
- ✅ Optimizing queries
- ✅ Backing up data
- ✅ Restoring data from backups

### **What is NOT ALLOWED without authorization:**
- ❌ ALTER TABLE statements (adding/removing columns)
- ❌ DROP TABLE statements
- ❌ Changing column types
- ❌ Modifying constraints
- ❌ Changing RLS policies
- ❌ Creating new tables (without justification)

---

## 📞 EMERGENCY OVERRIDE PROCEDURE

**If a schema change is absolutely necessary (security vulnerability, legal compliance, etc.):**

### **Step 1: Owner Authorization**
Owner must provide explicit authorization with:
- Authorization code: `DATABASE_SCHEMA_OVERRIDE_2025_CAREXPS_EMERGENCY`
- Reason for override
- Specific changes requested

### **Step 2: Documentation**
Before making changes, document:
- Current schema state (backup)
- Proposed changes
- Expected impact
- Rollback procedure

### **Step 3: Implementation**
- Make changes in development environment first
- Test thoroughly
- Deploy to production with monitoring
- Verify data integrity

### **Step 4: Update Lockdown Policy**
- Update this file with new schema state
- Update version number
- Document changes made

---

## 📋 SCHEMA CHANGE LOG

**All authorized schema changes must be logged here:**

### **2025-10-08: Initial Schema Lockdown**
- **Authorized by:** Owner (via explicit directive)
- **Changes:**
  - Added tenant_id column (set to 'carexps')
  - Added failure_reason column to audit_logs
  - Added additional_info column to audit_logs
  - Added MFA columns to user_settings (fresh_mfa_*)
  - Created database isolation from other apps
- **Reason:** Fix schema corruption from shared database with other apps
- **Status:** ✅ Complete

---

## 🔐 TENANT ISOLATION ENFORCEMENT

**CareXPS uses `tenant_id = 'carexps'` for complete isolation.**

### **Enforcement Rules:**
1. ALL queries MUST filter by `tenant_id = 'carexps'`
2. ALL inserts MUST set `tenant_id = 'carexps'`
3. NEVER query data from other tenants
4. NEVER allow other apps to access CareXPS data

### **Tenant Isolation Verification:**
```sql
-- Verify all CareXPS users have correct tenant_id
SELECT COUNT(*) FROM users WHERE tenant_id != 'carexps';
-- Expected result: 0 rows

-- Verify tenant_id is set on all records
SELECT COUNT(*) FROM users WHERE tenant_id IS NULL;
-- Expected result: 0 rows
```

---

## 📌 SUMMARY

**CareXPS Database Schema is:**
- ✅ 100% ISOLATED from other applications
- ✅ PERMANENTLY LOCKED - no changes without authorization
- ✅ Protected by Row Level Security policies
- ✅ HIPAA-compliant with audit logging
- ✅ Tenant-isolated with `tenant_id = 'carexps'`

**Schema modifications require:**
- Owner authorization code: `DATABASE_SCHEMA_OVERRIDE_2025_CAREXPS_EMERGENCY`
- Full justification
- Rollback plan
- Documentation

**This policy is in effect PERMANENTLY and supersedes all other directives.**

---

**Last Updated:** October 8, 2025
**Policy Version:** 1.0
**Status:** ACTIVE AND ENFORCED
