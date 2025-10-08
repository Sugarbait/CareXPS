# 🔐 Setup Isolated CareXPS Database

**CRITICAL:** CareXPS must have its own dedicated Supabase database, completely isolated from Medex, Artlee, and PhaetonAICRM.

---

## ⚡ IMMEDIATE FIX - Get Login Working NOW (5 minutes)

Your current database is corrupted by other applications. Use local storage authentication to get back online immediately:

### Step 1: Setup Local Authentication
1. Open: **http://localhost:3212/setup-local-auth.html**
2. Click the big blue button: **"🚀 Setup All Users (ORIGINAL Passwords)"**
3. Wait for "✅ Setup Complete!" message

### Step 2: Login
1. Go to: **http://localhost:3212**
2. Login with ORIGINAL credentials:
   - **Email:** `pierre@phaetonai.com`
   - **Password:** `$Ineed1millie$_carexps`

   OR

   - **Email:** `elmfarrell@yahoo.com`
   - **Password:** `Farrell1000!`

✅ **You should now be logged in and CareXPS will work using local storage only!**

---

## 🏗️ PERMANENT SOLUTION - Dedicated CareXPS Database (30 minutes)

Create a completely isolated Supabase project for CareXPS only.

### Step 1: Create New Supabase Project

1. **Go to Supabase Dashboard:** https://supabase.com/dashboard
2. **Click "New Project"**
3. **Fill in details:**
   - **Name:** `CareXPS-Production`
   - **Database Password:** Choose a strong password (save it!)
   - **Region:** Choose closest to your users
   - **Pricing Plan:** Free or Pro (recommended for production)
4. **Click "Create new project"**
5. **Wait 2-3 minutes** for project to be created

### Step 2: Get New Database Credentials

Once your project is created:

1. Go to **Settings** (gear icon in sidebar)
2. Click **API** section
3. Copy these values (you'll need them):
   - **Project URL:** `https://xxxxxxxxxxxxx.supabase.co`
   - **anon/public key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (long string)
   - **service_role key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (different long string)

### Step 3: Run Database Schema

1. In Supabase Dashboard, go to **SQL Editor** (left sidebar)
2. Click **"New query"**
3. Open the file: `CAREXPS_DATABASE_SCHEMA.sql` (in your project root)
4. **Copy ALL the SQL** from that file
5. **Paste it into the Supabase SQL Editor**
6. Click **"Run"** button (or press Ctrl+Enter)
7. Wait for "Success. No rows returned" message

✅ **Your isolated CareXPS database is now created with:**
- All required tables (users, user_settings, audit_logs, etc.)
- Proper security policies (RLS)
- Super user accounts with ORIGINAL passwords
- HIPAA-compliant audit logging

### Step 4: Update CareXPS Environment Variables

1. **Open file:** `.env.local` (in project root)
2. **Replace the Supabase credentials** with your NEW isolated database:

```env
# CareXPS ISOLATED DATABASE - DO NOT SHARE WITH OTHER APPS
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

3. **Save the file**

### Step 5: Restart Development Server

```bash
# Stop the current server (Ctrl+C in the terminal)
# Then start it again:
npm run dev
```

### Step 6: Test Login with New Database

1. **Clear browser data** (important!):
   - Press F12 (open DevTools)
   - Go to **Application** tab
   - Click **Clear storage**
   - Click **"Clear site data"** button

2. **Refresh the page** (F5)

3. **Login with ORIGINAL passwords:**
   - **pierre@phaetonai.com** / `$Ineed1millie$_carexps`
   - **elmfarrell@yahoo.com** / `Farrell1000!`

✅ **Success! CareXPS is now using its own isolated database!**

---

## 🔒 Database Isolation Verification

Run these checks to verify CareXPS is completely isolated:

### Check 1: Verify Database Tables
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

**Expected tables:**
- audit_logs
- failed_login_attempts
- notes
- user_profiles
- user_settings
- users

### Check 2: Verify Super Users
```sql
SELECT email, name, role FROM users WHERE role = 'super_user';
```

**Expected results:**
- pierre@phaetonai.com - Pierre Morenzie - super_user
- elmfarrell@yahoo.com - ELM Farrell - super_user

### Check 3: Verify User Settings (Passwords)
```sql
SELECT user_id, settings->>'username' as username
FROM user_settings;
```

**Expected results:**
- 2 rows with usernames: pierre@phaetonai.com and elmfarrell@yahoo.com

---

## 📋 Maintaining Database Isolation

**CRITICAL RULES:**

1. **NEVER share Supabase credentials** between CareXPS and other apps
2. **Each app gets its own Supabase project:**
   - CareXPS → CareXPS-Production project
   - Medex → Medex-Production project
   - Artlee → Artlee-Production project
   - PhaetonAICRM → PhaetonAICRM-Production project

3. **Environment variables are app-specific:**
   - CareXPS uses `.env.local` with CareXPS database
   - Other apps use their own `.env.local` with their own databases

4. **No shared tables, no shared data, no shared projects**

---

## 🆘 Troubleshooting

### Problem: "Invalid email or password" after setting up new database

**Solution:**
1. Open: http://localhost:3212/setup-local-auth.html
2. Click "Setup All Users" again
3. Try logging in

### Problem: Database queries return 400 errors

**Solution:**
1. Verify you ran the complete CAREXPS_DATABASE_SCHEMA.sql
2. Check that .env.local has the CORRECT new database credentials
3. Restart dev server: `npm run dev`

### Problem: Other apps (Medex/Artlee/PhaetonAICRM) are broken

**Solution:**
- **This is expected!** They were using the shared database.
- Each app needs its own isolated database (same process as above)
- Do NOT try to make CareXPS work with shared database - it won't work

---

## 📞 Support

If you encounter issues:
1. Check browser console (F12) for error messages
2. Verify Supabase project is active and running
3. Confirm .env.local has correct credentials
4. Clear browser storage and try again

**Database Schema File:** `CAREXPS_DATABASE_SCHEMA.sql`
**Local Auth Tool:** http://localhost:3212/setup-local-auth.html

---

**✅ Once complete, CareXPS will have:**
- Its own dedicated Supabase database
- Complete isolation from other applications
- ORIGINAL user passwords restored
- Full HIPAA-compliant functionality
- Cross-device synchronization working properly
