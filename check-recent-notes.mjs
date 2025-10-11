/**
 * Check Recent Notes in Database
 * Shows all notes created in the last 10 minutes
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://anifqpihbnuuciqxddqi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFuaWZxcGloYm51dWNpcXhkZHFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5NjY4MzMsImV4cCI6MjA3NTU0MjgzM30.RxP5FlqaiWFxE9CIwsszcWtfJJ_IBi6QUatwx7VP52w';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkRecentNotes() {
  console.log('\n🔍 Checking Recent Notes in Database');
  console.log('===================================\n');

  try {
    // Get all notes created in last 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const { data: recentNotes, error } = await supabase
      .from('notes')
      .select('*')
      .gte('created_at', tenMinutesAgo)
      .order('created_at', { ascending: false });

    if (error) {
      console.log('❌ Error querying notes:', error.message);
      process.exit(1);
    }

    if (!recentNotes || recentNotes.length === 0) {
      console.log('📭 No notes found in the last 10 minutes');
      console.log('');
      console.log('This means:');
      console.log('  - Either no notes were created recently');
      console.log('  - OR notes are being saved to localStorage only');
      console.log('  - OR notes are being filtered by a different criteria');
      console.log('');
      process.exit(0);
    }

    console.log(`📝 Found ${recentNotes.length} recent note(s):\n`);

    recentNotes.forEach((note, index) => {
      console.log(`Note #${index + 1}:`);
      console.log(`  ID: ${note.id}`);
      console.log(`  Reference: ${note.reference_type} - ${note.reference_id}`);
      console.log(`  Content: "${note.content}"`);
      console.log(`  Created by: ${note.created_by_name} (${note.created_by})`);
      console.log(`  Created at: ${new Date(note.created_at).toLocaleString()}`);
      console.log(`  Updated at: ${new Date(note.updated_at).toLocaleString()}`);

      if (note.is_edited) {
        console.log(`  ✏️  Edited by: ${note.last_edited_by_name}`);
        console.log(`  Edited at: ${new Date(note.last_edited_at).toLocaleString()}`);
      }

      console.log('');
    });

    console.log('===================================');
    console.log('✅ Query successful\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkRecentNotes();
