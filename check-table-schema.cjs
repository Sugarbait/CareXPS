const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log('Checking database schema...\n');

  // Get user_profiles columns
  const { data: profiles, error: profileError } = await supabase
    .from('user_profiles')
    .select('*')
    .limit(1);

  console.log('1. user_profiles columns:');
  if (profileError) {
    console.log('   Error:', profileError.message);
  } else if (profiles && profiles.length > 0) {
    console.log('   ', Object.keys(profiles[0]).join(', '));
  }

  // Get user_settings columns
  const { data: settings, error: settingsError } = await supabase
    .from('user_settings')
    .select('*')
    .limit(1);

  console.log('\n2. user_settings columns:');
  if (settingsError) {
    console.log('   Error:', settingsError.message);
  } else if (settings && settings.length > 0) {
    console.log('   ', Object.keys(settings[0]).join(', '));
  }

  // Check for pierre's user_settings specifically
  const userId = 'd500a835-5d22-476d-85bf-60acacb1acb3';
  const { data: pierreSettings, error: pierreError } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .single();

  console.log('\n3. Pierre\'s user_settings data:');
  if (pierreError) {
    console.log('   Error:', pierreError.message);
  } else if (pierreSettings) {
    console.log('   Keys:', Object.keys(pierreSettings).join(', '));
    // Show all values except sensitive data
    for (const [key, value] of Object.entries(pierreSettings)) {
      if (key.includes('password') || key.includes('secret') || key.includes('key')) {
        console.log(`   ${key}: [HIDDEN - length: ${value?.length || 0}]`);
      } else {
        console.log(`   ${key}:`, value);
      }
    }
  }
}

checkSchema().catch(console.error);
