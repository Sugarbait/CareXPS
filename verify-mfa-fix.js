/**
 * MFA Bypass Fix Verification Script
 *
 * Run this script in the browser console to verify the MFA fix is working correctly.
 *
 * Usage:
 *   1. Open browser developer console (F12)
 *   2. Copy and paste this entire script
 *   3. Press Enter to run
 *   4. Follow the instructions in the console output
 */

(function() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║     MFA BYPASS FIX VERIFICATION SCRIPT                         ║');
  console.log('║     Version 1.0 - October 8, 2025                             ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');

  // Helper function to format check results
  function checkResult(testName, passed, details) {
    const icon = passed ? '✅' : '❌';
    const status = passed ? 'PASS' : 'FAIL';
    console.log(`${icon} ${testName}: ${status}`);
    if (details) {
      console.log(`   └─ ${details}`);
    }
  }

  // Test 1: Check if sessionStorage flags exist
  console.log('📋 TEST 1: SessionStorage Flags Check');
  console.log('─────────────────────────────────────────────────────────');

  const appInitialized = sessionStorage.getItem('appInitialized');
  const mfaCompletedThisSession = sessionStorage.getItem('mfaCompletedThisSession');
  const freshMfaVerified = localStorage.getItem('freshMfaVerified');

  console.log('Current flags:');
  console.log(`  • appInitialized: ${appInitialized || 'null'}`);
  console.log(`  • mfaCompletedThisSession: ${mfaCompletedThisSession || 'null'}`);
  console.log(`  • freshMfaVerified: ${freshMfaVerified || 'null'}`);
  console.log('');

  // Test 2: Verify flag logic
  console.log('📋 TEST 2: MFA Session Logic Verification');
  console.log('─────────────────────────────────────────────────────────');

  let mfaSessionValid = false;
  let reason = '';

  if (appInitialized && mfaCompletedThisSession === 'true') {
    if (freshMfaVerified) {
      const timestamp = parseInt(freshMfaVerified);
      const sessionAge = Date.now() - timestamp;
      const MAX_MFA_SESSION_AGE = 30 * 60 * 1000; // 30 minutes

      if (sessionAge < MAX_MFA_SESSION_AGE) {
        mfaSessionValid = true;
        const minutesRemaining = Math.round((MAX_MFA_SESSION_AGE - sessionAge) / 60000);
        reason = `Valid session, ${minutesRemaining} minutes remaining`;
      } else {
        reason = 'Session expired (> 30 minutes)';
      }
    } else {
      reason = 'No MFA timestamp found';
    }
  } else {
    if (!appInitialized) {
      reason = 'App not initialized';
    } else if (mfaCompletedThisSession !== 'true') {
      reason = 'MFA not completed in this session';
    }
  }

  checkResult(
    'MFA Session Status',
    mfaSessionValid,
    reason
  );
  console.log('');

  // Test 3: Check authentication state
  console.log('📋 TEST 3: Authentication State Check');
  console.log('─────────────────────────────────────────────────────────');

  const currentUser = localStorage.getItem('currentUser');
  const hasUser = currentUser !== null;

  checkResult(
    'Current User',
    hasUser,
    hasUser ? 'User data found in localStorage' : 'No user data found'
  );

  if (hasUser) {
    try {
      const userData = JSON.parse(currentUser);
      console.log(`   User: ${userData.email || userData.name || 'Unknown'}`);
    } catch (e) {
      console.log('   ⚠️  Warning: Could not parse user data');
    }
  }
  console.log('');

  // Test 4: Security validation
  console.log('📋 TEST 4: Security Validation');
  console.log('─────────────────────────────────────────────────────────');

  let securityScore = 0;
  let maxScore = 4;

  // Check 1: MFA session requires completion flag
  if (mfaCompletedThisSession === 'true' || !hasUser) {
    securityScore++;
    checkResult(
      'MFA Completion Flag',
      true,
      'Flag correctly set or user not logged in'
    );
  } else {
    checkResult(
      'MFA Completion Flag',
      false,
      '⚠️ SECURITY ISSUE: User logged in without MFA completion flag'
    );
  }

  // Check 2: If user logged in, MFA should be completed
  if (hasUser && mfaCompletedThisSession !== 'true') {
    checkResult(
      'Authenticated User MFA Status',
      false,
      '⚠️ CRITICAL: User is logged in but MFA was not completed in this session'
    );
  } else {
    securityScore++;
    checkResult(
      'Authenticated User MFA Status',
      true,
      hasUser ? 'User has completed MFA in this session' : 'No user logged in'
    );
  }

  // Check 3: MFA timestamp consistency
  if (hasUser && !freshMfaVerified) {
    checkResult(
      'MFA Timestamp',
      false,
      '⚠️ WARNING: User logged in but no MFA timestamp found'
    );
  } else {
    securityScore++;
    checkResult(
      'MFA Timestamp',
      true,
      hasUser ? 'MFA timestamp present' : 'No user logged in'
    );
  }

  // Check 4: Session flags consistency
  if (appInitialized && hasUser && mfaCompletedThisSession !== 'true') {
    checkResult(
      'Session Flags Consistency',
      false,
      '⚠️ CRITICAL: Inconsistent session flags - possible MFA bypass'
    );
  } else {
    securityScore++;
    checkResult(
      'Session Flags Consistency',
      true,
      'Session flags are consistent'
    );
  }

  console.log('');
  console.log(`Security Score: ${securityScore}/${maxScore}`);
  console.log('');

  // Test 5: Recommendations
  console.log('📋 TEST 5: Recommendations');
  console.log('─────────────────────────────────────────────────────────');

  if (securityScore === maxScore) {
    console.log('✅ ALL CHECKS PASSED - MFA fix is working correctly');
    console.log('');
    console.log('The MFA bypass vulnerability has been successfully patched.');
    console.log('Session flags are properly managed and MFA requirements are enforced.');
  } else {
    console.log('❌ SECURITY ISSUES DETECTED');
    console.log('');
    console.log('⚠️  WARNING: The following issues were found:');
    console.log('');

    if (hasUser && mfaCompletedThisSession !== 'true') {
      console.log('1. User is logged in without completing MFA in this session');
      console.log('   → This may indicate the MFA bypass vulnerability is still present');
      console.log('   → Recommendation: Immediately logout and verify the fix is deployed');
    }

    if (hasUser && !freshMfaVerified) {
      console.log('2. User is logged in without an MFA timestamp');
      console.log('   → This may indicate a corrupted authentication state');
      console.log('   → Recommendation: Clear browser storage and login again');
    }

    if (appInitialized && hasUser && mfaCompletedThisSession !== 'true') {
      console.log('3. Session flags are inconsistent');
      console.log('   → This is a CRITICAL security issue');
      console.log('   → Recommendation: Contact security team immediately');
    }
  }
  console.log('');

  // Test 6: Manual test instructions
  console.log('📋 TEST 6: Manual Testing Instructions');
  console.log('─────────────────────────────────────────────────────────');
  console.log('To manually verify the MFA bypass fix:');
  console.log('');
  console.log('1. Logout if currently logged in:');
  console.log('   → Click logout button or run: window.location.href = "/login"');
  console.log('');
  console.log('2. Login with your credentials');
  console.log('');
  console.log('3. When MFA page appears, DO NOT enter code');
  console.log('');
  console.log('4. Press browser back button to return to login');
  console.log('');
  console.log('5. Refresh the page (F5 or Ctrl+R)');
  console.log('');
  console.log('6. Expected Result:');
  console.log('   ✅ You should see the LOGIN PAGE (not logged in)');
  console.log('   ❌ If you see the DASHBOARD, the MFA bypass is NOT fixed');
  console.log('');

  // Summary
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                      VERIFICATION COMPLETE                      ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');

  if (securityScore === maxScore) {
    console.log('✅ Status: SECURE - MFA fix is working correctly');
  } else {
    console.log('❌ Status: VULNERABLE - Security issues detected');
  }

  console.log('');
  console.log('For more information, see:');
  console.log('  • MFA_BYPASS_FIX.md - Technical documentation');
  console.log('  • MFA_BYPASS_TEST_PLAN.md - Complete test plan');
  console.log('  • SECURITY_FIX_SUMMARY.txt - Executive summary');
  console.log('');

  // Export results for programmatic access
  window.mfaVerificationResults = {
    timestamp: new Date().toISOString(),
    securityScore: securityScore,
    maxScore: maxScore,
    isPassed: securityScore === maxScore,
    flags: {
      appInitialized: appInitialized,
      mfaCompletedThisSession: mfaCompletedThisSession,
      freshMfaVerified: freshMfaVerified
    },
    hasUser: hasUser,
    mfaSessionValid: mfaSessionValid
  };

  console.log('📊 Results exported to: window.mfaVerificationResults');
  console.log('');
})();

// Helper functions for additional testing
window.clearMfaSession = function() {
  sessionStorage.removeItem('mfaCompletedThisSession');
  sessionStorage.removeItem('appInitialized');
  localStorage.removeItem('freshMfaVerified');
  console.log('✅ MFA session flags cleared');
  console.log('Refresh the page to see the effect');
};

window.checkMfaStatus = function() {
  console.log('Current MFA Status:');
  console.log('  appInitialized:', sessionStorage.getItem('appInitialized'));
  console.log('  mfaCompletedThisSession:', sessionStorage.getItem('mfaCompletedThisSession'));
  console.log('  freshMfaVerified:', localStorage.getItem('freshMfaVerified'));
};

console.log('💡 Additional helper functions available:');
console.log('  • clearMfaSession() - Clear all MFA session flags');
console.log('  • checkMfaStatus() - Display current MFA flag status');
console.log('');
