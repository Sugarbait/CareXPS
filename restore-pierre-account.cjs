/**
 * Restore Pierre Super User Account
 *
 * This script restores pierre@phaetonai.com with Super User privileges
 *
 * Usage: node restore-pierre-account.js
 */

const { createClient } = require('@supabase/supabase-js')
const crypto = require('crypto')

// Generate a valid UUID v4
function generateUUID() {
  return crypto.randomUUID()
}

// Supabase configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://cpkslvmydfdevdftieck.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwa3Nsdm15ZGZkZXZkZnRpZWNrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NjkwMDI5NSwiZXhwIjoyMDYyNDc2Mjk1fQ.5Nwr-DrgL63DwPMH2egxgdjoHGhAxCvIrz2SMTMKqD0'
const TENANT_ID = 'carexps_main'

// User details
const USER_EMAIL = 'pierre@phaetonai.com'
const USER_PASSWORD = '$Ineed1millie$_carexps'
const USER_NAME = 'Pierre Morenzie'

async function restorePierreAccount() {
  console.log('🔐 Pierre Super User Account Restoration')
  console.log('=' .repeat(50))
  console.log('')

  // Initialize Supabase client
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  console.log('✅ Connected to Supabase')

  try {
    // Step 1: Check if user exists (check all tenants first)
    console.log('\n📋 Step 1: Checking if user exists...')
    const { data: existingUsers, error: checkError } = await supabase
      .from('users')
      .select('*')
      .eq('email', USER_EMAIL)

    if (checkError) {
      console.error('❌ Error checking user:', checkError.message)
      return
    }

    let currentUserId = null

    if (existingUsers && existingUsers.length > 0) {
      const existingUser = existingUsers[0]
      currentUserId = existingUser.id

      console.log('✅ User found in database!')
      console.log(`   ID: ${existingUser.id}`)
      console.log(`   Email: ${existingUser.email}`)
      console.log(`   Name: ${existingUser.name}`)
      console.log(`   Role: ${existingUser.role}`)
      console.log(`   Tenant: ${existingUser.tenant_id}`)

      // Step 2: Update role to super_user and tenant_id
      console.log('\n📝 Step 2: Updating to Super User role...')
      const { data: updateData, error: updateError } = await supabase
        .from('users')
        .update({
          tenant_id: TENANT_ID,
          role: 'super_user',
          name: USER_NAME,
          is_active: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingUser.id)
        .select()

      if (updateError) {
        console.error('❌ Error updating user:', updateError.message)
        return
      }

      console.log('✅ User updated successfully!')
      console.log(`   Role: ${updateData[0].role}`)
    } else {
      console.log('⚠️  User not found, creating new user...')

      // Step 2: Create new user
      console.log('\n👤 Step 2: Creating new user account...')

      const userId = generateUUID()
      const azureAdId = generateUUID()

      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert([
          {
            id: userId,
            tenant_id: TENANT_ID,
            azure_ad_id: azureAdId,
            email: USER_EMAIL,
            name: USER_NAME,
            role: 'super_user',
            is_active: true,
            mfa_enabled: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ])
        .select()

      if (createError) {
        console.error('❌ Error creating user:', createError.message)
        return
      }

      currentUserId = newUser[0].id

      console.log('✅ User created successfully!')
      console.log(`   ID: ${newUser[0].id}`)
      console.log(`   Email: ${newUser[0].email}`)
      console.log(`   Role: ${newUser[0].role}`)
    }

    // Step 3: Store credentials in user_settings
    console.log('\n🔑 Step 3: Setting up login credentials...')

    // Simple encryption for password (in production, use proper hashing)
    const encryptedPassword = Buffer.from(USER_PASSWORD).toString('base64')

    const { data: settings, error: settingsError } = await supabase
      .from('user_settings')
      .select('*')
      .eq('tenant_id', TENANT_ID)
      .ilike('settings', `%${USER_EMAIL}%`)

    let settingsId = settings && settings.length > 0 ? settings[0].id : null

    if (settingsId) {
      // Update existing settings
      const { error: updateSettingsError } = await supabase
        .from('user_settings')
        .update({
          settings: JSON.stringify({
            email: USER_EMAIL,
            username: USER_EMAIL,
            password: encryptedPassword
          }),
          updated_at: new Date().toISOString()
        })
        .eq('id', settingsId)

      if (updateSettingsError) {
        console.error('❌ Error updating credentials:', updateSettingsError.message)
      } else {
        console.log('✅ Credentials updated in database')
      }
    } else {
      // Create new settings
      const settingsId = generateUUID()

      const { error: createSettingsError } = await supabase
        .from('user_settings')
        .insert([
          {
            id: settingsId,
            user_id: currentUserId,
            tenant_id: TENANT_ID,
            settings: JSON.stringify({
              email: USER_EMAIL,
              username: USER_EMAIL,
              password: encryptedPassword
            }),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ])

      if (createSettingsError) {
        console.error('❌ Error creating credentials:', createSettingsError.message)
      } else {
        console.log('✅ Credentials created in database')
      }
    }

    // Final verification
    console.log('\n✅ RESTORATION COMPLETE!')
    console.log('=' .repeat(50))
    console.log('')
    console.log('Account Details:')
    console.log(`  Email: ${USER_EMAIL}`)
    console.log(`  Password: ${USER_PASSWORD}`)
    console.log(`  Role: Super User`)
    console.log('')
    console.log('You can now log in to the application!')

  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

// Run the restoration
restorePierreAccount().catch(console.error)
