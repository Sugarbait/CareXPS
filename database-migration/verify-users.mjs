import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://anifqpihbnuuciqxddqi.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFuaWZxcGloYm51dWNpcXhkZHFpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTk2NjgzMywiZXhwIjoyMDc1NTQyODMzfQ.e8Y9RqpnoQWzIxzdTyKj0StNGyW33s3mXe0BlDh6Bsc';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function verifyUsers() {
  console.log('🔍 Verifying users in new CareXPS database...\n');

  const { data: users, error } = await supabase
    .from('users')
    .select('id, email, name, role, is_active, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error fetching users:', error.message);
    return;
  }

  console.log(`✅ Found ${users.length} users:\n`);
  users.forEach(user => {
    console.log(`📧 Email: ${user.email}`);
    console.log(`👤 Name: ${user.name}`);
    console.log(`🔑 Role: ${user.role}`);
    console.log(`✓ Active: ${user.is_active}`);
    console.log(`🆔 ID: ${user.id}`);
    console.log(`📅 Created: ${new Date(user.created_at).toLocaleString()}`);
    console.log('─'.repeat(60));
  });
}

verifyUsers().catch(console.error);
