/**
 * Invoice History Service
 *
 * Manages invoice history with Supabase for cross-device access
 * Falls back to localStorage when offline
 */

import { supabase } from '@/config/supabase'

export interface InvoiceHistoryRecord {
  id?: string
  user_id?: string
  invoice_id: string
  customer_id?: string
  customer_email: string
  customer_name: string

  // Invoice period
  period_start?: Date | string
  period_end?: Date | string
  invoice_month?: string
  date_range?: string // For UI display

  // Cost breakdown
  call_count?: number
  call_cost_cad?: number
  sms_count?: number
  sms_segments?: number
  sms_cost_cad?: number
  total_cost_cad: number

  // Invoice status
  invoice_status?: string
  invoice_url?: string

  // Generation details
  generated_at?: Date | string
  generated_by?: string
  sent_at?: Date | string
  paid_at?: Date | string

  // Retry tracking
  retry_count?: number
  last_retry_at?: Date | string
  error_message?: string

  // Automatic vs manual
  generated_automatically?: boolean

  // Metadata
  created_at?: Date | string
  updated_at?: Date | string

  // Legacy fields for backward compatibility
  timestamp?: string
  amount?: string
}

class InvoiceHistoryService {
  private readonly TABLE_NAME = 'invoice_history'
  private readonly LOCALSTORAGE_KEY = 'invoice_history'
  private isOnline = true

