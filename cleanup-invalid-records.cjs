/**
 * Cleanup Invalid Database Records
 */

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://cpkslvmydfdevdftieck.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwa3Nsdm15ZGZkZXZkZnRpZWNrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NjkwMDI5NSwiZXhwIjoyMDYyNDc2Mjk1fQ.5Nwr-DrgL63DwPMH2egxgdjoHGhAxCvIrz2SMTMKqD0'

async function cleanup() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  console.log('🧹 Cleaning Up Invalid Database Records\n')

  // Clean failed_login_attempts with invalid user_id
  console.log('📋 Checking failed_login_attempts table...')
  const { data: loginAttempts, error: loginError } = await supabase
    .from('failed_login_attempts')
    .select('*')

  if (!loginError && loginAttempts) {
    console.log(`   Found ${loginAttempts.length} failed login records`)

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const invalidRecords = loginAttempts.filter(r => r.user_id && !uuidRegex.test(r.user_id))

    if (invalidRecords.length > 0) {
      console.log(`   ⚠️  Found ${invalidRecords.length} records with invalid user_id`)

      for (const record of invalidRecords) {
        const { error: deleteError } = await supabase
          .from('failed_login_attempts')
          .delete()
          .eq('id', record.id)

        if (!deleteError) {
          console.log(`   ✅ Deleted record with user_id: ${record.user_id}`)
        }
      }
    } else {
      console.log('   ✅ All records have valid user_ids')
    }
  }

  // Clean old failed login attempts for Pierre
  console.log('\n📋 Cleaning old failed login attempts for pierre@phaetonai.com...')
  const { error: cleanError } = await supabase
    .from('failed_login_attempts')
    .delete()
    .eq('email', 'pierre@phaetonai.com')

  if (!cleanError) {
    console.log('   ✅ Cleaned up old login attempts')
  }

  console.log('\n✅ Cleanup complete!')
  console.log('\n💡 Try logging in again now.')
}

cleanup().catch(console.error)
