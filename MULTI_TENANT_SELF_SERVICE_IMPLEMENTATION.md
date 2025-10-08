# Multi-Tenant Self-Service Onboarding - Implementation Guide

**Project:** Transform CareXPS into a Self-Service Multi-Tenant SaaS Platform
**Date:** October 3, 2025
**Estimated Timeline:** 4-6 weeks for MVP, 8-12 weeks for full implementation

---

## **📋 Table of Contents**

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Phase 1: Foundation (Week 1-2)](#phase-1-foundation-week-1-2)
4. [Phase 2: Self-Service Signup (Week 3-4)](#phase-2-self-service-signup-week-3-4)
5. [Phase 3: Tenant Management (Week 5-6)](#phase-3-tenant-management-week-5-6)
6. [Phase 4: Billing & Subscriptions (Week 7-8)](#phase-4-billing--subscriptions-week-7-8)
7. [Phase 5: Enterprise Features (Week 9-12)](#phase-5-enterprise-features-week-9-12)
8. [Database Schema Changes](#database-schema-changes)
9. [Security Considerations](#security-considerations)
10. [Testing Strategy](#testing-strategy)
11. [Deployment Plan](#deployment-plan)

---

## **Executive Summary**

### **Current State:**
- Manual tenant creation (CareXPS, MedEx)
- Tenant isolation via `tenant_id` filtering
- Shared Supabase database
- Separate Azure deployments per tenant

### **Target State:**
- Self-service signup at `signup.yourcrm.com`
- Automatic tenant provisioning (< 30 seconds)
- Subdomain-based routing (`acme.yourcrm.com`)
- Centralized billing and management
- 100+ tenants on single infrastructure

### **Business Benefits:**
- ✅ Zero manual setup per customer
- ✅ Instant customer onboarding
- ✅ Scalable revenue model (SaaS)
- ✅ Predictable infrastructure costs
- ✅ One codebase, one deployment

---

## **Architecture Overview**

### **High-Level Architecture**

```
┌─────────────────────────────────────────────────────────────┐
│                    PUBLIC SIGNUP PAGE                        │
│              https://signup.yourcrm.com                      │
│  User enters: Company, Email, Password, Subdomain            │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  TENANT PROVISIONING API                     │
│  1. Validate subdomain availability                          │
│  2. Create tenant record (tenant_id)                         │
│  3. Create admin user with tenant_id                         │
│  4. Initialize tenant settings                               │
│  5. Setup Stripe customer                                    │
│  6. Send welcome email                                       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   TENANT APPLICATIONS                        │
│                                                               │
│  acme.yourcrm.com ──────────┐                               │
│  medex.yourcrm.com ─────────┤                               │
│  carexps.yourcrm.com ───────┼──► SAME CODEBASE             │
│  company123.yourcrm.com ────┤   (Tenant detected via URL)   │
│                             │                                │
│  Each sees ONLY their data  │                               │
│  via tenant_id filtering    │                               │
└─────────────────────────────┴───────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              SHARED SUPABASE DATABASE                        │
│                                                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Tenants   │  │    Users    │  │   Calls     │         │
│  │             │  │             │  │             │         │
│  │ id          │  │ tenant_id ──┼──│ tenant_id   │         │
│  │ subdomain   │  │ email       │  │ call_data   │         │
│  │ name        │  │ role        │  └─────────────┘         │
│  │ created_at  │  └─────────────┘                           │
│  │ plan_type   │                                             │
│  │ stripe_id   │  All tables have tenant_id column          │
│  └─────────────┘  RLS policies enforce isolation            │
└─────────────────────────────────────────────────────────────┘
```

### **Data Flow**

```
User Visits Subdomain (acme.yourcrm.com)
    ↓
App reads subdomain from URL
    ↓
Lookup tenant_id from subdomain
    ↓
Set global TENANT_ID context
    ↓
All DB queries auto-filtered by tenant_id
    ↓
User sees ONLY their company's data
```

---

## **Phase 1: Foundation (Week 1-2)**

### **1.1 Database Schema Updates**

#### **New Table: `tenants`**

```sql
-- Create tenants table
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id TEXT UNIQUE NOT NULL, -- e.g., "acme_healthcare"
  subdomain TEXT UNIQUE NOT NULL, -- e.g., "acme"
  company_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- active, suspended, cancelled
  plan_type TEXT NOT NULL DEFAULT 'free', -- free, starter, professional, enterprise

  -- Billing
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  billing_email TEXT,

  -- Settings
  custom_logo_url TEXT,
  primary_color TEXT DEFAULT '#3B82F6',

  -- Limits (based on plan)
  max_users INTEGER DEFAULT 5,
  max_storage_gb INTEGER DEFAULT 10,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  -- Features flags
  features JSONB DEFAULT '{}'::jsonb
);

-- Add RLS policies
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Super admins can see all tenants
CREATE POLICY "Super admins can view all tenants"
ON public.tenants FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id::text = auth.uid()
    AND users.role = 'super_admin'
  )
);

-- Users can view their own tenant
CREATE POLICY "Users can view their tenant"
ON public.tenants FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id::text = auth.uid()
    AND users.tenant_id = tenants.tenant_id
  )
);

-- Create indexes
CREATE INDEX idx_tenants_subdomain ON public.tenants(subdomain);
CREATE INDEX idx_tenants_tenant_id ON public.tenants(tenant_id);
CREATE INDEX idx_tenants_status ON public.tenants(status);
```

#### **Update Existing Tables**

```sql
-- Add tenant_id to all tables that don't have it
-- (Most tables already have it from previous migration)

-- Ensure all tables have proper indexes
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON public.users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_calls_tenant_id ON public.calls(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sms_messages_tenant_id ON public.sms_messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notes_tenant_id ON public.notes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON public.audit_logs(tenant_id);

-- Add foreign key constraints
ALTER TABLE public.users
ADD CONSTRAINT fk_users_tenant
FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id)
ON DELETE CASCADE;

-- Repeat for all major tables
```

#### **Seed Default Tenants**

```sql
-- Insert existing tenants
INSERT INTO public.tenants (tenant_id, subdomain, company_name, plan_type, status)
VALUES
  ('carexps', 'carexps', 'CareXPS Healthcare', 'enterprise', 'active'),
  ('medex', 'medex', 'MedEx Healthcare', 'professional', 'active')
ON CONFLICT (tenant_id) DO NOTHING;

-- Update existing users to reference tenants
UPDATE public.users SET tenant_id = 'carexps' WHERE tenant_id IS NULL OR tenant_id = '';
```

### **1.2 Create Tenant Context System**

#### **File: `src/contexts/TenantContext.tsx`**

```typescript
import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '@/config/supabase'

interface Tenant {
  id: string
  tenant_id: string
  subdomain: string
  company_name: string
  status: 'active' | 'suspended' | 'cancelled'
  plan_type: 'free' | 'starter' | 'professional' | 'enterprise'
  custom_logo_url?: string
  primary_color?: string
  max_users: number
  max_storage_gb: number
  features: Record<string, any>
}

interface TenantContextType {
  tenant: Tenant | null
  tenantId: string | null
  isLoading: boolean
  refreshTenant: () => Promise<void>
}

const TenantContext = createContext<TenantContextType | undefined>(undefined)

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const detectTenantFromSubdomain = (): string | null => {
    // Get subdomain from current URL
    const hostname = window.location.hostname

    // localhost development
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      // Check for subdomain in localStorage for local dev
      const localTenant = localStorage.getItem('dev_tenant_id')
      return localTenant || 'carexps' // Default to carexps for local dev
    }

    // Production: extract subdomain
    // acme.yourcrm.com -> acme
    const parts = hostname.split('.')
    if (parts.length >= 3) {
      return parts[0] // First part is subdomain
    }

    // Fallback to carexps if no subdomain detected
    return 'carexps'
  }

  const loadTenant = async (subdomain: string) => {
    try {
      setIsLoading(true)

      // Fetch tenant by subdomain
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('subdomain', subdomain)
        .single()

      if (error) {
        console.error('Error loading tenant:', error)
        setTenant(null)
        setTenantId(null)
        return
      }

      if (data) {
        setTenant(data)
        setTenantId(data.tenant_id)

        // Apply tenant branding
        if (data.custom_logo_url) {
          // Update logo in app
        }
        if (data.primary_color) {
          document.documentElement.style.setProperty('--primary-color', data.primary_color)
        }
      }
    } catch (error) {
      console.error('Failed to load tenant:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const refreshTenant = async () => {
    const subdomain = detectTenantFromSubdomain()
    if (subdomain) {
      await loadTenant(subdomain)
    }
  }

  useEffect(() => {
    const subdomain = detectTenantFromSubdomain()
    if (subdomain) {
      loadTenant(subdomain)
    } else {
      setIsLoading(false)
    }
  }, [])

  return (
    <TenantContext.Provider value={{ tenant, tenantId, isLoading, refreshTenant }}>
      {children}
    </TenantContext.Provider>
  )
}

export const useTenant = () => {
  const context = useContext(TenantContext)
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider')
  }
  return context
}
```

### **1.3 Update All Services to Use Tenant Context**

#### **File: `src/config/tenantConfig.ts`**

```typescript
/**
 * Tenant Configuration
 * Provides tenant_id for database filtering
 */

let currentTenantId: string | null = null

export const setTenantId = (tenantId: string) => {
  currentTenantId = tenantId
}

export const getTenantId = (): string => {
  if (!currentTenantId) {
    throw new Error('Tenant ID not initialized. Wrap app in TenantProvider.')
  }
  return currentTenantId
}

export const TENANT_ID = 'carexps' // Fallback for backwards compatibility
```

#### **Update App.tsx**

```typescript
import { TenantProvider, useTenant } from '@/contexts/TenantContext'
import { setTenantId } from '@/config/tenantConfig'

function AppContent() {
  const { tenantId, isLoading } = useTenant()

  useEffect(() => {
    if (tenantId) {
      setTenantId(tenantId)
    }
  }, [tenantId])

  if (isLoading) {
    return <div>Loading tenant...</div>
  }

  // Rest of app
}

function App() {
  return (
    <TenantProvider>
      <AppContent />
    </TenantProvider>
  )
}
```

#### **Update userProfileService.ts**

```typescript
import { getTenantId } from '@/config/tenantConfig'

// Before (hardcoded):
.eq('tenant_id', 'carexps')

// After (dynamic):
.eq('tenant_id', getTenantId())
```

**Apply this pattern to ALL 30+ queries across all services.**

---

## **Phase 2: Self-Service Signup (Week 3-4)**

### **2.1 Public Signup Page**

#### **File: `src/pages/SignupPage.tsx`**

```typescript
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/config/supabase'

interface SignupForm {
  companyName: string
  subdomain: string
  adminEmail: string
  adminPassword: string
  adminName: string
}

export const SignupPage: React.FC = () => {
  const [form, setForm] = useState<SignupForm>({
    companyName: '',
    subdomain: '',
    adminEmail: '',
    adminPassword: '',
    adminName: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [subdomainAvailable, setSubdomainAvailable] = useState<boolean | null>(null)

  const navigate = useNavigate()

  const checkSubdomainAvailability = async (subdomain: string) => {
    if (!subdomain || subdomain.length < 3) {
      setSubdomainAvailable(null)
      return
    }

    // Validate subdomain format (alphanumeric, lowercase, hyphens)
    const subdomainRegex = /^[a-z0-9-]+$/
    if (!subdomainRegex.test(subdomain)) {
      setSubdomainAvailable(false)
      setError('Subdomain can only contain lowercase letters, numbers, and hyphens')
      return
    }

    // Check if subdomain exists
    const { data, error } = await supabase
      .from('tenants')
      .select('subdomain')
      .eq('subdomain', subdomain)
      .single()

    setSubdomainAvailable(!data && !error)
  }

  const handleSubdomainChange = (value: string) => {
    const normalized = value.toLowerCase().replace(/[^a-z0-9-]/g, '')
    setForm({ ...form, subdomain: normalized })
    checkSubdomainAvailability(normalized)
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Call tenant provisioning API
      const response = await fetch('/api/provision-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create account')
      }

      // Redirect to new tenant subdomain
      const tenantUrl = `https://${form.subdomain}.yourcrm.com`
      window.location.href = `${tenantUrl}/login?newaccount=true`

    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Start Your Free Trial</h1>
          <p className="text-gray-600 mt-2">Create your healthcare CRM in 30 seconds</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-6">
          {/* Company Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Company Name
            </label>
            <input
              type="text"
              required
              value={form.companyName}
              onChange={(e) => setForm({ ...form, companyName: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Acme Healthcare"
            />
          </div>

          {/* Subdomain */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your Subdomain
            </label>
            <div className="flex items-center">
              <input
                type="text"
                required
                value={form.subdomain}
                onChange={(e) => handleSubdomainChange(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-blue-500"
                placeholder="acme"
                minLength={3}
              />
              <span className="px-4 py-2 bg-gray-100 border border-l-0 border-gray-300 rounded-r-lg text-gray-600">
                .yourcrm.com
              </span>
            </div>
            {subdomainAvailable === true && (
              <p className="text-green-600 text-sm mt-1">✓ Subdomain available</p>
            )}
            {subdomainAvailable === false && (
              <p className="text-red-600 text-sm mt-1">✗ Subdomain not available</p>
            )}
          </div>

          {/* Admin Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your Name
            </label>
            <input
              type="text"
              required
              value={form.adminName}
              onChange={(e) => setForm({ ...form, adminName: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="John Doe"
            />
          </div>

          {/* Admin Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <input
              type="email"
              required
              value={form.adminEmail}
              onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="admin@acmehealthcare.com"
            />
          </div>

          {/* Admin Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              type="password"
              required
              value={form.adminPassword}
              onChange={(e) => setForm({ ...form, adminPassword: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Minimum 8 characters"
              minLength={8}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !subdomainAvailable}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600 mt-6">
          Already have an account?{' '}
          <a href="https://yourcrm.com/login" className="text-blue-600 hover:underline">
            Sign in
          </a>
        </p>
      </div>
    </div>
  )
}
```

### **2.2 Tenant Provisioning API**

#### **File: `api/provision-tenant/index.js`**

```javascript
const { createClient } = require('@supabase/supabase-js')
const crypto = require('crypto')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

module.exports = async function (context, req) {
  context.log('Provisioning new tenant...')

  // CORS
  if (req.method === 'OPTIONS') {
    context.res = {
      status: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST' }
    }
    return
  }

  try {
    const { companyName, subdomain, adminEmail, adminPassword, adminName } = req.body

    // Validate input
    if (!companyName || !subdomain || !adminEmail || !adminPassword) {
      context.res = {
        status: 400,
        body: { error: 'Missing required fields' }
      }
      return
    }

    // Validate subdomain format
    const subdomainRegex = /^[a-z0-9-]{3,}$/
    if (!subdomainRegex.test(subdomain)) {
      context.res = {
        status: 400,
        body: { error: 'Invalid subdomain format' }
      }
      return
    }

    // Check subdomain availability
    const { data: existingTenant } = await supabase
      .from('tenants')
      .select('subdomain')
      .eq('subdomain', subdomain)
      .single()

    if (existingTenant) {
      context.res = {
        status: 409,
        body: { error: 'Subdomain already taken' }
      }
      return
    }

    // Generate tenant_id (normalized company name)
    const tenantId = companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .substring(0, 50)

    // 1. Create Supabase Auth user
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: {
        name: adminName,
        role: 'super_user',
        tenant_id: tenantId
      }
    })

    if (authError) {
      throw new Error(`Auth creation failed: ${authError.message}`)
    }

    // 2. Create tenant record
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        tenant_id: tenantId,
        subdomain: subdomain,
        company_name: companyName,
        status: 'active',
        plan_type: 'free', // Start with free trial
        billing_email: adminEmail,
        max_users: 5,
        max_storage_gb: 10,
        created_by: authUser.user.id
      })
      .select()
      .single()

    if (tenantError) {
      // Rollback: delete auth user
      await supabase.auth.admin.deleteUser(authUser.user.id)
      throw new Error(`Tenant creation failed: ${tenantError.message}`)
    }

    // 3. Create admin user in users table
    const { error: userError } = await supabase
      .from('users')
      .insert({
        id: authUser.user.id,
        email: adminEmail,
        name: adminName,
        role: 'super_user',
        tenant_id: tenantId,
        is_active: true
      })

    if (userError) {
      // Rollback
      await supabase.auth.admin.deleteUser(authUser.user.id)
      await supabase.from('tenants').delete().eq('id', tenant.id)
      throw new Error(`User creation failed: ${userError.message}`)
    }

    // 4. Create default user settings
    await supabase
      .from('user_settings')
      .insert({
        user_id: authUser.user.id,
        tenant_id: tenantId
      })

    // 5. Initialize tenant with default data (optional)
    // - Create default roles, templates, etc.

    // 6. Send welcome email (optional)
    // - Use SendGrid, Resend, or other email service

    // 7. Log audit event
    await supabase
      .from('audit_logs')
      .insert({
        tenant_id: tenantId,
        user_id: authUser.user.id,
        action: 'TENANT_CREATED',
        resource_type: 'tenant',
        resource_id: tenant.id,
        outcome: 'SUCCESS',
        additional_info: JSON.stringify({
          company_name: companyName,
          subdomain: subdomain
        })
      })

    context.log(`Tenant provisioned successfully: ${tenantId}`)

    context.res = {
      status: 201,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: {
        success: true,
        tenant_id: tenantId,
        subdomain: subdomain,
        redirect_url: `https://${subdomain}.yourcrm.com`
      }
    }

  } catch (error) {
    context.log.error('Tenant provisioning error:', error)
    context.res = {
      status: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: { error: error.message }
    }
  }
}
```

#### **File: `api/provision-tenant/function.json`**

```json
{
  "bindings": [
    {
      "authLevel": "anonymous",
      "type": "httpTrigger",
      "direction": "in",
      "name": "req",
      "methods": ["post", "options"]
    },
    {
      "type": "http",
      "direction": "out",
      "name": "res"
    }
  ]
}
```

---

## **Phase 3: Tenant Management (Week 5-6)**

### **3.1 Tenant Settings Page**

#### **File: `src/pages/TenantSettingsPage.tsx`**

```typescript
import React, { useState, useEffect } from 'react'
import { useTenant } from '@/contexts/TenantContext'
import { supabase } from '@/config/supabase'

export const TenantSettingsPage: React.FC = () => {
  const { tenant, refreshTenant } = useTenant()
  const [companyName, setCompanyName] = useState('')
  const [customLogoUrl, setCustomLogoUrl] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#3B82F6')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (tenant) {
      setCompanyName(tenant.company_name)
      setCustomLogoUrl(tenant.custom_logo_url || '')
      setPrimaryColor(tenant.primary_color || '#3B82F6')
    }
  }, [tenant])

  const handleSave = async () => {
    if (!tenant) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('tenants')
        .update({
          company_name: companyName,
          custom_logo_url: customLogoUrl,
          primary_color: primaryColor,
          updated_at: new Date().toISOString()
        })
        .eq('id', tenant.id)

      if (error) throw error

      await refreshTenant()
      alert('Settings saved successfully!')
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  if (!tenant) return <div>Loading...</div>

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Tenant Settings</h1>

      <div className="bg-white rounded-lg shadow p-6 space-y-6">
        {/* Company Info */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Company Information</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Company Name
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Subdomain
              </label>
              <div className="flex items-center">
                <input
                  type="text"
                  value={tenant.subdomain}
                  disabled
                  className="flex-1 px-4 py-2 border rounded-l-lg bg-gray-50"
                />
                <span className="px-4 py-2 bg-gray-100 border border-l-0 rounded-r-lg">
                  .yourcrm.com
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Contact support to change your subdomain
              </p>
            </div>
          </div>
        </div>

        {/* Branding */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Branding</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Custom Logo URL
              </label>
              <input
                type="url"
                value={customLogoUrl}
                onChange={(e) => setCustomLogoUrl(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg"
                placeholder="https://example.com/logo.png"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Primary Color
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-16 h-10 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="flex-1 px-4 py-2 border rounded-lg"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Plan Info */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Subscription</h2>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-medium text-blue-900">
                  Current Plan: {tenant.plan_type.toUpperCase()}
                </p>
                <p className="text-sm text-blue-700">
                  {tenant.max_users} users • {tenant.max_storage_gb} GB storage
                </p>
              </div>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Upgrade Plan
              </button>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

### **3.2 Usage Monitoring**

#### **File: `src/components/tenant/UsageWidget.tsx`**

```typescript
import React, { useEffect, useState } from 'react'
import { useTenant } from '@/contexts/TenantContext'
import { supabase } from '@/config/supabase'
import { getTenantId } from '@/config/tenantConfig'

export const UsageWidget: React.FC = () => {
  const { tenant } = useTenant()
  const [usage, setUsage] = useState({
    users: 0,
    calls: 0,
    sms: 0,
    storage: 0
  })

  useEffect(() => {
    loadUsage()
  }, [tenant])

  const loadUsage = async () => {
    if (!tenant) return

    const tenantId = getTenantId()

    // Count users
    const { count: userCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)

    // Count calls
    const { count: callCount } = await supabase
      .from('calls')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)

    // Count SMS
    const { count: smsCount } = await supabase
      .from('sms_messages')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)

    setUsage({
      users: userCount || 0,
      calls: callCount || 0,
      sms: smsCount || 0,
      storage: 0 // Calculate from file uploads
    })
  }

  if (!tenant) return null

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="font-semibold mb-4">Usage Overview</h3>

      <div className="space-y-3">
        <UsageBar
          label="Users"
          current={usage.users}
          max={tenant.max_users}
          unit="users"
        />
        <UsageBar
          label="Storage"
          current={usage.storage}
          max={tenant.max_storage_gb}
          unit="GB"
        />
      </div>

      <div className="mt-4 pt-4 border-t">
        <div className="text-sm text-gray-600">
          <p>Calls this month: {usage.calls}</p>
          <p>SMS sent: {usage.sms}</p>
        </div>
      </div>
    </div>
  )
}

const UsageBar: React.FC<{ label: string, current: number, max: number, unit: string }> = ({
  label,
  current,
  max,
  unit
}) => {
  const percentage = (current / max) * 100
  const isWarning = percentage > 80

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="font-medium">{label}</span>
        <span className={isWarning ? 'text-red-600' : 'text-gray-600'}>
          {current} / {max} {unit}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full ${isWarning ? 'bg-red-500' : 'bg-blue-500'}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  )
}
```

---

## **Phase 4: Billing & Subscriptions (Week 7-8)**

### **4.1 Stripe Integration**

#### **Install Stripe**

```bash
npm install stripe @stripe/stripe-js
```

#### **File: `api/create-checkout-session/index.js`**

```javascript
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Pricing plans
const PLANS = {
  starter: {
    name: 'Starter',
    price: 49, // $49/month
    max_users: 10,
    max_storage_gb: 50,
    stripe_price_id: 'price_starter_monthly'
  },
  professional: {
    name: 'Professional',
    price: 99,
    max_users: 50,
    max_storage_gb: 200,
    stripe_price_id: 'price_professional_monthly'
  },
  enterprise: {
    name: 'Enterprise',
    price: 249,
    max_users: -1, // Unlimited
    max_storage_gb: 1000,
    stripe_price_id: 'price_enterprise_monthly'
  }
}

module.exports = async function (context, req) {
  try {
    const { tenant_id, plan_type } = req.body

    const plan = PLANS[plan_type]
    if (!plan) {
      throw new Error('Invalid plan type')
    }

    // Get tenant
    const { data: tenant } = await supabase
      .from('tenants')
      .select('*')
      .eq('tenant_id', tenant_id)
      .single()

    if (!tenant) {
      throw new Error('Tenant not found')
    }

    // Create or retrieve Stripe customer
    let customerId = tenant.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: tenant.billing_email,
        metadata: {
          tenant_id: tenant.tenant_id,
          subdomain: tenant.subdomain
        }
      })
      customerId = customer.id

      // Update tenant with Stripe customer ID
      await supabase
        .from('tenants')
        .update({ stripe_customer_id: customerId })
        .eq('id', tenant.id)
    }

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: plan.stripe_price_id,
          quantity: 1
        }
      ],
      mode: 'subscription',
      success_url: `https://${tenant.subdomain}.yourcrm.com/settings/billing?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://${tenant.subdomain}.yourcrm.com/settings/billing`
    })

    context.res = {
      status: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: { sessionId: session.id }
    }

  } catch (error) {
    context.log.error('Checkout error:', error)
    context.res = {
      status: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: { error: error.message }
    }
  }
}
```

#### **File: `api/stripe-webhook/index.js`**

```javascript
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

module.exports = async function (context, req) {
  const sig = req.headers['stripe-signature']
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  let event

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret)
  } catch (err) {
    context.log.error('Webhook signature verification failed:', err.message)
    context.res = { status: 400, body: 'Webhook Error' }
    return
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutComplete(event.data.object)
      break

    case 'customer.subscription.updated':
      await handleSubscriptionUpdate(event.data.object)
      break

    case 'customer.subscription.deleted':
      await handleSubscriptionCancelled(event.data.object)
      break

    case 'invoice.payment_failed':
      await handlePaymentFailed(event.data.object)
      break
  }

  context.res = { status: 200, body: 'Success' }
}

async function handleCheckoutComplete(session) {
  const customerId = session.customer
  const subscriptionId = session.subscription

  // Get subscription details
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const priceId = subscription.items.data[0].price.id

  // Map price to plan
  let planType = 'starter'
  if (priceId === 'price_professional_monthly') planType = 'professional'
  if (priceId === 'price_enterprise_monthly') planType = 'enterprise'

  // Update tenant
  await supabase
    .from('tenants')
    .update({
      plan_type: planType,
      stripe_subscription_id: subscriptionId,
      status: 'active'
    })
    .eq('stripe_customer_id', customerId)
}

async function handleSubscriptionUpdate(subscription) {
  // Handle plan changes, renewals, etc.
}

async function handleSubscriptionCancelled(subscription) {
  await supabase
    .from('tenants')
    .update({
      status: 'cancelled',
      plan_type: 'free'
    })
    .eq('stripe_subscription_id', subscription.id)
}

async function handlePaymentFailed(invoice) {
  // Send notification, suspend account after grace period
  await supabase
    .from('tenants')
    .update({ status: 'suspended' })
    .eq('stripe_customer_id', invoice.customer)
}
```

### **4.2 Billing Page**

#### **File: `src/pages/BillingPage.tsx`**

```typescript
import React from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { useTenant } from '@/contexts/TenantContext'

const stripePromise = loadStripe(process.env.VITE_STRIPE_PUBLISHABLE_KEY!)

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    features: ['5 users', '10 GB storage', 'Basic features']
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 49,
    features: ['10 users', '50 GB storage', 'All features', 'Email support']
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 99,
    features: ['50 users', '200 GB storage', 'All features', 'Priority support', 'Custom branding']
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 249,
    features: ['Unlimited users', '1 TB storage', 'All features', '24/7 support', 'Custom integrations']
  }
]

export const BillingPage: React.FC = () => {
  const { tenant } = useTenant()

  const handleUpgrade = async (planType: string) => {
    const response = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant_id: tenant?.tenant_id,
        plan_type: planType
      })
    })

    const { sessionId } = await response.json()
    const stripe = await stripePromise
    await stripe?.redirectToCheckout({ sessionId })
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8">Choose Your Plan</h1>

      <div className="grid md:grid-cols-4 gap-6">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`border rounded-lg p-6 ${
              tenant?.plan_type === plan.id ? 'border-blue-500 bg-blue-50' : ''
            }`}
          >
            <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
            <div className="text-3xl font-bold mb-4">
              ${plan.price}
              <span className="text-sm text-gray-600">/month</span>
            </div>

            <ul className="space-y-2 mb-6">
              {plan.features.map((feature, i) => (
                <li key={i} className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span className="text-sm">{feature}</span>
                </li>
              ))}
            </ul>

            {tenant?.plan_type === plan.id ? (
              <button disabled className="w-full py-2 bg-gray-300 rounded-lg">
                Current Plan
              </button>
            ) : (
              <button
                onClick={() => handleUpgrade(plan.id)}
                className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {plan.price === 0 ? 'Downgrade' : 'Upgrade'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

---

## **Phase 5: Enterprise Features (Week 9-12)**

### **5.1 Custom Domain Support**

Allow tenants to use their own domain (e.g., `crm.acmehealthcare.com`) instead of subdomain.

#### **Database Update**

```sql
ALTER TABLE public.tenants
ADD COLUMN custom_domain TEXT,
ADD COLUMN custom_domain_verified BOOLEAN DEFAULT FALSE;

CREATE INDEX idx_tenants_custom_domain ON public.tenants(custom_domain);
```

#### **Domain Verification**

```typescript
// User adds custom domain: crm.acmehealthcare.com
// System provides DNS records to add:
// CNAME: crm.acmehealthcare.com -> yourcrm.com
// TXT: _verification.crm.acmehealthcare.com -> "verify-xyz123"

// Verification endpoint
export const verifyCustomDomain = async (tenantId: string) => {
  const { data: tenant } = await supabase
    .from('tenants')
    .select('custom_domain')
    .eq('tenant_id', tenantId)
    .single()

  if (!tenant?.custom_domain) return false

  // Check DNS records
  const dns = require('dns').promises

  try {
    const txtRecords = await dns.resolveTxt(`_verification.${tenant.custom_domain}`)
    const isVerified = txtRecords.some(record =>
      record.join('').includes(tenant.verification_token)
    )

    if (isVerified) {
      await supabase
        .from('tenants')
        .update({ custom_domain_verified: true })
        .eq('id', tenant.id)
    }

    return isVerified
  } catch (error) {
    return false
  }
}
```

### **5.2 SSO Integration (SAML/OAuth)**

Allow enterprise customers to use their own identity provider.

#### **Database Update**

```sql
ALTER TABLE public.tenants
ADD COLUMN sso_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN sso_provider TEXT, -- 'okta', 'azure_ad', 'google'
ADD COLUMN sso_config JSONB;
```

#### **SSO Configuration**

```typescript
interface SSOConfig {
  provider: 'okta' | 'azure_ad' | 'google'
  client_id: string
  client_secret: string
  domain: string
  // Provider-specific settings
}

// Example: Azure AD SSO
const initializeAzureSSO = (config: SSOConfig) => {
  return {
    authority: `https://login.microsoftonline.com/${config.domain}`,
    clientId: config.client_id,
    redirectUri: `https://${tenant.subdomain}.yourcrm.com/auth/callback`
  }
}
```

### **5.3 Advanced Analytics Dashboard**

#### **Tenant-wide analytics for super admins**

```typescript
export const TenantAnalyticsDashboard: React.FC = () => {
  const { tenant } = useTenant()
  const [analytics, setAnalytics] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalCalls: 0,
    totalSMS: 0,
    storageUsed: 0,
    monthlyActivity: []
  })

  useEffect(() => {
    loadAnalytics()
  }, [])

  const loadAnalytics = async () => {
    // Aggregate data across tenant
    // Show trends, usage patterns, etc.
  }

  return (
    <div>
      {/* Charts, metrics, insights */}
    </div>
  )
}
```

---

## **Database Schema Changes**

### **Complete Migration File**

#### **File: `supabase/migrations/20251004000000_multi_tenant_self_service.sql`**

```sql
-- ================================================
-- MULTI-TENANT SELF-SERVICE MIGRATION
-- ================================================

-- Create tenants table
CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id TEXT UNIQUE NOT NULL,
  subdomain TEXT UNIQUE NOT NULL,
  company_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  plan_type TEXT NOT NULL DEFAULT 'free',

  -- Billing
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT,
  billing_email TEXT,

  -- Branding
  custom_logo_url TEXT,
  primary_color TEXT DEFAULT '#3B82F6',

  -- Limits
  max_users INTEGER DEFAULT 5,
  max_storage_gb INTEGER DEFAULT 10,

  -- Custom domain (Enterprise)
  custom_domain TEXT,
  custom_domain_verified BOOLEAN DEFAULT FALSE,
  verification_token TEXT,

  -- SSO (Enterprise)
  sso_enabled BOOLEAN DEFAULT FALSE,
  sso_provider TEXT,
  sso_config JSONB,

  -- Features
  features JSONB DEFAULT '{}'::jsonb,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  -- Constraints
  CONSTRAINT valid_status CHECK (status IN ('active', 'suspended', 'cancelled')),
  CONSTRAINT valid_plan CHECK (plan_type IN ('free', 'starter', 'professional', 'enterprise'))
);

-- Indexes
CREATE INDEX idx_tenants_tenant_id ON public.tenants(tenant_id);
CREATE INDEX idx_tenants_subdomain ON public.tenants(subdomain);
CREATE INDEX idx_tenants_custom_domain ON public.tenants(custom_domain);
CREATE INDEX idx_tenants_status ON public.tenants(status);
CREATE INDEX idx_tenants_stripe_customer ON public.tenants(stripe_customer_id);

-- RLS Policies
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view all tenants"
ON public.tenants FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id::text = auth.uid()
    AND users.role = 'super_admin'
  )
);

CREATE POLICY "Users can view their tenant"
ON public.tenants FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id::text = auth.uid()
    AND users.tenant_id = tenants.tenant_id
  )
);

