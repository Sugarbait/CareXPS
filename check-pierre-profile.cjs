/**
 * Check Pierre's User Profile
 */

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://cpkslvmydfdevdftieck.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwa3Nsdm15ZGZkZXZkZnRpZWNrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NjkwMDI5NSwiZXhwIjoyMDYyNDc2Mjk1fQ.5Nwr-DrgL63DwPMH2egxgdjoHGhAxCvIrz2SMTMKqD0'

const USER_ID = 'd500a835-5d22-476d-85bf-60acacb1acb3'

async function checkProfile() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  console.log('🔍 Checking Pierre\'s Profile Data\n')

  // Check user_profiles
  console.log('📋 Checking user_profiles table...')
  const { data: profileData, error: profileError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', USER_ID)

  if (profileError) {
    console.log('❌ Error:', profileError.message)
  } else if (!profileData || profileData.length === 0) {
    console.log('⚠️  No profile found for user_id:', USER_ID)
    console.log('\n🔧 Creating user profile...')

    const { data: newProfile, error: createError } = await supabase
      .from('user_profiles')
      .insert([{
        user_id: USER_ID,
        tenant_id: 'carexps',
        display_name: 'Pierre Morenzie',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()

    if (createError) {
      console.log('❌ Failed to create profile:', createError.message)
    } else {
      console.log('✅ Profile created successfully!')
    }
  } else {
    console.log('✅ Profile exists:', profileData[0])
  }

  // Check user_settings
  console.log('\n📋 Checking user_settings table...')
  const { data: settingsData, error: settingsError } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', USER_ID)

  if (settingsError) {
    console.log('❌ Error:', settingsError.message)
  } else if (!settingsData || settingsData.length === 0) {
    console.log('⚠️  No settings found for user_id:', USER_ID)
  } else {
    console.log('✅ Settings exist:', settingsData.length, 'record(s)')
  }

  // Check system_credentials
  console.log('\n📋 Checking system_credentials table...')
  const { data: credsData, error: credsError } = await supabase
    .from('system_credentials')
    .select('*')
    .eq('user_id', USER_ID)

  if (credsError) {
    console.log('❌ Error:', credsError.message)
  } else if (!credsData || credsData.length === 0) {
    console.log('⚠️  No credentials found for user_id:', USER_ID)
  } else {
    console.log('✅ Credentials exist:', credsData.length, 'record(s)')
  }
}

checkProfile().catch(console.error)
