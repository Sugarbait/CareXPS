/**
 * Check user_settings Table Schema
 */

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://cpkslvmydfdevdftieck.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwa3Nsdm15ZGZkZXZkZnRpZWNrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NjkwMDI5NSwiZXhwIjoyMDYyNDc2Mjk1fQ.5Nwr-DrgL63DwPMH2egxgdjoHGhAxCvIrz2SMTMKqD0'

async function checkSchema() {
  console.log('🔍 Checking Database Schema')
  console.log('='.repeat(80))
  console.log('')

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  try {
    // Check user_settings table
    console.log('📋 user_settings table:')
    const { data: settings, error: settingsError } = await supabase
      .from('user_settings')
      .select('*')
      .limit(1)

    if (settingsError) {
      console.error('❌ Error:', settingsError.message)
    } else if (settings && settings.length > 0) {
      console.log('Columns:', Object.keys(settings[0]).join(', '))
      console.log('\nSample data:')
      console.log(JSON.stringify(settings[0], null, 2))
    } else {
      console.log('⚠️  Table is empty')

      // Try to get column info from an insert attempt
      console.log('\nAttempting to detect columns...')
      const { error: insertError } = await supabase
        .from('user_settings')
        .insert([{ test: 'test' }])

      if (insertError) {
        console.log('Error message:', insertError.message)
      }
    }

    console.log('\n' + '='.repeat(80))

    // Check users table structure
    console.log('\n📋 users table:')
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .limit(1)

    if (usersError) {
      console.error('❌ Error:', usersError.message)
    } else if (users && users.length > 0) {
      console.log('Columns:', Object.keys(users[0]).join(', '))
    }

    console.log('\n' + '='.repeat(80))

  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

checkSchema().catch(console.error)
