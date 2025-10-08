/**
 * Verify Pierre Login
 * Quick test to verify the user can be found with correct tenant_id
 */

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://cpkslvmydfdevdftieck.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwa3Nsdm15ZGZkZXZkZnRpZWNrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NjkwMDI5NSwiZXhwIjoyMDYyNDc2Mjk1fQ.5Nwr-DrgL63DwPMH2egxgdjoHGhAxCvIrz2SMTMKqD0'

async function verifyLogin() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  console.log('🔍 Testing user query with tenant_id = carexps...\n')

  // This is the exact query the app uses
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('tenant_id', 'carexps')
    .eq('email', 'pierre@phaetonai.com')
    .eq('is_active', true)

  if (error) {
    console.error('❌ Query failed:', error.message)
    console.error('Full error:', error)
    return
  }

  if (!data || data.length === 0) {
    console.log('❌ User not found with tenant_id = carexps')
    console.log('\n🔍 Let me check all tenants...')

    const { data: allData } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'pierre@phaetonai.com')

    console.log('Found user with these tenant_ids:')
    allData?.forEach(user => {
      console.log(`  - ${user.tenant_id} (is_active: ${user.is_active})`)
    })
    return
  }

  console.log('✅ User found successfully!')
  console.log('\nUser Details:')
  console.log(`  ID: ${data[0].id}`)
  console.log(`  Email: ${data[0].email}`)
  console.log(`  Name: ${data[0].name}`)
  console.log(`  Role: ${data[0].role}`)
  console.log(`  Tenant: ${data[0].tenant_id}`)
  console.log(`  Active: ${data[0].is_active}`)
  console.log('\n🎉 Login should work now!')
}

verifyLogin().catch(console.error)
