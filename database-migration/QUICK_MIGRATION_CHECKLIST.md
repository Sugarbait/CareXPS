# CareXPS Database Migration - Quick Checklist

## ⏱️ Estimated Time: 30-60 minutes

## ✅ Pre-Migration (5 min)

- [ ] **Backup current database** via Supabase Dashboard
- [ ] **Verify new project is accessible**: https://anifqpihbnuuciqxddqi.supabase.co
- [ ] **Test new credentials** work
- [ ] **Notify team** of migration window

## 🗄️ Schema Migration (10 min)

- [ ] Open new Supabase project SQL Editor
- [ ] Copy contents of `database-migration/carexps-complete-schema.sql`
- [ ] Paste and run in SQL Editor
- [ ] Verify all tables created successfully:
  - users
  - user_settings
  - user_profiles
  - user_mfa_configs
  - mfa_challenges
  - audit_logs
  - failed_login_attempts
  - notes
  - system_credentials

## 📦 Data Export (10 min)

Choose ONE method:

### Method A: Supabase Dashboard Backup
- [ ] Go to old project → Database → Backups
- [ ] Create manual backup
- [ ] Download backup file

### Method B: Browser Console Export
- [ ] Open your CareXPS app in browser
- [ ] Open browser console (F12)
- [ ] Run the JavaScript export script from MIGRATION_GUIDE.md
- [ ] Download exported JSON file

### Method C: Direct SQL Export (requires database access)
- [ ] Run pg_dump command from MIGRATION_GUIDE.md
- [ ] Save SQL file

## 📥 Data Import (10-15 min)

Based on your export method:

### If you used Method A or C (SQL):
- [ ] Open new Supabase project SQL Editor
- [ ] Upload/paste SQL dump
- [ ] Run import query

### If you used Method B (JSON):
- [ ] Create `import-data.js` from MIGRATION_GUIDE.md
- [ ] Update service role key in script
- [ ] Run: `node import-data.js`
- [ ] Verify all records imported

## 🔧 Update Environment Variables (10 min)

### Local Environment
- [ ] Open `I:\Apps Back Up\CareXPS CRM\.env.local`
- [ ] Replace Supabase URL with: `https://anifqpihbnuuciqxddqi.supabase.co`
- [ ] Replace Anon Key with: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFuaWZxcGloYm51dWNpcXhkZHFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5NjY4MzMsImV4cCI6MjA3NTU0MjgzM30.RxP5FlqaiWFxE9CIwsszcWtfJJ_IBi6QUatwx7VP52w`
- [ ] Replace Service Role Key with: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFuaWZxcGloYm51dWNpcXhkZHFpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTk2NjgzMywiZXhwIjoyMDc1NTQyODMzfQ.e8Y9RqpnoQWzIxzdTyKj0StNGyW33s3mXe0BlDh6Bsc`
- [ ] Save file

### GitHub Actions Workflow
- [ ] Open `.github/workflows/azure-static-web-apps-carexps.yml`
- [ ] Find line ~43 (VITE_SUPABASE_ANON_KEY)
- [ ] Replace with new anon key
- [ ] Find VITE_SUPABASE_URL if hardcoded
- [ ] Replace with new URL
- [ ] Commit and push changes

## 🧪 Local Testing (10 min)

- [ ] Stop development server if running
- [ ] Clear browser data:
  ```javascript
  localStorage.clear();
  sessionStorage.clear();
  location.reload();
  ```
- [ ] Start dev server: `npm run dev`
- [ ] Test login
- [ ] Test MFA authentication
- [ ] Verify user profile loads
- [ ] Check user settings
- [ ] Verify notes are accessible
- [ ] Test cross-device sync (if possible)

## ✅ Data Integrity Verification (5 min)

Run in new Supabase SQL Editor:

```sql
-- Quick counts check
SELECT
  (SELECT COUNT(*) FROM users) as users,
  (SELECT COUNT(*) FROM user_settings) as settings,
  (SELECT COUNT(*) FROM user_profiles) as profiles,
  (SELECT COUNT(*) FROM audit_logs) as audit_logs,
  (SELECT COUNT(*) FROM notes) as notes;

-- Verify super users
SELECT email, role FROM users WHERE role = 'super_user';
```

- [ ] User counts match old database
- [ ] Super users present (pierre@phaetonai.com, elmfarrell@yahoo.com)
- [ ] Audit logs migrated
- [ ] Notes migrated

## 🚀 Production Deployment (5-10 min)

- [ ] Commit workflow changes
- [ ] Push to GitHub
- [ ] Monitor GitHub Actions deployment
- [ ] Wait for Azure deployment to complete
- [ ] Test production site: https://carexps.nexasync.ca

## 🔍 Production Testing (5 min)

- [ ] Open production site in incognito/private window
- [ ] Test login
- [ ] Test MFA
- [ ] Verify data loads correctly
- [ ] Check audit logs
- [ ] Test one complete user flow

## 📝 Post-Migration (5 min)

- [ ] Document migration completion date
- [ ] Update `DATABASE_LOCKDOWN_POLICY.md` with new URL
- [ ] Keep old database active as backup (minimum 7 days)
- [ ] Monitor new database for issues
- [ ] Notify team of successful migration

## 🎉 Success Criteria

All of these must be ✅:
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
2. Revert `.env.local` to old credentials:
   ```
   VITE_SUPABASE_URL=https://cpkslvmydfdevdftieck.supabase.co
   VITE_SUPABASE_ANON_KEY=(old key)
   ```
3. Clear browser cache
4. Restart dev server
5. Verify old database still works
6. Review errors before retrying

## 📊 Migration Status

**Date Started**: _____________

**Date Completed**: _____________

**Migrated By**: _____________

**Issues Encountered**: _____________

**Resolution**: _____________

---

## Quick Reference - New Database Credentials

```
URL: https://anifqpihbnuuciqxddqi.supabase.co

Anon Key:
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFuaWZxcGloYm51dWNpcXhkZHFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5NjY4MzMsImV4cCI6MjA3NTU0MjgzM30.RxP5FlqaiWFxE9CIwsszcWtfJJ_IBi6QUatwx7VP52w

Service Role Key:
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFuaWZxcGloYm51dWNpcXhkZHFpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTk2NjgzMywiZXhwIjoyMDc1NTQyODMzfQ.e8Y9RqpnoQWzIxzdTyKj0StNGyW33s3mXe0BlDh6Bsc
```

---

**Last Updated**: 2025-10-08
**Status**: Ready to Execute
