/**
 * Diagnose Database Schema Issues
 */

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://cpkslvmydfdevdftieck.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwa3Nsdm15ZGZkZXZkZnRpZWNrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NjkwMDI5NSwiZXhwIjoyMDYyNDc2Mjk1fQ.5Nwr-DrgL63DwPMH2egxgdjoHGhAxCvIrz2SMTMKqD0'

async function diagnose() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  console.log('🔍 Database Schema Diagnostic\n')
  console.log('=' .repeat(60))

  // Check users table
  console.log('\n📋 Checking users table...')
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('email', 'pierre@phaetonai.com')
    .limit(1)

  if (userError) {
    console.log('❌ Error:', userError.message)
  } else {
    console.log('✅ Users table OK')
    console.log('   User ID:', userData[0]?.id)
    console.log('   Tenant:', userData[0]?.tenant_id)
  }

  // Check user_profiles table
  console.log('\n📋 Checking user_profiles table...')
  const { data: profileData, error: profileError } = await supabase
    .from('user_profiles')
    .select('*')
    .limit(1)

  if (profileError) {
    console.log('❌ Error:', profileError.message)
    console.log('   Code:', profileError.code)
    console.log('   Details:', profileError.details)

    if (profileError.code === 'PGRST204' || profileError.code === '42P01') {
      console.log('\n⚠️  Table user_profiles does not exist or is not accessible')
    }
  } else {
    console.log('✅ user_profiles table OK')
    console.log('   Columns:', Object.keys(profileData[0] || {}))
  }

  // Check user_settings table
  console.log('\n📋 Checking user_settings table...')
  const { data: settingsData, error: settingsError } = await supabase
    .from('user_settings')
    .select('*')
    .limit(1)

  if (settingsError) {
    console.log('❌ Error:', settingsError.message)
  } else {
    console.log('✅ user_settings table OK')
  }

  // Check system_credentials table
  console.log('\n📋 Checking system_credentials table...')
  const { data: credsData, error: credsError } = await supabase
    .from('system_credentials')
    .select('*')
    .limit(1)

  if (credsError) {
    console.log('❌ Error:', credsError.message)
    console.log('   Code:', credsError.code)

    if (credsError.code === 'PGRST204' || credsError.code === '42P01') {
      console.log('\n⚠️  Table system_credentials does not exist or is not accessible')
    }
  } else {
    console.log('✅ system_credentials table OK')
  }

  // Check failed_login_attempts table
  console.log('\n📋 Checking failed_login_attempts table...')
  const { data: loginData, error: loginError } = await supabase
    .from('failed_login_attempts')
    .select('*')
    .limit(1)

  if (loginError) {
    console.log('❌ Error:', loginError.message)
    console.log('   Code:', loginError.code)

    if (loginError.code === 'PGRST204' || loginError.code === '42P01') {
      console.log('\n⚠️  Table failed_login_attempts does not exist or is not accessible')
    }
  } else {
    console.log('✅ failed_login_attempts table OK')
  }

  console.log('\n' + '=' .repeat(60))
  console.log('\n💡 Recommendation:')
  console.log('   The app expects these tables to exist.')
  console.log('   Run database migrations or create missing tables.')
}

diagnose().catch(console.error)
