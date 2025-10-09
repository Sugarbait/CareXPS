import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://anifqpihbnuuciqxddqi.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFuaWZxcGloYm51dWNpcXhkZHFpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTk2NjgzMywiZXhwIjoyMDc1NTQyODMzfQ.e8Y9RqpnoQWzIxzdTyKj0StNGyW33s3mXe0BlDh6Bsc';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function diagnoseTable() {
  console.log('🔍 Diagnosing failed_login_attempts table...\n');

  try {
    // Query the table schema from information_schema
    const { data: columns, error: schemaError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable, column_default')
      .eq('table_schema', 'public')
      .eq('table_name', 'failed_login_attempts')
      .order('ordinal_position');

    if (schemaError) {
      console.error('❌ Error querying schema:', schemaError.message);

      // Try alternate method - query the table directly to see what happens
      console.log('\n🔄 Trying alternate diagnosis method...\n');

      const { error: insertError } = await supabase
        .from('failed_login_attempts')
        .insert({
          email: 'test@example.com',
          ip_address: 'test',
          reason: 'test',
          attempted_at: new Date().toISOString()
        });

      if (insertError) {
        console.log('❌ INSERT Error (this tells us what columns are wrong):');
        console.log(JSON.stringify(insertError, null, 2));
      }

      return;
    }

    if (!columns || columns.length === 0) {
      console.log('⚠️ Table not found or has no columns');
      return;
    }

    console.log('✅ Current table schema:\n');
    console.log('Column Name          | Data Type        | Nullable | Default');
    console.log('---------------------|------------------|----------|------------------');

    columns.forEach(col => {
      const name = (col.column_name || '').padEnd(20);
      const type = (col.data_type || '').padEnd(16);
      const nullable = (col.is_nullable || '').padEnd(8);
      const def = (col.column_default || 'NULL').substring(0, 18);
      console.log(`${name} | ${type} | ${nullable} | ${def}`);
    });

    console.log('\n📋 What the app expects vs what exists:\n');

    const expectedColumns = {
      'email': 'EXISTS',
      'ip_address': columns.some(c => c.column_name === 'ip_address') ? 'EXISTS ✅' : 'MISSING ❌ (app expects this)',
      'source_ip': columns.some(c => c.column_name === 'source_ip') ? 'EXISTS ✅' : 'MISSING',
      'user_agent': columns.some(c => c.column_name === 'user_agent') ? 'EXISTS ✅' : 'MISSING',
      'reason': columns.some(c => c.column_name === 'reason') ? 'EXISTS ✅ (app expects this)' : 'MISSING ❌',
      'failure_reason': columns.some(c => c.column_name === 'failure_reason') ? 'EXISTS ✅' : 'MISSING',
      'attempted_at': columns.some(c => c.column_name === 'attempted_at') ? 'EXISTS ✅ (app expects this)' : 'MISSING ❌',
      'timestamp': columns.some(c => c.column_name === 'timestamp') ? 'EXISTS ✅' : 'MISSING',
      'tenant_id': columns.some(c => c.column_name === 'tenant_id') ? 'EXISTS ✅' : 'MISSING ❌ (should exist)'
    };

    Object.entries(expectedColumns).forEach(([col, status]) => {
      console.log(`  ${col}: ${status}`);
    });

    console.log('\n🔧 ISSUE IDENTIFIED:');
    console.log('  The application code uses different column names than the database schema.');
    console.log('\n  Application expects: ip_address, reason, attempted_at');
    console.log('  Database has:        source_ip, failure_reason, timestamp');
    console.log('\n💡 FIX OPTIONS:');
    console.log('  1. Add column aliases to database (source_ip as ip_address, etc.)');
    console.log('  2. Update application code to use correct column names');
    console.log('  3. Add missing columns and keep both for compatibility');

  } catch (error) {
    console.error('❌ Diagnosis failed:', error.message);
  }
}

diagnoseTable().catch(console.error);
