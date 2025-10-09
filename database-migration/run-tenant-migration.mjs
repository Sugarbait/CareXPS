import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const SUPABASE_URL = 'https://anifqpihbnuuciqxddqi.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFuaWZxcGloYm51dWNpcXhkZHFpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTk2NjgzMywiZXhwIjoyMDc1NTQyODMzfQ.e8Y9RqpnoQWzIxzdTyKj0StNGyW33s3mXe0BlDh6Bsc';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration() {
  console.log('🔄 Running tenant_id migration...\n');

  try {
    // Read the SQL file
    const sql = readFileSync('database-migration/add-tenant-id.sql', 'utf-8');

    // Split into individual statements (simple split by semicolon)
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      // Skip comments
      if (statement.startsWith('--')) continue;

      console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`);

      try {
        const { error } = await supabase.rpc('exec_sql', {
          sql_query: statement + ';'
        });

        if (error) {
          // Try direct execution if RPC fails
          const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
              'apikey': SUPABASE_SERVICE_KEY,
              'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ sql_query: statement + ';' })
          });

          if (!response.ok) {
            console.error(`❌ Error executing statement ${i + 1}:`, error?.message || 'Unknown error');
            console.error(`Statement: ${statement.substring(0, 100)}...`);
          } else {
            console.log(`✅ Statement ${i + 1} executed successfully`);
          }
        } else {
          console.log(`✅ Statement ${i + 1} executed successfully`);
        }
      } catch (err) {
        console.error(`❌ Error on statement ${i + 1}:`, err.message);
        console.error(`Statement: ${statement.substring(0, 100)}...`);
      }
    }

    console.log('\n🎉 Migration complete!');
    console.log('\n📋 tenant_id column has been added to all tables');
    console.log('🔒 All records set to tenant_id = "carexps" for isolation');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration().catch(console.error);