  /**
   * Create a new invoice record
   */
  async createInvoice(invoice: InvoiceHistoryRecord): Promise<{
    success: boolean
    data?: InvoiceHistoryRecord
    error?: string
  }> {
    try {
      if (!supabase) {
        console.warn('⚠️ Supabase client not available, saving to localStorage')
        return this.createInvoiceLocally(invoice)
      }

      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        console.warn('⚠️ User not authenticated, saving to localStorage')
        return this.createInvoiceLocally(invoice)
      }

      // Prepare invoice data for database
      const dbInvoice = {
        user_id: user.id,
        invoice_id: invoice.invoice_id,
        customer_id: invoice.customer_id || '',
        customer_email: invoice.customer_email,
        customer_name: invoice.customer_name,
        period_start: invoice.period_start || new Date(),
        period_end: invoice.period_end || new Date(),
        invoice_month: invoice.invoice_month || this.getCurrentMonth(),
        call_count: invoice.call_count || 0,
        call_cost_cad: invoice.call_cost_cad || 0,
        sms_count: invoice.sms_count || 0,
        sms_segments: invoice.sms_segments || 0,
        sms_cost_cad: invoice.sms_cost_cad || 0,
        total_cost_cad: invoice.total_cost_cad,
        invoice_status: invoice.invoice_status || 'finalized',
        invoice_url: invoice.invoice_url || '',
        generated_at: invoice.generated_at || new Date().toISOString(),
        sent_at: invoice.sent_at,
        paid_at: invoice.paid_at,
        retry_count: invoice.retry_count || 0,
        last_retry_at: invoice.last_retry_at,
        error_message: invoice.error_message,
        generated_automatically: invoice.generated_automatically || false
      }

      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .insert([dbInvoice])
        .select()
        .single()

      if (error) {
        console.error('Failed to create invoice in Supabase:', error)
        // Fallback to localStorage
        return this.createInvoiceLocally(invoice)
      }

      console.log('✅ Invoice saved to Supabase:', data.id)

      // Also save to localStorage for offline access
      this.saveToLocalStorageCache(data)

      return {
        success: true,
        data
      }

    } catch (error) {
      console.error('Error creating invoice:', error)
      return this.createInvoiceLocally(invoice)
    }
  }

  /**
   * Get all invoices for current user
   */
  async getInvoices(): Promise<{
    success: boolean
    data?: InvoiceHistoryRecord[]
    error?: string
  }> {
    try {
      if (!supabase) {
        console.warn('⚠️ Supabase client not available, reading from localStorage')
        return this.getInvoicesLocally()
      }

      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        console.warn('⚠️ User not authenticated, falling back to localStorage')
        return this.getInvoicesLocally()
      }

      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .select('*')
        .eq('user_id', user.id)
        .order('generated_at', { ascending: false })

      if (error) {
        console.error('Failed to fetch invoices from Supabase:', error)
        return this.getInvoicesLocally()
      }

      console.log(`✅ Loaded ${data.length} invoices from Supabase`)

      // Update localStorage cache
      localStorage.setItem(this.LOCALSTORAGE_KEY, JSON.stringify(data))

      return {
        success: true,
        data
      }

    } catch (error) {
      console.error('Error fetching invoices:', error)
      return this.getInvoicesLocally()
    }
  }

  /**
   * Get invoice by ID
   */
  async getInvoiceById(id: string): Promise<{
    success: boolean
    data?: InvoiceHistoryRecord
    error?: string
  }> {
    try {
      if (!supabase) {
        return this.getInvoiceByIdLocally(id)
      }

      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        console.error('Failed to fetch invoice:', error)
        return this.getInvoiceByIdLocally(id)
      }

      return {
        success: true,
        data
      }

    } catch (error) {
      console.error('Error fetching invoice:', error)
      return this.getInvoiceByIdLocally(id)
    }
  }

  /**
   * Update invoice status
   */
  async updateInvoiceStatus(
    id: string,
    status: string,
    metadata?: Partial<InvoiceHistoryRecord>
  ): Promise<{
    success: boolean
    data?: InvoiceHistoryRecord
    error?: string
  }> {
    try {
      if (!supabase) {
        return {
          success: false,
          error: 'Supabase client not available'
        }
      }

      const updateData: any = {
        invoice_status: status,
        ...metadata
      }

      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('Failed to update invoice:', error)
        return {
          success: false,
          error: error.message
        }
      }

      console.log('✅ Invoice status updated:', id, status)

      return {
        success: true,
        data
      }

    } catch (error) {
      console.error('Error updating invoice:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Delete invoice
   */
  async deleteInvoice(id: string): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      if (!supabase) {
        return this.deleteInvoiceLocally(id)
      }

      const { error } = await supabase
        .from(this.TABLE_NAME)
        .delete()
        .eq('id', id)

      if (error) {
        console.error('Failed to delete invoice:', error)
        return this.deleteInvoiceLocally(id)
      }

      console.log('✅ Invoice deleted:', id)

      // Also remove from localStorage cache
      const localData = this.getLocalStorageData()
      const filtered = localData.filter(inv => inv.id !== id)
      localStorage.setItem(this.LOCALSTORAGE_KEY, JSON.stringify(filtered))

      return {
        success: true
      }

    } catch (error) {
      console.error('Error deleting invoice:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Clear all invoices (admin function)
   */
  async clearAllInvoices(): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      if (!supabase) {
        localStorage.removeItem(this.LOCALSTORAGE_KEY)
        return { success: true }
      }

      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        return {
          success: false,
          error: 'User not authenticated'
        }
      }

      const { error } = await supabase
        .from(this.TABLE_NAME)
        .delete()
        .eq('user_id', user.id)

      if (error) {
        console.error('Failed to clear invoices:', error)
        return {
          success: false,
          error: error.message
        }
      }

      console.log('✅ All invoices cleared from Supabase')
      localStorage.removeItem(this.LOCALSTORAGE_KEY)

      return {
        success: true
      }

    } catch (error) {
      console.error('Error clearing invoices:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // ============================================================================
  // LOCALSTORAGE FALLBACK METHODS
  // ============================================================================

  private createInvoiceLocally(invoice: InvoiceHistoryRecord): {
    success: boolean
    data?: InvoiceHistoryRecord
    error?: string
  } {
    try {
      const localData = this.getLocalStorageData()

      const newInvoice: InvoiceHistoryRecord = {
        ...invoice,
        id: invoice.id || this.generateLocalId(),
        created_at: new Date().toISOString()
      }

      localData.unshift(newInvoice)

      // Keep only last 100
      const trimmed = localData.slice(0, 100)
      localStorage.setItem(this.LOCALSTORAGE_KEY, JSON.stringify(trimmed))

      console.log('✅ Invoice saved to localStorage:', newInvoice.id)

      return {
        success: true,
        data: newInvoice
      }
    } catch (error) {
      console.error('Failed to save invoice locally:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  private getInvoicesLocally(): {
    success: boolean
    data?: InvoiceHistoryRecord[]
    error?: string
  } {
    try {
      const data = this.getLocalStorageData()
      console.log(`✅ Loaded ${data.length} invoices from localStorage`)

      return {
        success: true,
        data
      }
    } catch (error) {
      console.error('Failed to load invoices from localStorage:', error)
      return {
        success: true,
        data: []
      }
    }
  }

  private getInvoiceByIdLocally(id: string): {
    success: boolean
    data?: InvoiceHistoryRecord
    error?: string
  } {
    try {
      const data = this.getLocalStorageData()
      const invoice = data.find(inv => inv.id === id || inv.invoice_id === id)

      if (!invoice) {
        return {
          success: false,
          error: 'Invoice not found'
        }
      }

      return {
        success: true,
        data: invoice
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  private deleteInvoiceLocally(id: string): {
    success: boolean
    error?: string
  } {
    try {
      const data = this.getLocalStorageData()
      const filtered = data.filter(inv => inv.id !== id && inv.invoice_id !== id)
      localStorage.setItem(this.LOCALSTORAGE_KEY, JSON.stringify(filtered))

      console.log('✅ Invoice deleted from localStorage:', id)

      return {
        success: true
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  private getLocalStorageData(): InvoiceHistoryRecord[] {
    try {
      const stored = localStorage.getItem(this.LOCALSTORAGE_KEY)
      return stored ? JSON.parse(stored) : []
    } catch (error) {
      console.error('Failed to parse localStorage data:', error)
      return []
    }
  }

  private saveToLocalStorageCache(invoice: InvoiceHistoryRecord): void {
    try {
      const data = this.getLocalStorageData()
      data.unshift(invoice)
      const trimmed = data.slice(0, 100)
      localStorage.setItem(this.LOCALSTORAGE_KEY, JSON.stringify(trimmed))
    } catch (error) {
      console.error('Failed to cache invoice in localStorage:', error)
    }
  }

  private generateLocalId(): string {
    return `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private getCurrentMonth(): string {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  }
}

// Export singleton instance
export const invoiceHistoryService = new InvoiceHistoryService()
export default invoiceHistoryService