CREATE POLICY "Tenant admins can update their tenant"
ON public.tenants FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id::text = auth.uid()
    AND users.tenant_id = tenants.tenant_id
    AND users.role IN ('super_user', 'admin')
  )
);

-- Add foreign key to users table
ALTER TABLE public.users
ADD CONSTRAINT fk_users_tenant
FOREIGN KEY (tenant_id)
REFERENCES public.tenants(tenant_id)
ON DELETE CASCADE;

-- Seed existing tenants
INSERT INTO public.tenants (tenant_id, subdomain, company_name, plan_type, status)
VALUES
  ('carexps', 'carexps', 'CareXPS Healthcare', 'enterprise', 'active'),
  ('medex', 'medex', 'MedEx Healthcare', 'professional', 'active')
ON CONFLICT (tenant_id) DO NOTHING;

-- Function: Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tenants_updated_at
BEFORE UPDATE ON public.tenants
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
```

---

## **Security Considerations**

### **1. Tenant Isolation Enforcement**

```typescript
// Middleware to enforce tenant context
export const enforceTenantContext = (req, res, next) => {
  const tenantId = getTenantId()

  if (!tenantId) {
    return res.status(403).json({ error: 'Tenant context required' })
  }

  // Attach to request
  req.tenantId = tenantId
  next()
}
```

### **2. Prevent Cross-Tenant Data Leakage**

```typescript
// ALWAYS use getTenantId() in queries
const { data } = await supabase
  .from('users')
  .select('*')
  .eq('tenant_id', getTenantId()) // CRITICAL!
