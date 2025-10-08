const fs = require('fs');
const path = require('path');

const FILES = [
  'src/pages/UserManagementPage.tsx',
  'src/components/settings/EnhancedProfileSettings.tsx',
  'src/utils/clearUserCache.ts',
  'src/utils/correctSuperUserRoles.ts',
  'src/utils/fixUserIssues.ts',
  'src/utils/fixUserRolePersistence.ts',
  'src/utils/profilePersistenceDebug.ts',
  'src/utils/runGuestCleanup.ts',
  'src/utils/testUserCleanup.ts',
  'src/test/profileFieldsPersistence.test.ts',
  'src/test/profileSyncTest.ts',
];

const TENANT_IMPORT = "import { TENANT_ID } from '@/config/tenantConfig'";

function fixFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const original = content;

    // Check if already has TENANT_ID import
    if (!content.includes('TENANT_ID')) {
      // Add import at the beginning
      const importMatch = content.match(/^import\s+/m);
      if (importMatch) {
        content = content.substring(0, importMatch.index) + TENANT_IMPORT + '\n' + content.substring(importMatch.index);
      }
    }

    // Replace all occurrences
    content = content.replace(/localStorage\.getItem\('systemUsers'\)/g, "localStorage.getItem(`systemUsers_${TENANT_ID}`)");
    content = content.replace(/localStorage\.setItem\('systemUsers',/g, "localStorage.setItem(`systemUsers_${TENANT_ID}`,");
    content = content.replace(/localStorage\.removeItem\('systemUsers'\)/g, "localStorage.removeItem(`systemUsers_${TENANT_ID}`)");

    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✓ Fixed: ${filePath}`);
      return true;
    } else {
      console.log(`- Skipped (no changes): ${filePath}`);
      return false;
    }
  } catch (err) {
    console.error(`✗ Error fixing ${filePath}:`, err.message);
    return false;
  }
}

console.log('='.repeat(60));
console.log('TENANT ISOLATION FIX - CareXPS');
console.log('='.repeat(60));

let fixed = 0;
let errors = 0;

FILES.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    if (fixFile(filePath)) fixed++;
  } else {
    console.log(`✗ Not found: ${file}`);
    errors++;
  }
});

console.log('='.repeat(60));
console.log(`Fixed: ${fixed} | Errors: ${errors}`);
console.log('='.repeat(60));
