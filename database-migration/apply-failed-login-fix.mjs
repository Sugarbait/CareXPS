import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://anifqpihbnuuciqxddqi.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFuaWZxcGloYm51dWNpcXhkZHFpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTk2NjgzMywiZXhwIjoyMDc1NTQyODMzfQ.e8Y9RqpnoQWzIxzdTyKj0StNGyW33s3mXe0BlDh6Bsc';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function applyFix() {
  console.log('🔧 Applying failed_login_attempts schema fix...\n');

  // Add columns
  console.log('⏳ Adding ip_address column...');
  await supabase.rpc('exec_sql', { sql_query: 'ALTER TABLE public.failed_login_attempts ADD COLUMN IF NOT EXISTS ip_address TEXT;' });
  console.log('✅ Done');

  console.log('⏳ Adding reason column...');
  await supabase.rpc('exec_sql', { sql_query: 'ALTER TABLE public.failed_login_attempts ADD COLUMN IF NOT EXISTS reason TEXT;' });
  console.log('✅ Done');

  console.log('⏳ Adding attempted_at column...');
  await supabase.rpc('exec_sql', { sql_query: 'ALTER TABLE public.failed_login_attempts ADD COLUMN IF NOT EXISTS attempted_at TIMESTAMPTZ;' });
  console.log('✅ Done');

  // Test the fix
  console.log('\n🧪 Testing...');
  const { error } = await supabase
    .from('failed_login_attempts')
    .insert({
      email: 'test@carexps.com',
      ip_address: '127.0.0.1',
      reason: 'Test',
      attempted_at: new Date().toISOString()
    });

  if (error) {
    console.error('❌ Test failed:', error.message);
  } else {
    console.log('✅ Test passed!');
    await supabase.from('failed_login_attempts').delete().eq('email', 'test@carexps.com');
  }

  console.log('\n🎉 Fix applied successfully!');
}

applyFix().catch(console.error);