```

### **3. Row Level Security (RLS)**

```sql
-- Example RLS policy for users table
CREATE POLICY "Users can only see users in their tenant"
ON public.users FOR SELECT
USING (
  tenant_id IN (
    SELECT tenant_id FROM users WHERE id::text = auth.uid()
  )
);
```

### **4. Rate Limiting**

```typescript
// Prevent abuse during signup
import rateLimit from 'express-rate-limit'

const signupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5 // 5 signups per IP per 15 minutes
})

app.post('/api/provision-tenant', signupLimiter, async (req, res) => {
  // Handle signup
})
```

### **5. Input Validation**

```typescript
import { z } from 'zod'

const signupSchema = z.object({
  companyName: z.string().min(2).max(100),
  subdomain: z.string().regex(/^[a-z0-9-]{3,50}$/),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8)
})

// Validate before processing
const validated = signupSchema.parse(req.body)
```

---

## **Testing Strategy**

### **Unit Tests**

```typescript
import { describe, it, expect } from 'vitest'
import { getTenantId, setTenantId } from '@/config/tenantConfig'

describe('Tenant Context', () => {
  it('should set and get tenant ID', () => {
    setTenantId('test_tenant')
    expect(getTenantId()).toBe('test_tenant')
  })

  it('should throw error if tenant ID not set', () => {
    expect(() => getTenantId()).toThrow()
  })
})
```

### **Integration Tests**

```typescript
describe('Tenant Provisioning', () => {
  it('should create new tenant successfully', async () => {
    const response = await fetch('/api/provision-tenant', {
      method: 'POST',
      body: JSON.stringify({
        companyName: 'Test Corp',
        subdomain: 'testcorp',
        adminEmail: 'admin@test.com',
        adminPassword: 'Test123!'
      })
    })

    expect(response.status).toBe(201)
    const data = await response.json()
    expect(data.tenant_id).toBeDefined()
  })

  it('should reject duplicate subdomain', async () => {
    // Try to create with existing subdomain
    const response = await fetch('/api/provision-tenant', {
      method: 'POST',
      body: JSON.stringify({
        companyName: 'Test Corp 2',
        subdomain: 'carexps', // Already exists
        adminEmail: 'admin2@test.com',
        adminPassword: 'Test123!'
      })
    })

    expect(response.status).toBe(409)
  })
})
```

### **E2E Tests (Playwright)**

```typescript
import { test, expect } from '@playwright/test'

