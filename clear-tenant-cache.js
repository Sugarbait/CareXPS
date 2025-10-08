/**
 * Browser Console Script to Clear Tenant Isolation Cache Issues
 *
 * INSTRUCTIONS FOR USER:
 * 1. Open browser DevTools (F12)
 * 2. Go to Console tab
 * 3. Copy and paste this ENTIRE script
 * 4. Press Enter to run it
 * 5. Hard refresh the page (Ctrl+Shift+R)
 */

console.log('🧹 === TENANT CACHE CLEANUP STARTING ===\n')

// Step 1: Clear ALL old localStorage keys that might have contaminated data
const keysToRemove = []

// Find all keys in localStorage
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i)
  if (key) {
    // Remove old global keys
    if (key === 'systemUsers' || key === 'currentUser') {
      keysToRemove.push(key)
      console.log(`🗑️  Removing old global key: "${key}"`)
    }

    // Remove old settings keys (non-tenant-specific)
    if (key.startsWith('settings_') && !key.includes('_artlee') && !key.includes('_medex') && !key.includes('_carexps')) {
      keysToRemove.push(key)
      console.log(`🗑️  Removing old settings key: "${key}"`)
    }

    // Remove old credentials keys (non-tenant-specific)
    if (key.startsWith('userCredentials_') && !key.includes('_artlee') && !key.includes('_medex') && !key.includes('_carexps')) {
      keysToRemove.push(key)
      console.log(`🗑️  Removing old credentials key: "${key}"`)
    }

    // Remove cached system users with wrong tenant ID
    if (key.startsWith('systemUsers_') || key.includes('cached_users')) {
      console.log(`🔍 Checking cached users key: "${key}"`)
      try {
        const data = localStorage.getItem(key)
        if (data) {
          const parsed = JSON.parse(data)
          if (Array.isArray(parsed)) {
            console.log(`   Contains ${parsed.length} users`)
            // We'll remove ALL cached user lists and force fresh load from Supabase
            keysToRemove.push(key)
            console.log(`🗑️  Removing cached users key: "${key}"`)
          }
        }
      } catch (e) {
        console.log(`   (Failed to parse, removing anyway)`)
        keysToRemove.push(key)
      }
    }
  }
}

// Remove all identified keys
keysToRemove.forEach(key => {
  localStorage.removeItem(key)
  console.log(`✅ Removed: "${key}"`)
})

console.log(`\n🧹 Removed ${keysToRemove.length} contaminated keys\n`)

// Step 2: Show what's left in localStorage
console.log('📋 Remaining localStorage keys after cleanup:')
const remainingKeys = []
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i)
  if (key) {
    remainingKeys.push(key)
  }
}

if (remainingKeys.length === 0) {
  console.log('   (localStorage is now empty)')
} else {
  remainingKeys.forEach((key, index) => {
    console.log(`   ${index + 1}. "${key}"`)
  })
}

console.log('\n✅ === CLEANUP COMPLETE ===')
console.log('\n📋 NEXT STEPS:')
console.log('1. Hard refresh this page (Ctrl+Shift+R or Cmd+Shift+R)')
console.log('2. Hard refresh ALL other browser tabs with ARTLEE/MedEx/CareXPS')
console.log('3. Test creating a new user in ARTLEE')
console.log('4. Verify it does NOT appear in CareXPS User Management\n')
