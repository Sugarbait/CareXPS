/**
 * Tenant Configuration
 *
 * This configuration file defines the tenant ID for CareXPS application.
 * All user-related database queries must filter by this tenant_id to ensure
 * proper data isolation in the multi-tenant Supabase database.
 */

/**
 * The tenant ID for CareXPS application
 * This value must match the tenant_id in the Supabase users table
 */
export const TENANT_ID = 'carexps';

/**
 * Tenant display name (optional, for UI purposes)
 */
export const TENANT_NAME = 'CareXPS';

/**
 * Get the current tenant ID for this application (with debugging)
 */
export function getCurrentTenantId(): string {
  const tenantId = TENANT_ID;
  console.log(`🏢 [TENANT] getCurrentTenantId() called - Returning: "${tenantId}"`);
  return tenantId;
}