test('self-service signup flow', async ({ page }) => {
  // Visit signup page
  await page.goto('https://signup.yourcrm.com')

  // Fill form
  await page.fill('input[name="companyName"]', 'E2E Test Corp')
  await page.fill('input[name="subdomain"]', 'e2etest')
  await page.fill('input[name="adminEmail"]', 'admin@e2etest.com')
  await page.fill('input[name="adminPassword"]', 'E2ETest123!')

  // Submit
  await page.click('button[type="submit"]')

  // Should redirect to tenant subdomain
  await expect(page).toHaveURL(/e2etest\.yourcrm\.com/)

  // Should be logged in
  await expect(page.locator('text=Dashboard')).toBeVisible()
})
```

---

## **Deployment Plan**

### **Phase 1: Staging Deployment**

```bash
# 1. Deploy to staging environment
git checkout -b multi-tenant-staging
git push origin multi-tenant-staging

# 2. Run database migrations
npx supabase db push --staging

# 3. Test thoroughly on staging
# - Create test tenants
# - Verify isolation
# - Test billing flows

# 4. Monitor for issues
```

### **Phase 2: Production Rollout**

```bash
# 1. Backup production database
npx supabase db dump --production > backup.sql

# 2. Run migrations during maintenance window
npx supabase db push --production

