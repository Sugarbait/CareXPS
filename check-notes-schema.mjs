/**
 * Check Notes Table Schema
 * Verifies if user_id is nullable
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://anifqpihbnuuciqxddqi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFuaWZxcGloYm51dWNpcXhkZHFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5NjY4MzMsImV4cCI6MjA3NTU0MjgzM30.RxP5FlqaiWFxE9CIwsszcWtfJJ_IBi6QUatwx7VP52w';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkSchema() {
  console.log('\n🔍 Testing Notes Insert Without user_id\n');

  // Try to insert a note WITHOUT user_id (exactly as app does)
  const testNote = {
    reference_id: 'test_schema_check_' + Date.now(),
    reference_type: 'sms',
    content: 'Schema check test',
    content_type: 'plain',
    created_by: 'd8887464-ef2f-459d-a71e-766ab718cd26',
    created_by_name: 'Pierre Morenzie',
    metadata: {}
  };

  console.log('Attempting insert WITHOUT user_id or title...\n');

  const { data, error } = await supabase
    .from('notes')
    .insert(testNote)
    .select()
    .single();

  if (error) {
    console.log('❌ INSERT FAILED:', error.message);
    console.log('');

    if (error.message.includes('user_id') || error.message.includes('violates not-null constraint')) {
      console.log('⚠️  PROBLEM: user_id is still required (NOT NULL)');
      console.log('');
      console.log('The SQL fix was NOT applied or did not work.');
      console.log('');
      console.log('Please run this SQL in Supabase Dashboard:');
      console.log('');
      console.log('  ALTER TABLE notes ALTER COLUMN user_id DROP NOT NULL;');
      console.log('  ALTER TABLE notes ALTER COLUMN title DROP NOT NULL;');
      console.log('');
    } else {
      console.log('Error code:', error.code);
      console.log('Error details:', error.details);
    }

    process.exit(1);
  } else {
    console.log('✅ INSERT SUCCESS!');
    console.log('   Note ID:', data.id);
    console.log('   Content:', data.content);
    console.log('');
    console.log('🎉 Schema is correct - user_id is nullable');
    console.log('✅ Notes should now save to Supabase from the app');
    console.log('');

    // Cleanup
    await supabase.from('notes').delete().eq('id', data.id);
    console.log('✅ Test note cleaned up\n');
  }
}

checkSchema();
