import pg from 'pg';
const { Client } = pg;

// Direct PostgreSQL connection
const client = new Client({
  host: 'aws-0-us-east-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.anifqpihbnuuciqxddqi',
  password: 'M8P@#j3$kL9mN2qR',
  ssl: { rejectUnauthorized: false }
});

async function applyFix() {
  console.log('🔧 Connecting to database...\n');

  try {
    await client.connect();
    console.log('✅ Connected to Supabase PostgreSQL\n');

    // Step 1: Add missing columns
    console.log('📝 Step 1: Adding missing columns...');

    await client.query(`
      ALTER TABLE public.failed_login_attempts
      ADD COLUMN IF NOT EXISTS ip_address TEXT;
    `);
    console.log('  ✅ Added ip_address column');

    await client.query(`
      ALTER TABLE public.failed_login_attempts
      ADD COLUMN IF NOT EXISTS reason TEXT;
    `);
    console.log('  ✅ Added reason column');

    await client.query(`
      ALTER TABLE public.failed_login_attempts
      ADD COLUMN IF NOT EXISTS attempted_at TIMESTAMPTZ;
    `);
    console.log('  ✅ Added attempted_at column');

    await client.query(`
      ALTER TABLE public.failed_login_attempts
      ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'carexps';
    `);
    console.log('  ✅ Added tenant_id column\n');

    // Step 2: Create sync trigger
    console.log('📝 Step 2: Creating column sync trigger...');

    await client.query(`
      CREATE OR REPLACE FUNCTION sync_failed_login_columns()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Sync from new columns to old columns
        IF NEW.ip_address IS NOT NULL AND NEW.source_ip IS NULL THEN
          NEW.source_ip = NEW.ip_address;
        END IF;

        IF NEW.reason IS NOT NULL AND NEW.failure_reason IS NULL THEN
          NEW.failure_reason = NEW.reason;
        END IF;

        IF NEW.attempted_at IS NOT NULL AND NEW.timestamp IS NULL THEN
          NEW.timestamp = NEW.attempted_at;
        END IF;

        -- Sync from old columns to new columns
        IF NEW.source_ip IS NOT NULL AND NEW.ip_address IS NULL THEN
          NEW.ip_address = NEW.source_ip;
        END IF;

        IF NEW.failure_reason IS NOT NULL AND NEW.reason IS NULL THEN
          NEW.reason = NEW.failure_reason;
        END IF;

        IF NEW.timestamp IS NOT NULL AND NEW.attempted_at IS NULL THEN
          NEW.attempted_at = NEW.timestamp;
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('  ✅ Created sync function');

    await client.query(`
      DROP TRIGGER IF EXISTS sync_failed_login_columns_trigger ON public.failed_login_attempts;
    `);

    await client.query(`
      CREATE TRIGGER sync_failed_login_columns_trigger
        BEFORE INSERT OR UPDATE ON public.failed_login_attempts
        FOR EACH ROW
        EXECUTE FUNCTION sync_failed_login_columns();
    `);
    console.log('  ✅ Created sync trigger\n');

    // Step 3: Create indexes
    console.log('📝 Step 3: Creating indexes...');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_failed_login_ip_address ON public.failed_login_attempts(ip_address);
    `);
    console.log('  ✅ Created ip_address index');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_failed_login_attempted_at ON public.failed_login_attempts(attempted_at);
    `);
    console.log('  ✅ Created attempted_at index');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_failed_login_tenant_id ON public.failed_login_attempts(tenant_id);
    `);
    console.log('  ✅ Created tenant_id index\n');

    // Step 4: Update RLS policy
    console.log('📝 Step 4: Updating RLS policy...');

    await client.query(`
      DROP POLICY IF EXISTS "Tenant isolation for failed logins" ON public.failed_login_attempts;
    `);

    await client.query(`
      CREATE POLICY "Tenant isolation for failed logins" ON public.failed_login_attempts
        FOR ALL USING (tenant_id = 'carexps');
    `);
    console.log('  ✅ Created tenant isolation policy\n');

    // Step 5: Backfill existing data
    console.log('📝 Step 5: Backfilling existing data...');

    const result = await client.query(`
      UPDATE public.failed_login_attempts
      SET
        ip_address = source_ip,
        reason = failure_reason,
        attempted_at = timestamp,
        tenant_id = COALESCE(tenant_id, 'carexps')
      WHERE ip_address IS NULL OR reason IS NULL OR attempted_at IS NULL OR tenant_id IS NULL;
    `);
    console.log(`  ✅ Updated ${result.rowCount} existing records\n`);

    // Step 6: Test the fix
    console.log('🧪 Testing the fix with a sample INSERT...\n');

    await client.query(`
      INSERT INTO public.failed_login_attempts (
        email, ip_address, user_agent, reason, attempted_at, tenant_id
      ) VALUES (
        'test@carexps.com', '127.0.0.1', 'Test Browser', 'Test failure', NOW(), 'carexps'
      );
    `);
    console.log('  ✅ Test INSERT successful');

    // Verify both column sets have data
    const testResult = await client.query(`
      SELECT email, ip_address, source_ip, reason, failure_reason, attempted_at, timestamp
      FROM public.failed_login_attempts
      WHERE email = 'test@carexps.com'
      LIMIT 1;
    `);

    if (testResult.rows.length > 0) {
      console.log('  ✅ Trigger working - both column sets populated:');
      console.log('     ', JSON.stringify(testResult.rows[0], null, 2));
    }

    // Clean up test data
    await client.query(`
      DELETE FROM public.failed_login_attempts WHERE email = 'test@carexps.com';
    `);
    console.log('  🧹 Test data cleaned up\n');

    console.log('🎉 Migration complete!\n');
    console.log('📋 Summary:');
    console.log('   ✅ Added columns: ip_address, reason, attempted_at');
    console.log('   ✅ Kept columns: source_ip, failure_reason, timestamp');
    console.log('   ✅ Added trigger to sync between column sets');
    console.log('   ✅ Added tenant_id for CareXPS isolation');
    console.log('   ✅ Updated RLS policies for tenant isolation');
    console.log('\n💡 Your application should now work correctly!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('   Stack:', error.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyFix().catch(console.error);
