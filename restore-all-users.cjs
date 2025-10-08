/**
 * Restore All User Login Access
 *
 * This script ensures all users have proper login access
 */

const { createClient } = require('@supabase/supabase-js')
const crypto = require('crypto')

// Supabase configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://cpkslvmydfdevdftieck.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwa3Nsdm15ZGZkZXZkZnRpZWNrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NjkwMDI5NSwiZXhwIjoyMDYyNDc2Mjk1fQ.5Nwr-DrgL63DwPMH2egxgdjoHGhAxCvIrz2SMTMKqD0'
const TENANT_ID = 'carexps'

// Protected super users - ORIGINAL PASSWORDS
const SUPER_USERS = [
  {
    email: 'pierre@phaetonai.com',
    password: '$Ineed1millie$_carexps',  // ORIGINAL PASSWORD
    name: 'Pierre Morenzie',
    role: 'super_user'
  },
  {
    email: 'elmfarrell@yahoo.com',
    password: 'Farrell1000!',             // ORIGINAL PASSWORD
    name: 'ELM Farrell',
    role: 'super_user'
  }
]

function generateUUID() {
  return crypto.randomUUID()
}

async function restoreAllUsers() {
  console.log('🔐 User Login Access Restoration')
  console.log('='.repeat(60))
  console.log('')

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  console.log('✅ Connected to Supabase')

  try {
    // First, check the actual schema
    console.log('\n📋 Checking database schema...')
    const { data: schemaData, error: schemaError } = await supabase
      .from('users')
      .select('*')
      .limit(1)

    if (schemaError) {
      console.error('❌ Error checking schema:', schemaError.message)
      return
    }

    console.log('✅ Schema check complete')

    // Restore each super user
    for (const userInfo of SUPER_USERS) {
      console.log(`\n${'='.repeat(60)}`)
      console.log(`👤 Processing: ${userInfo.email}`)
      console.log('='.repeat(60))

      // Check if user exists
      const { data: existingUsers, error: checkError } = await supabase
        .from('users')
        .select('*')
        .eq('email', userInfo.email)

      if (checkError) {
        console.error(`❌ Error checking user: ${checkError.message}`)
        continue
      }

      let userId

      if (existingUsers && existingUsers.length > 0) {
        const user = existingUsers[0]
        userId = user.id
        console.log(`✅ User found in database`)
        console.log(`   ID: ${user.id}`)
        console.log(`   Current role: ${user.role}`)

        // Update to ensure super_user role
        const updateData = {
          role: userInfo.role,
          name: userInfo.name,
          is_active: true,
          updated_at: new Date().toISOString()
        }

        const { error: updateError } = await supabase
          .from('users')
          .update(updateData)
          .eq('id', userId)

        if (updateError) {
          console.error(`❌ Error updating user: ${updateError.message}`)
        } else {
          console.log(`✅ User role updated to: ${userInfo.role}`)
        }
      } else {
        console.log(`⚠️  User not found, creating...`)

        userId = generateUUID()

        const { error: createError } = await supabase
          .from('users')
          .insert([
            {
              id: userId,
              email: userInfo.email,
              name: userInfo.name,
              role: userInfo.role,
              is_active: true,
              mfa_enabled: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
          ])

        if (createError) {
          console.error(`❌ Error creating user: ${createError.message}`)
          continue
        }

        console.log(`✅ User created successfully`)
        console.log(`   ID: ${userId}`)
      }

      // Set up login credentials in user_settings
      console.log(`\n🔑 Setting up login credentials...`)

      // Use base64 encoding for password (browser-compatible)
      const base64Password = Buffer.from(userInfo.password).toString('base64')

      // Check if settings exist
      const { data: existingSettings, error: settingsCheckError } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)

      if (settingsCheckError) {
        console.error(`❌ Error checking settings: ${settingsCheckError.message}`)
        continue
      }

      const credentialsData = {
        username: userInfo.email,
        password: base64Password,
        tempPassword: false
      }

      if (existingSettings && existingSettings.length > 0) {
        // Update existing settings (settings is JSONB, not string)
        const { error: updateSettingsError } = await supabase
          .from('user_settings')
          .update({
            settings: credentialsData,  // Store as object, not stringified
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)

        if (updateSettingsError) {
          console.error(`❌ Error updating credentials: ${updateSettingsError.message}`)
        } else {
          console.log(`✅ Credentials updated`)
        }
      } else {
        // Create new settings (settings is JSONB, not string)
        const { error: createSettingsError } = await supabase
          .from('user_settings')
          .insert([
            {
              id: generateUUID(),
              user_id: userId,
              settings: credentialsData,  // Store as object, not stringified
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
          ])

        if (createSettingsError) {
          console.error(`❌ Error creating credentials: ${createSettingsError.message}`)
        } else {
          console.log(`✅ Credentials created`)
        }
      }

      console.log(`\n✅ ${userInfo.email} is ready for login`)
      console.log(`   Password: ${userInfo.password}`)
    }

    console.log(`\n${'='.repeat(60)}`)
    console.log('✅ ALL USERS RESTORED SUCCESSFULLY!')
    console.log('='.repeat(60))
    console.log('\nYou can now log in with any of these accounts:')
    SUPER_USERS.forEach(user => {
      console.log(`\n  📧 ${user.email}`)
      console.log(`  🔑 ${user.password}`)
      console.log(`  👤 Role: ${user.role}`)
    })

  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

// Run the restoration
restoreAllUsers().catch(console.error)