# 3. Deploy code
git checkout main
git merge multi-tenant-staging
git push origin main

# 4. Verify existing tenants work
# - Test CareXPS
# - Test MedEx
# - Verify data isolation

# 5. Enable public signup
# - Update DNS for signup.yourcrm.com
# - Monitor provisioning API
```

### **Rollback Plan**

```bash
# If issues occur:
# 1. Restore database from backup
psql < backup.sql

# 2. Revert code deployment
git revert <commit-hash>
git push origin main --force

# 3. Verify tenants are functional
```

---

## **Monitoring & Maintenance**

### **Key Metrics to Monitor**

```typescript
// Track important metrics
export const trackMetrics = {
  // Tenant metrics
  newTenantSignups: 0,
  activeTenants: 0,
  suspendedTenants: 0,

  // Performance
  averageProvisioningTime: 0,
  apiResponseTime: 0,

  // Revenue
  mrr: 0, // Monthly Recurring Revenue
  churnRate: 0,

  // Usage
  storagePerTenant: {},
  apiCallsPerTenant: {}
}
```

### **Automated Alerts**

```typescript
// Alert on critical events
const sendAlert = async (event: string, data: any) => {
  // Send to Slack, email, etc.
  console.log(`🚨 ALERT: ${event}`, data)
}

