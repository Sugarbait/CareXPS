const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://cpkslvmydfdevdftieck.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error('No Supabase key found in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCredentials() {
  const userId = 'd500a835-5d22-476d-85bf-60acacb1acb3';
  const email = 'pierre@phaetonai.com';

  console.log('Checking credentials storage for pierre@phaetonai.com...\n');

  // 1. Check user_profiles for encrypted credentials
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('user_id, encrypted_retell_api_key')
    .eq('user_id', userId)
    .single();

  console.log('1. user_profiles.encrypted_retell_api_key:', profile ? 'EXISTS' : 'NULL');
  if (profileError) console.log('   Error:', profileError.message);
  if (profile?.encrypted_retell_api_key) {
    console.log('   Value length:', profile.encrypted_retell_api_key.length);
    console.log('   First 50 chars:', profile.encrypted_retell_api_key.substring(0, 50));
  }

  // 2. Check user_settings for password
  const { data: settings, error: settingsError } = await supabase
    .from('user_settings')
    .select('user_id, retell_api_key, retell_agent_id')
    .eq('user_id', userId)
    .single();

  console.log('\n2. user_settings:');
  if (settingsError) console.log('   Error:', settingsError.message);
  if (settings) {
    console.log('   retell_api_key:', settings.retell_api_key ? 'EXISTS' : 'NULL');
    console.log('   retell_agent_id:', settings.retell_agent_id ? 'EXISTS' : 'NULL');
  }

  // 3. Check users table
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, email, tenant_id')
    .eq('id', userId)
    .single();

  console.log('\n3. users table:');
  if (userError) console.log('   Error:', userError.message);
  if (user) {
    console.log('   User exists:', user.email);
    console.log('   Tenant ID:', user.tenant_id);
  }

  // 4. Check localStorage format
  console.log('\n4. Expected localStorage key format:');
  console.log('   userCredentials_' + userId);
}

checkCredentials().catch(console.error);
