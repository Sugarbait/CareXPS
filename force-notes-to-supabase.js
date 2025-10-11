/**
 * Force Notes to Save to Supabase
 * Run this in browser console to force-sync localStorage notes to Supabase
 */

// This script will sync all local notes to Supabase
console.log('🔄 Force-syncing localStorage notes to Supabase...');

(async function() {
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');

  const SUPABASE_URL = 'https://anifqpihbnuuciqxddqi.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFuaWZxcGloYm51dWNpcXhkZHFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5NjY4MzMsImV4cCI6MjA3NTU0MjgzM30.RxP5FlqaiWFxE9CIwsszcWtfJJ_IBi6QUatwx7VP52w';

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Find all localStorage notes
  const notesKeys = Object.keys(localStorage).filter(key => key.startsWith('notes_'));

  let synced = 0;
  let failed = 0;

  for (const key of notesKeys) {
    try {
      const notes = JSON.parse(localStorage.getItem(key));

      for (const note of notes) {
        // Only sync local notes (not already in Supabase)
        if (note.id.startsWith('local_')) {
          console.log(`📤 Syncing note: ${note.id}`);

          const { data, error } = await supabase
            .from('notes')
            .insert({
              reference_id: note.reference_id,
              reference_type: note.reference_type,
              content: note.content,
              content_type: note.content_type,
              created_by: note.created_by,
              created_by_name: note.created_by_name,
              created_by_email: note.created_by_email,
              metadata: note.metadata || {}
            })
            .select()
            .single();

          if (error) {
            console.log(`❌ Failed to sync ${note.id}:`, error.message);
            failed++;
          } else {
            console.log(`✅ Synced ${note.id} → ${data.id}`);
            synced++;
          }
        }
      }
    } catch (error) {
      console.log(`❌ Error processing ${key}:`, error.message);
    }
  }

  console.log('\n================================');
  console.log(`✅ Synced: ${synced} notes`);
  console.log(`❌ Failed: ${failed} notes`);
  console.log('================================\n');

  if (synced > 0) {
    console.log('🎉 Notes are now in Supabase and will sync across devices!');
    console.log('💡 Refresh the page to see them on this device.');
    console.log('📱 Open another device to verify cross-device sync.');
  }
})();
