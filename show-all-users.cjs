/**
 * Show All CareXPS Users
 */

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://cpkslvmydfdevdftieck.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwa3Nsdm15ZGZkZXZkZnRpZWNrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NjkwMDI5NSwiZXhwIjoyMDYyNDc2Mjk1fQ.5Nwr-DrgL63DwPMH2egxgdjoHGhAxCvIrz2SMTMKqD0'

async function showAllUsers() {
  console.log('👥 All CareXPS Users')
  console.log('='.repeat(80))
  console.log('')

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  try {
    // Get all users
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('❌ Error fetching users:', error.message)
      return
    }

    if (!users || users.length === 0) {
      console.log('⚠️  No users found in database')
      return
    }

    console.log(`Found ${users.length} user(s):\n`)

    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email}`)
      console.log(`   ID: ${user.id}`)
      console.log(`   Name: ${user.name || 'N/A'}`)
      console.log(`   Role: ${user.role || 'N/A'}`)
      console.log(`   Active: ${user.is_active ? 'Yes' : 'No'}`)
      console.log(`   MFA Enabled: ${user.mfa_enabled ? 'Yes' : 'No'}`)
      console.log(`   Created: ${user.created_at}`)
      console.log(`   Last Updated: ${user.updated_at}`)
      console.log('')
    })

    // Get user settings/credentials
    console.log('\n' + '='.repeat(80))
    console.log('🔑 Login Credentials Status')
    console.log('='.repeat(80) + '\n')

    for (const user of users) {
      const { data: settings, error: settingsError } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)

      if (settingsError) {
        console.log(`${user.email}: ❌ Error checking credentials`)
        continue
      }

      if (settings && settings.length > 0) {
        try {
          const parsedSettings = JSON.parse(settings[0].settings)
          const hasPassword = !!parsedSettings.password
          console.log(`${user.email}: ${hasPassword ? '✅ Has login credentials' : '⚠️  Missing password'}`)
        } catch {
          console.log(`${user.email}: ⚠️  Invalid settings format`)
        }
      } else {
        console.log(`${user.email}: ❌ No credentials found`)
      }
    }

    console.log('\n' + '='.repeat(80))

  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

showAllUsers().catch(console.error)
