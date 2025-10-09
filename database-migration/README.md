# CareXPS Database Migration Kit

Complete migration package for moving CareXPS database to dedicated Supabase project.

## 📁 Files in This Package

### 📄 Documentation
- **MIGRATION_GUIDE.md** - Comprehensive step-by-step migration guide
- **QUICK_MIGRATION_CHECKLIST.md** - Quick reference checklist for 30-60 minute migration
- **README.md** (this file) - Package overview

### 🗄️ Schema
- **carexps-complete-schema.sql** - Complete database schema for new Supabase project
  - All tables (users, user_settings, user_profiles, MFA, audit_logs, notes, etc.)
  - All indexes for performance
  - All triggers for auto-updates
  - All RLS policies for security
  - All permissions and grants
  - Ready to apply to new database

### 🔧 Tools
- **export-data-browser.html** - Browser-based data export tool (no dependencies)
- **import-data.mjs** - Node.js data import script (requires @supabase/supabase-js)

## 🎯 Migration Objectives

1. **100% Database Isolation** - Dedicated Supabase project for CareXPS only
2. **Zero Data Loss** - Complete data migration with integrity verification
3. **Minimal Downtime** - Optimized 30-60 minute migration process
4. **Production Ready** - Tested and verified before switchover

## 🚀 Quick Start (30-60 minutes)

### Option 1: Follow Quick Checklist (Recommended for Speed)

```bash
# Open and follow this file:
database-migration/QUICK_MIGRATION_CHECKLIST.md
```

### Option 2: Follow Comprehensive Guide (Recommended for First-Time)

```bash
# Open and follow this file:
database-migration/MIGRATION_GUIDE.md
```

## 📋 Migration Steps Overview

1. **Apply Schema** (10 min)
   - Open new Supabase project SQL Editor
   - Run `carexps-complete-schema.sql`

2. **Export Data** (10 min)
   - Open `export-data-browser.html` in browser
   - Click "Start Export"
   - Download JSON file

3. **Import Data** (10-15 min)
   ```bash
   npm install @supabase/supabase-js
   node database-migration/import-data.mjs
   ```

4. **Update Environment** (10 min)
   - Update `.env.local` with new Supabase credentials
   - Update `.github/workflows/azure-static-web-apps-carexps.yml`

5. **Test** (10 min)
   - Test locally
   - Test production deployment
   - Verify data integrity

## 🔑 New Database Credentials

```
URL: https://anifqpihbnuuciqxddqi.supabase.co

Anon Key:
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFuaWZxcGloYm51dWNpcXhkZHFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5NjY4MzMsImV4cCI6MjA3NTU0MjgzM30.RxP5FlqaiWFxE9CIwsszcWtfJJ_IBi6QUatwx7VP52w

Service Role Key:
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFuaWZxcGloYm51dWNpcXhkZHFpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTk2NjgzMywiZXhwIjoyMDc1NTQyODMzfQ.e8Y9RqpnoQWzIxzdTyKj0StNGyW33s3mXe0BlDh6Bsc
```

## ⚠️ Important Notes

### Before You Start
- ✅ This migration is **SAFE** and **RECOMMENDED**
- ✅ Aligns with DATABASE ISOLATION POLICY (each app needs its own database)
- ✅ Old database will remain active as backup
- ✅ No data loss - complete migration with verification
- ✅ Rollback plan included in case of issues

### Security
- All credentials are included in this package (provided by user)
- Service role keys should be kept secure
- Never commit `.env.local` to git

### Database Schema
- Schema is **PERMANENTLY LOCKED** after migration
- Any changes require authorization code: `DATABASE_SCHEMA_OVERRIDE_2025_CAREXPS_EMERGENCY`
- See `CLAUDE.md` for full lockdown policy

## 📊 What Gets Migrated

### Core Tables
- ✅ `users` - User accounts with Azure AD integration
- ✅ `user_settings` - User preferences and MFA configurations
- ✅ `user_profiles` - Extended profile information

### MFA Tables
- ✅ `user_mfa_configs` - Legacy MFA system
- ✅ `mfa_challenges` - MFA challenge tokens

### Security Tables
- ✅ `audit_logs` - HIPAA-compliant audit trail
- ✅ `failed_login_attempts` - Security monitoring

### Application Data
- ✅ `notes` - Cross-device synchronized notes
- ✅ `system_credentials` - System-wide credentials

## 🛠️ Tools Usage

### Browser Export Tool

```bash
# 1. Open in browser:
start database-migration/export-data-browser.html

# 2. Verify credentials are pre-filled
# 3. Click "Start Export"
# 4. Download JSON file
```

### Node.js Import Script

```bash
# 1. Install dependencies
npm install @supabase/supabase-js

# 2. Ensure export file exists
# database-migration/carexps-data-export.json

# 3. Run import
node database-migration/import-data.mjs
```

## ✅ Success Criteria

Migration is successful when:
- [ ] Schema applied to new database
- [ ] All data migrated (counts match)
- [ ] Local environment works
- [ ] Production deployment successful
- [ ] Users can login and access data
- [ ] MFA working correctly
- [ ] No errors in console
- [ ] Old database still accessible as backup

## 🆘 Emergency Rollback

If anything goes wrong:

1. **STOP** - Do not proceed
2. Revert `.env.local` to old Supabase URL/keys
3. Clear browser cache: `localStorage.clear(); sessionStorage.clear();`
4. Restart dev server
5. Verify old database still works
6. Review errors before retrying

## 📞 Support

For migration assistance:
- pierre@phaetonai.com (Super User)
- elmfarrell@yahoo.com (Super User)

## 📝 Post-Migration

After successful migration:

1. ✅ Update `DATABASE_LOCKDOWN_POLICY.md` with new URL
2. ✅ Document migration completion date
3. ✅ Keep old database as backup (minimum 7 days)
4. ✅ Monitor new database for issues
5. ✅ Celebrate 100% isolation! 🎉

---

**Created**: 2025-10-08
**Status**: Ready to Execute
**Estimated Time**: 30-60 minutes
**Risk Level**: Low (rollback plan included)
**Alignment**: 100% compliant with DATABASE ISOLATION POLICY
