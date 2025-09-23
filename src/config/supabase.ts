import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/supabase'

// Force use of direct environment variables - BYPASS VALIDATOR COMPLETELY
const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY
const supabaseServiceRoleKey = (import.meta as any).env?.VITE_SUPABASE_SERVICE_ROLE_KEY

console.log('🔧 Direct environment check:')
console.log('- URL:', supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'missing')
console.log('- Anon Key:', supabaseAnonKey ? supabaseAnonKey.substring(0, 20) + '...' : 'missing')

// Check for localhost URLs that could cause CSP violations
if (supabaseUrl && supabaseUrl.includes('localhost')) {
  console.error('🚨 DETECTED LOCALHOST SUPABASE URL! This will violate CSP policy.')
  console.error('Current URL:', supabaseUrl)
  console.error('This suggests a development server is running or environment variables are not loaded correctly.')
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase configuration missing or invalid. Application will operate in localStorage-only mode.')
  console.warn('To enable Supabase integration, set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env.local file')
}

// Client for authenticated user operations
// Global flag to track Supabase availability
let isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey)
let isLocalStorageOnlyMode = !isSupabaseConfigured

// Export the configuration state for other services to check
export const supabaseConfig = {
  isConfigured: () => isSupabaseConfigured,
  isLocalStorageOnly: () => isLocalStorageOnlyMode,
  setLocalStorageOnly: (value: boolean) => { isLocalStorageOnlyMode = value }
}

// Create a silent fallback client that prevents all network calls and console spam
const createFallbackClient = () => {
  console.warn('🔌 Supabase not configured - operating in localStorage-only mode')

  // Create a completely disabled client that prevents any network calls
  const noOpHandler = {
    get: () => {
      return () => Promise.resolve({ data: null, error: { message: 'Supabase not configured', code: 'OFFLINE_MODE' } })
    }
  }

  return new Proxy({
    // Minimal client structure to prevent errors
    auth: new Proxy({}, noOpHandler),
    from: () => new Proxy({}, noOpHandler),
    rpc: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured', code: 'OFFLINE_MODE' } }),
    storage: new Proxy({}, noOpHandler),
    realtime: {
      channel: () => ({
        on: () => ({ subscribe: () => {} }),
        subscribe: () => {},
        unsubscribe: () => {},
        send: () => {}
      }),
      removeChannel: () => {},
      getChannels: () => []
    },
    removeChannel: () => {},
    getChannels: () => []
  }, noOpHandler)
}

// Create a fallback client if configuration is invalid
const createSupabaseClient = () => {
  try {
    // Check if we have the required environment variables
    if (!supabaseUrl || !supabaseAnonKey) {
      return createFallbackClient()
    }

    console.log('✅ Creating Supabase client with URL:', supabaseUrl.substring(0, 30) + '...')

    return createClient<Database>(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        // Use Azure AD integration - disable built-in auth since we use Azure AD
        detectSessionInUrl: false,
        persistSession: false,
        autoRefreshToken: false,
        storageKey: 'carexps-auth'
      },
      realtime: {
        params: {
          eventsPerSecond: 10
        },
        // Enhanced WebSocket configuration with better error handling
        logger: (level: string, message: string, details?: any) => {
          if (level === 'error') {
            // Suppress common connection errors to reduce console spam
            const suppressedErrors = [
              'WebSocket', 'connection', 'ECONNREFUSED', 'ENOTFOUND',
              'fetch', 'network', 'timeout', 'Failed to connect'
            ]

            if (suppressedErrors.some(error => message.toLowerCase().includes(error.toLowerCase()))) {
              // Only log once when going offline, then suppress
              if (!isLocalStorageOnlyMode) {
                console.log('📡 Supabase connection unavailable - switching to localStorage-only mode')
                supabaseConfig.setLocalStorageOnly(true)
              }
            } else {
              console.warn('Supabase Realtime:', message)
            }
          } else if (level === 'info' && message.includes('connected')) {
            // Re-enable when connection is restored
            if (isLocalStorageOnlyMode) {
              console.log('📡 Supabase connection restored')
              supabaseConfig.setLocalStorageOnly(false)
            }
          }
        },
        // Add reconnection settings for better resilience
        reconnectAfterMs: (tries) => {
          // Exponential backoff with max delay of 10 seconds for faster failover
          return Math.min(1000 * Math.pow(2, tries), 10000)
        },
        maxReconnectAttempts: 3, // Reduced for faster fallback
        timeout: 5000 // Reduced timeout for faster error detection
      },
      global: {
        headers: {
          'X-Client-Info': 'carexps-healthcare-crm/1.0.0',
          'Authorization': `Bearer ${supabaseAnonKey}`
        }
      }
    })
  } catch (error) {
    console.error('Failed to create Supabase client:', error)
    // Return the no-op fallback client
    return createFallbackClient()
  }
}

export const supabase = createSupabaseClient()

// Service role client for admin operations (use server-side only)
export const supabaseAdmin = supabaseServiceRoleKey && supabaseUrl
  ? createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null

// HIPAA Compliance Configuration
export const hipaaConfig = {
  encryptionEnabled: (import.meta as any).env?.VITE_HIPAA_MODE === 'true',
  auditLoggingEnabled: true,
  dataRetentionDays: 2555, // 7 years for HIPAA compliance
  sessionTimeoutMinutes: 15,
  maxFailedLoginAttempts: 3,
  passwordExpirationDays: 90,
  requireMFA: true
}

// Encryption configuration for PHI data
export const encryptionConfig = {
  phiKey: (import.meta as any).env?.VITE_PHI_ENCRYPTION_KEY,
  auditKey: (import.meta as any).env?.VITE_AUDIT_ENCRYPTION_KEY,
  algorithm: 'AES-256-GCM'
}

// Validate encryption keys are present when HIPAA mode is enabled
if (hipaaConfig.encryptionEnabled && (!encryptionConfig.phiKey || !encryptionConfig.auditKey)) {
  throw new Error('SECURITY ERROR: PHI encryption keys are required when HIPAA mode is enabled. Please configure VITE_PHI_ENCRYPTION_KEY and VITE_AUDIT_ENCRYPTION_KEY in your environment.')
}