// Examples:
// - New tenant created
// - Tenant suspended (payment failed)
// - Usage limit exceeded
// - API errors
```

### **Regular Maintenance**

```typescript
// Cron jobs for cleanup and optimization
export const maintenanceTasks = {
  // Daily: Clean up expired trial tenants
  cleanupExpiredTrials: async () => {
    const { data: expiredTenants } = await supabase
      .from('tenants')
      .select('*')
      .eq('plan_type', 'free')
      .lt('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))

    // Notify or suspend
  },

  // Weekly: Generate usage reports
  generateUsageReports: async () => {
    // Per-tenant usage analytics
  },

  // Monthly: Audit tenant isolation
  auditTenantIsolation: async () => {
    // Verify no cross-tenant data leakage
  }
}
```

---

## **Cost Analysis**

### **Infrastructure Costs (Estimated)**

```
Supabase Pro Plan:         $25/month (up to 100GB storage)
Azure Static Web Apps:     $9/month (per instance)
Stripe:                    2.9% + $0.30 per transaction
SendGrid/Resend:          Free tier (10k emails/month)

Total Base Cost:          ~$35/month
```

### **Revenue Model**

```
Free Plan:        $0/month (5 users, 10GB)
Starter Plan:     $49/month (10 users, 50GB)
Professional:     $99/month (50 users, 200GB)
Enterprise:       $249/month (unlimited users, 1TB)

Break-even:       1 Starter customer
Profit at:        5 customers = $245/month profit
                  10 customers = $525/month profit
                  50 customers = $2,925/month profit
                  100 customers = $6,425/month profit
```

---

## **Next Steps After Implementation**

1. **Marketing Site**
   - Build landing page at `yourcrm.com`
   - Feature comparison
   - Customer testimonials
   - SEO optimization

2. **Documentation**
   - User guides
   - API documentation
   - Video tutorials
   - FAQ

3. **Customer Support**
   - Support ticketing system
   - Knowledge base
   - Live chat (Intercom, Crisp)

4. **Sales Tools**
   - Demo environment
   - Sales deck
   - ROI calculator

5. **Product Improvements**
   - Feature requests from customers
   - A/B testing
   - Performance optimization
   - Mobile app

---

## **Conclusion**

This implementation plan transforms your healthcare CRM from a manually-provisioned system into a fully automated, scalable SaaS platform. The phased approach ensures:

- ✅ Minimal disruption to existing tenants
- ✅ Solid foundation for growth
- ✅ Enterprise-ready features
- ✅ Sustainable revenue model

**Estimated Timeline:**
- MVP (Phases 1-3): 6 weeks
- Full Implementation (Phases 1-5): 12 weeks
- Production Ready: 14 weeks (including testing)

**When you're ready to implement this, feed this document back to Claude Code and say:**

> "I'm ready to implement the multi-tenant self-service system. Start with Phase 1: Foundation."

Good luck! 🚀
