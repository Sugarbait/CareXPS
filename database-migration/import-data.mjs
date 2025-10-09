// ============================================================================
// CareXPS Database Migration - Data Import Script
// ============================================================================
// Purpose: Import data from JSON export to new Supabase database
// Usage: node database-migration/import-data.mjs
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ============================================================================
// CONFIGURATION
// ============================================================================

const NEW_SUPABASE_URL = 'https://anifqpihbnuuciqxddqi.supabase.co';
const NEW_SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFuaWZxcGloYm51dWNpcXhkZHFpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTk2NjgzMywiZXhwIjoyMDc1NTQyODMzfQ.e8Y9RqpnoQWzIxzdTyKj0StNGyW33s3mXe0BlDh6Bsc';

// Path to your data export JSON file
const DATA_EXPORT_FILE = './database-migration/carexps-data-export.json';

// ============================================================================
// SUPABASE CLIENT
// ============================================================================

const supabase = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const emoji = {
    info: 'ℹ️',
    success: '✅',
    error: '❌',
    warning: '⚠️',
    progress: '⏳'
  }[level] || 'ℹ️';

  console.log(`[${timestamp}] ${emoji} ${message}`);
}

async function importTable(tableName, data, batchSize = 100) {
  if (!data || data.length === 0) {
    log(`No data to import for ${tableName}`, 'warning');
    return { imported: 0, errors: 0 };
  }

  log(`Starting import of ${data.length} records to ${tableName}`, 'progress');

  let imported = 0;
  let errors = 0;

  // Import in batches to avoid timeout
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);

    try {
      const { error } = await supabase
        .from(tableName)
        .insert(batch);

      if (error) {
        log(`Error importing batch ${i / batchSize + 1} to ${tableName}: ${error.message}`, 'error');
        errors += batch.length;
      } else {
        imported += batch.length;
        log(`Imported batch ${i / batchSize + 1}/${Math.ceil(data.length / batchSize)} (${imported}/${data.length} records)`, 'progress');
      }
    } catch (err) {
      log(`Exception importing batch to ${tableName}: ${err.message}`, 'error');
      errors += batch.length;
    }
  }

  if (imported > 0) {
    log(`Successfully imported ${imported} records to ${tableName}`, 'success');
  }

  if (errors > 0) {
    log(`Failed to import ${errors} records to ${tableName}`, 'error');
  }

  return { imported, errors };
}

// ============================================================================
// MAIN IMPORT FUNCTION
// ============================================================================

async function main() {
  log('='.repeat(80), 'info');
  log('CareXPS Database Migration - Data Import', 'info');
  log('='.repeat(80), 'info');

  // Read export data
  let exportData;
  try {
    const dataPath = resolve(DATA_EXPORT_FILE);
    log(`Reading export data from: ${dataPath}`, 'info');
    const fileContent = readFileSync(dataPath, 'utf-8');
    exportData = JSON.parse(fileContent);
    log(`Export file loaded successfully`, 'success');
  } catch (err) {
    log(`Failed to read export file: ${err.message}`, 'error');
    log(`Please ensure ${DATA_EXPORT_FILE} exists and contains valid JSON`, 'error');
    process.exit(1);
  }

  // Test connection
  try {
    log('Testing connection to new database...', 'progress');
    const { data, error } = await supabase.from('users').select('count');
    if (error) throw error;
    log('Connection successful!', 'success');
  } catch (err) {
    log(`Failed to connect to database: ${err.message}`, 'error');
    log('Please verify Supabase URL and Service Role Key', 'error');
    process.exit(1);
  }

  // Import statistics
  const stats = {
    totalImported: 0,
    totalErrors: 0,
    tables: {}
  };

  // Import order (respecting foreign key constraints)
  const importOrder = [
    { name: 'users', data: exportData.users },
    { name: 'user_settings', data: exportData.settings },
    { name: 'user_profiles', data: exportData.profiles },
    { name: 'user_mfa_configs', data: exportData.mfaConfigs },
    { name: 'mfa_challenges', data: exportData.mfaChallenges },
    { name: 'audit_logs', data: exportData.auditLogs },
    { name: 'failed_login_attempts', data: exportData.failedLogins },
    { name: 'notes', data: exportData.notes },
    { name: 'system_credentials', data: exportData.credentials }
  ];

  log('Starting data import...', 'info');
  log('-'.repeat(80), 'info');

  for (const table of importOrder) {
    if (table.data) {
      const result = await importTable(table.name, table.data);
      stats.tables[table.name] = result;
      stats.totalImported += result.imported;
      stats.totalErrors += result.errors;
      log('-'.repeat(80), 'info');
    }
  }

  // Print summary
  log('='.repeat(80), 'info');
  log('IMPORT COMPLETE - Summary:', 'info');
  log('='.repeat(80), 'info');
  log(`Total Records Imported: ${stats.totalImported}`, 'success');
  log(`Total Errors: ${stats.totalErrors}`, stats.totalErrors > 0 ? 'error' : 'success');
  log('', 'info');
  log('Details by Table:', 'info');

  for (const [tableName, result] of Object.entries(stats.tables)) {
    if (result.imported > 0 || result.errors > 0) {
      log(`  ${tableName}: ${result.imported} imported, ${result.errors} errors`, 'info');
    }
  }

  log('='.repeat(80), 'info');

  if (stats.totalErrors > 0) {
    log('⚠️  Some records failed to import. Please check error messages above.', 'warning');
    process.exit(1);
  } else {
    log('✅ Migration completed successfully!', 'success');
    log('', 'info');
    log('Next steps:', 'info');
    log('1. Verify data integrity in Supabase Dashboard', 'info');
    log('2. Update environment variables (.env.local)', 'info');
    log('3. Test application locally', 'info');
    log('4. Deploy to production', 'info');
  }
}

// ============================================================================
// RUN
// ============================================================================

main().catch(err => {
  log(`Fatal error: ${err.message}`, 'error');
  console.error(err);
  process.exit(1);
});
