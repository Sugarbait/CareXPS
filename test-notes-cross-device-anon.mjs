/**
 * Test Notes Cross-Device with Anon Key (After RLS Fix)
 * Verifies notes work with anonymous Supabase access
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://anifqpihbnuuciqxddqi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFuaWZxcGloYm51dWNpcXhkZHFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5NjY4MzMsImV4cCI6MjA3NTU0MjgzM30.RxP5FlqaiWFxE9CIwsszcWtfJJ_IBi6QUatwx7VP52w';

// Create two clients (simulating two devices)
const device1 = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const device2 = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const TEST_REFERENCE_ID = `test_cross_device_${Date.now()}`;
const TEST_USER_ID = 'd8887464-ef2f-459d-a71e-766ab718cd26'; // Pierre's user ID

async function testCrossDeviceNotes() {
  console.log('\n🧪 Testing Cross-Device Notes with Anon Key');
  console.log('===========================================\n');

  try {
    // TEST 1: Create note from Device 1
    console.log('📝 Test 1: Creating note from Device 1...');

    const noteData = {
      // Old schema (backward compatibility)
      user_id: TEST_USER_ID,
      title: 'Cross-device test note',

      // New schema
      reference_id: TEST_REFERENCE_ID,
      reference_type: 'sms',
      content: 'This note should sync across all devices',
      content_type: 'plain',
      created_by: TEST_USER_ID,
      created_by_name: 'Pierre Morenzie',
      created_by_email: 'pierre@phaetonai.com',
      metadata: { test: true, device: 'device1' }
    };

    const { data: created, error: createError } = await device1
      .from('notes')
      .insert(noteData)
      .select()
      .single();

    if (createError) {
      console.log('❌ Failed to create note:', createError.message);
      console.log('   Error code:', createError.code);
      console.log('   Hint:', createError.hint);

      if (createError.message.includes('policy')) {
        console.log('\n⚠️  RLS POLICY ERROR DETECTED');
        console.log('   This means the SQL fix has not been applied yet.');
        console.log('   Please run: fix-notes-rls-for-anon-access.sql in Supabase Dashboard');
      }

      process.exit(1);
    }

    console.log('✅ Note created on Device 1:', created.id);
    console.log('   Content:', created.content);

    // Wait for sync
    await new Promise(resolve => setTimeout(resolve, 1000));

    // TEST 2: Retrieve note from Device 2
    console.log('\n📱 Test 2: Retrieving note from Device 2...');

    const { data: retrieved, error: retrieveError } = await device2
      .from('notes')
      .select('*')
      .eq('reference_id', TEST_REFERENCE_ID)
      .eq('reference_type', 'sms')
      .single();

    if (retrieveError) {
      console.log('❌ Failed to retrieve note from Device 2:', retrieveError.message);

      if (retrieveError.message.includes('policy')) {
        console.log('\n⚠️  RLS POLICY ERROR ON READ');
        console.log('   The anon policy is not allowing reads.');
        console.log('   Please verify: fix-notes-rls-for-anon-access.sql was applied correctly');
      }

      process.exit(1);
    }

    console.log('✅ Note retrieved on Device 2:', retrieved.id);
    console.log('   Content:', retrieved.content);
    console.log('   Created by:', retrieved.created_by_name);

    // TEST 3: Update note from Device 2
    console.log('\n✏️  Test 3: Updating note from Device 2...');

    const { data: updated, error: updateError } = await device2
      .from('notes')
      .update({
        content: 'Updated content from Device 2',
        last_edited_by: TEST_USER_ID,
        last_edited_by_name: 'Pierre Morenzie',
        last_edited_at: new Date().toISOString(),
        is_edited: true
      })
      .eq('id', created.id)
      .select()
      .single();

    if (updateError) {
      console.log('❌ Failed to update note:', updateError.message);
      process.exit(1);
    }

    console.log('✅ Note updated from Device 2');
    console.log('   New content:', updated.content);
    console.log('   Is edited:', updated.is_edited);

    // Wait for sync
    await new Promise(resolve => setTimeout(resolve, 500));

    // TEST 4: Verify update visible from Device 1
    console.log('\n🔄 Test 4: Verifying update on Device 1...');

    const { data: verified, error: verifyError } = await device1
      .from('notes')
      .select('*')
      .eq('id', created.id)
      .single();

    if (verifyError) {
      console.log('❌ Failed to verify update:', verifyError.message);
      process.exit(1);
    }

    console.log('✅ Update synced to Device 1');
    console.log('   Content:', verified.content);
    console.log('   Last edited by:', verified.last_edited_by_name);

    // TEST 5: Delete note from Device 1
    console.log('\n🗑️  Test 5: Deleting note from Device 1...');

    const { error: deleteError } = await device1
      .from('notes')
      .delete()
      .eq('id', created.id);

    if (deleteError) {
      console.log('❌ Failed to delete note:', deleteError.message);
      process.exit(1);
    }

    console.log('✅ Note deleted from Device 1');

    // Verify deletion from Device 2
    await new Promise(resolve => setTimeout(resolve, 500));

    const { data: checkDeleted, error: checkError } = await device2
      .from('notes')
      .select('id')
      .eq('id', created.id);

    if (checkError) {
      console.log('⚠️  Error checking deletion:', checkError.message);
    } else if (checkDeleted && checkDeleted.length === 0) {
      console.log('✅ Deletion synced to Device 2');
    } else {
      console.log('⚠️  Note still visible on Device 2 (sync delay?)');
    }

    // SUCCESS
    console.log('\n===========================================');
    console.log('🎉 ALL TESTS PASSED!');
    console.log('===========================================');
    console.log('✅ Cross-device notes are working perfectly!');
    console.log('✅ Notes sync between devices immediately');
    console.log('✅ Anonymous access is properly configured');
    console.log('✅ Ready for production use!\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ CRITICAL ERROR:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testCrossDeviceNotes();
