/**
 * Stripe Invoice Service
 *
 * Generates Stripe invoices based on Combined Service costs (Calls + SMS)
 * Supports manual and automatic monthly invoice generation
 */

import Stripe from 'stripe'
import { retellService, currencyService, twilioCostService, chatService } from './index'

interface InvoiceLineItem {
  description: string
  quantity: number
  unit_amount_cents: number // Amount in cents
  amount_total: number // Total in dollars
}

interface InvoiceData {
  dateRange: {
    start: Date
    end: Date
    label: string
  }
  callCosts: {
    totalCalls: number
    totalCostCAD: number
    items: InvoiceLineItem[]
  }
  smsCosts: {
    totalChats: number
    totalSegments: number
    totalCostCAD: number
    items: InvoiceLineItem[]
  }
  combinedTotal: number
  currency: 'cad'
}

interface StripeCustomerInfo {
  email: string
  name: string
  description?: string
}

interface CreateInvoiceOptions {
  customerInfo: StripeCustomerInfo
  dateRange: {
    start: Date
    end: Date
    label?: string
  }
  sendImmediately?: boolean
  autoFinalize?: boolean
  dueDate?: Date
  preCalculatedMetrics?: {
    callCostCAD: number
    smsCostCAD: number
    totalCalls: number
    totalChats: number
    totalSegments: number
  }
}

class StripeInvoiceService {
  private stripe: Stripe | null = null
  private isInitialized = false

  /**
   * Initialize Stripe with API key from environment or settings
   */
  public async initialize(apiKey?: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Try to get API key from parameter, environment, or user settings
      let stripeKey = apiKey

      if (!stripeKey) {
        // Check environment variables
        stripeKey = import.meta.env.VITE_STRIPE_SECRET_KEY
      }

      if (!stripeKey) {
        // Check user settings in localStorage
        try {
          const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}')
          if (currentUser.id) {
            const settings = JSON.parse(localStorage.getItem(`settings_${currentUser.id}`) || '{}')
            stripeKey = settings.stripeSecretKey
          }
        } catch (error) {
          console.error('Failed to load Stripe key from settings:', error)
        }
      }

      if (!stripeKey) {
        return {
          success: false,
          error: 'Stripe API key not configured. Please add VITE_STRIPE_SECRET_KEY to environment or configure in Settings.'
        }
      }

      // Initialize Stripe client
      this.stripe = new Stripe(stripeKey, {
        apiVersion: '2024-11-20.acacia',
        typescript: true
      })

      this.isInitialized = true

      // Log audit event (optional - don't fail if audit fails)
      try {
        console.log('Stripe service initialized successfully')
      } catch (auditError) {
        console.warn('Failed to log Stripe initialization, continuing anyway:', auditError)
      }

      return { success: true }
    } catch (error) {
      console.error('Failed to initialize Stripe:', error)

      // Try to log error (optional - don't fail if audit fails)
      try {
        console.error('Stripe initialization failed:', error)
      } catch (auditError) {
        console.warn('Failed to log Stripe error, continuing anyway:', auditError)
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to initialize Stripe'
      }
    }
  }

  /**
   * Check if Stripe is initialized and ready
   */
  public isConfigured(): boolean {
    return this.isInitialized && this.stripe !== null
  }

  /**
   * Calculate invoice data for a given date range
   */
  public async calculateInvoiceData(startDate: Date, endDate: Date): Promise<InvoiceData> {
    try {
      // Convert dates to timestamps
      const startMs = startDate.getTime()
      const endMs = endDate.getTime()

      // Fetch all calls and chats
      const [allCalls, allChatsResponse] = await Promise.all([
        retellService.getAllCalls(),
        chatService.getChatHistory({ limit: 500 })
      ])

      // Filter calls by date range
      const filteredCalls = allCalls.filter(call => {
        const callTimeMs = call.start_timestamp.toString().length <= 10
          ? call.start_timestamp * 1000
          : call.start_timestamp
        return callTimeMs >= startMs && callTimeMs <= endMs
      })

      console.log('📊 Stripe Invoice - Filtered calls:', {
        totalCalls: allCalls.length,
        filteredCalls: filteredCalls.length,
        dateRange: `${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`,
        startMs,
        endMs
      })

      // Filter chats by date range
      const filteredChats = allChatsResponse.chats.filter(chat => {
        const chatTimeMs = chat.start_timestamp.toString().length <= 10
          ? chat.start_timestamp * 1000
          : chat.start_timestamp
        return chatTimeMs >= startMs && chatTimeMs <= endMs
      })

      // Calculate call costs (Retell AI + Twilio)
      let totalCallCostCAD = 0
      const callItems: InvoiceLineItem[] = []

      for (const call of filteredCalls) {
        // Retell AI cost
        const retellCostCents = call.call_cost?.combined_cost || 0
        const retellCostUSD = retellCostCents / 100
        const retellCostCAD = currencyService.convertUSDToCAD(retellCostUSD)

        // Twilio voice cost
        const twilioCostCAD = twilioCostService.getTwilioCostCAD(call.call_length_seconds || 0)

        const totalCallCost = retellCostCAD + twilioCostCAD
        totalCallCostCAD += totalCallCost
      }

      // Add consolidated call line item
      if (filteredCalls.length > 0) {
        const callItem = {
          description: `Voice Calls (${filteredCalls.length} calls)`,
          quantity: filteredCalls.length,
          unit_amount_cents: Math.round((totalCallCostCAD / filteredCalls.length) * 100),
          amount_total: totalCallCostCAD
        }
        callItems.push(callItem)
        console.log('📊 Stripe Invoice - Call line item created:', callItem)
      } else {
        console.log('⚠️ Stripe Invoice - No calls in date range, skipping call line item')
      }

      // Calculate SMS costs (Retell AI Chat + Twilio SMS)
      let totalSMSCostCAD = 0
      let totalRetellChatCostCAD = 0
      let totalTwilioSMSCostCAD = 0
      let totalSegments = 0
      const smsItems: InvoiceLineItem[] = []

      for (const chat of filteredChats) {
        const messages = chat.message_with_tool_calls || []
        if (messages.length > 0) {
          // Get Retell AI chat cost from API response - combined_cost is in cents
          const retellChatCostCents = chat.chat_cost?.combined_cost || 0

          // Calculate COMPLETE SMS cost (Retell + Twilio)
          const completeCost = twilioCostService.calculateCompleteSMSCost(messages, retellChatCostCents)

          totalRetellChatCostCAD += completeCost.retellChatCostCAD
          totalTwilioSMSCostCAD += completeCost.twilioSMSCostCAD
          totalSMSCostCAD += completeCost.totalCostCAD
          totalSegments += completeCost.segmentCount
        }
      }

      // Add consolidated SMS line item showing both costs
      if (filteredChats.length > 0) {
        const smsItem = {
          description: `SMS Conversations (${filteredChats.length} chats) - Retell AI Chat: CAD $${totalRetellChatCostCAD.toFixed(2)} + Twilio SMS (${totalSegments} segments): CAD $${totalTwilioSMSCostCAD.toFixed(2)}`,
          quantity: filteredChats.length,
          unit_amount_cents: Math.round((totalSMSCostCAD / filteredChats.length) * 100),
          amount_total: totalSMSCostCAD
        }
        smsItems.push(smsItem)
        console.log('📊 Stripe Invoice - SMS line item created:', smsItem)
      } else {
        console.log('⚠️ Stripe Invoice - No chats in date range, skipping SMS line item')
      }

      console.log('📊 Stripe Invoice - Final line items:', {
        callItems: callItems.length,
        smsItems: smsItems.length,
        totalItems: callItems.length + smsItems.length,
        combinedTotal: totalCallCostCAD + totalSMSCostCAD
      })

      return {
        dateRange: {
          start: startDate,
          end: endDate,
          label: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
        },
        callCosts: {
          totalCalls: filteredCalls.length,
          totalCostCAD: totalCallCostCAD,
          items: callItems
        },
        smsCosts: {
          totalChats: filteredChats.length,
          totalSegments,
          totalCostCAD: totalSMSCostCAD,
          items: smsItems
        },
        combinedTotal: totalCallCostCAD + totalSMSCostCAD,
        currency: 'cad'
      }
    } catch (error) {
      console.error('Failed to calculate invoice data:', error)
      throw error
    }
  }

  /**
   * Create or retrieve Stripe customer
   */
  private async getOrCreateCustomer(customerInfo: StripeCustomerInfo): Promise<string> {
    if (!this.stripe) {
      throw new Error('Stripe not initialized')
    }

    try {
      // Search for existing customer by email
      const existingCustomers = await this.stripe.customers.list({
        email: customerInfo.email,
        limit: 1
      })

      if (existingCustomers.data.length > 0) {
        return existingCustomers.data[0].id
      }

      // Create new customer
      const newCustomer = await this.stripe.customers.create({
        email: customerInfo.email,
        name: customerInfo.name,
        description: customerInfo.description || 'CareXPS Healthcare CRM Customer'
      })

      return newCustomer.id
    } catch (error) {
      console.error('Failed to get or create Stripe customer:', error)
      throw error
    }
  }

  /**
   * Create a Stripe invoice
   */
  public async createInvoice(options: CreateInvoiceOptions): Promise<{
    success: boolean
    invoiceId?: string
    invoiceUrl?: string
    error?: string
  }> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'Stripe not initialized. Please configure Stripe API key first.'
      }
    }

    try {
      // Use pre-calculated metrics if provided (more accurate), otherwise calculate
      let invoiceData: InvoiceData

      if (options.preCalculatedMetrics) {
        console.log('📊 Stripe Invoice - Using pre-calculated metrics from Dashboard:', options.preCalculatedMetrics)

        // Build invoice data from pre-calculated metrics
        const { callCostCAD, smsCostCAD, totalCalls, totalChats, totalSegments } = options.preCalculatedMetrics

        invoiceData = {
          dateRange: {
            start: options.dateRange.start,
            end: options.dateRange.end,
            label: options.dateRange.label || `${options.dateRange.start.toLocaleDateString()} - ${options.dateRange.end.toLocaleDateString()}`
          },
          callCosts: {
            totalCalls,
            totalCostCAD: callCostCAD,
            items: totalCalls > 0 ? [{
              description: `Voice Calls (${totalCalls} calls)`,
              quantity: totalCalls,
              unit_amount_cents: Math.round((callCostCAD / totalCalls) * 100),
              amount_total: callCostCAD
            }] : []
          },
          smsCosts: {
            totalChats,
            totalSegments,
            totalCostCAD: smsCostCAD,
            items: totalChats > 0 ? [{
              description: `SMS Conversations (${totalChats} chats, ${totalSegments} segments)`,
              quantity: totalChats,
              unit_amount_cents: Math.round((smsCostCAD / totalChats) * 100),
              amount_total: smsCostCAD
            }] : []
          },
          combinedTotal: callCostCAD + smsCostCAD,
          currency: 'cad'
        }
      } else {
        // Calculate invoice data from scratch
        console.log('📊 Stripe Invoice - Calculating metrics from scratch (no pre-calculated data provided)')
        invoiceData = await this.calculateInvoiceData(
          options.dateRange.start,
          options.dateRange.end
        )
      }

      // Check if there are any charges
      if (invoiceData.combinedTotal <= 0) {
        return {
          success: false,
          error: 'No charges found for the selected date range'
        }
      }

      // Get or create customer
      const customerId = await this.getOrCreateCustomer(options.customerInfo)
      const stripe = this.stripe!

      // Create the invoice FIRST
      console.log('📊 Stripe Invoice - Creating invoice...')
      const invoice = await stripe.invoices.create({
        customer: customerId,
        auto_advance: options.autoFinalize !== false,
        collection_method: 'send_invoice',
        days_until_due: options.dueDate
          ? Math.ceil((options.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : 30,
        description: `CareXPS Services - ${options.dateRange.label || invoiceData.dateRange.label}`,
        metadata: {
          service: 'CareXPS Healthcare CRM',
          date_range_start: options.dateRange.start.toISOString(),
          date_range_end: options.dateRange.end.toISOString(),
          total_calls: invoiceData.callCosts.totalCalls.toString(),
          total_chats: invoiceData.smsCosts.totalChats.toString(),
          total_segments: invoiceData.smsCosts.totalSegments.toString()
        }
      })

      console.log('✅ Stripe Invoice - Invoice created:', invoice.id)

      // Now add invoice items directly to this specific invoice
      console.log('📊 Stripe Invoice - Adding line items to invoice...', {
        callItemsCount: invoiceData.callCosts.items.length,
        smsItemsCount: invoiceData.smsCosts.items.length
      })

      // Add call costs
      for (const item of invoiceData.callCosts.items) {
        const invoiceItem = await stripe.invoiceItems.create({
          customer: customerId,
          invoice: invoice.id, // Attach directly to this invoice
          amount: Math.round(item.amount_total * 100), // Convert to cents
          currency: 'cad',
          description: item.description
        })
        console.log('✅ Stripe Invoice - Added call line item:', {
          id: invoiceItem.id,
          amount: invoiceItem.amount,
          currency: invoiceItem.currency,
          description: invoiceItem.description
        })
      }

      // Add SMS costs
      for (const item of invoiceData.smsCosts.items) {
        const invoiceItem = await stripe.invoiceItems.create({
          customer: customerId,
          invoice: invoice.id, // Attach directly to this invoice
          amount: Math.round(item.amount_total * 100), // Convert to cents
          currency: 'cad',
          description: item.description
        })
        console.log('✅ Stripe Invoice - Added SMS line item:', {
          id: invoiceItem.id,
          amount: invoiceItem.amount,
          currency: invoiceItem.currency,
          description: invoiceItem.description
        })
      }

      console.log('📊 Stripe Invoice - All line items added to invoice')

      // ALWAYS finalize the invoice to get the hosted URL
      // Finalize but DON'T send (we're handling email with PDF ourselves)
      console.log('📊 Stripe Invoice - Finalizing invoice to generate hosted URL...')
      const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id)
      console.log('✅ Stripe Invoice - Invoice finalized:', {
        id: finalizedInvoice.id,
        status: finalizedInvoice.status,
        hosted_invoice_url: finalizedInvoice.hosted_invoice_url
      })

      // Only send Stripe's email if explicitly requested (we're handling email ourselves)
      if (options.sendImmediately) {
        await stripe.invoices.sendInvoice(finalizedInvoice.id)
        console.log('📧 Stripe Invoice - Email sent via Stripe')
      } else {
        console.log('📧 Stripe Invoice - Skipping Stripe email (handled by EmailJS)')
      }

      // Log audit event (optional - don't fail if audit fails)
      try {
        console.log('Stripe invoice created:', {
          invoiceId: finalizedInvoice.id,
          customerId,
          totalAmount: invoiceData.combinedTotal,
          currency: 'CAD',
          dateRange: invoiceData.dateRange.label,
          sentImmediately: options.sendImmediately || false,
          hostedUrl: finalizedInvoice.hosted_invoice_url
        })
      } catch (auditError) {
        console.warn('Failed to log invoice creation, continuing anyway:', auditError)
      }

      return {
        success: true,
        invoiceId: finalizedInvoice.id,
        invoiceUrl: finalizedInvoice.hosted_invoice_url || undefined
      }
    } catch (error) {
      console.error('Failed to create Stripe invoice:', error)

      // Try to log error (optional - don't fail if audit fails)
      try {
        console.error('Stripe invoice creation failed:', {
          error: error instanceof Error ? error.message : 'Unknown error',
          customerEmail: options.customerInfo.email
        })
      } catch (auditError) {
        console.warn('Failed to log invoice error, continuing anyway:', auditError)
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create invoice'
      }
    }
  }

  /**
   * Generate automatic monthly invoice
   * Calculates costs for previous month and creates invoice
   */
  public async generateMonthlyInvoice(customerInfo: StripeCustomerInfo): Promise<{
    success: boolean
    invoiceId?: string
    invoiceUrl?: string
    error?: string
  }> {
    // Calculate previous month date range
    const now = new Date()
    const firstDayOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastDayOfPreviousMonth = new Date(firstDayOfCurrentMonth.getTime() - 1)
    const firstDayOfPreviousMonth = new Date(lastDayOfPreviousMonth.getFullYear(), lastDayOfPreviousMonth.getMonth(), 1)

    return this.createInvoice({
      customerInfo,
      dateRange: {
        start: firstDayOfPreviousMonth,
        end: lastDayOfPreviousMonth,
        label: `${firstDayOfPreviousMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}`
      },
      sendImmediately: true,
      autoFinalize: true
    })
  }

  /**
   * Preview invoice data without creating in Stripe
   */
  public async previewInvoice(startDate: Date, endDate: Date): Promise<InvoiceData> {
    return this.calculateInvoiceData(startDate, endDate)
  }

  /**
   * Fetch all invoices from Stripe for a specific customer
   */
  public async fetchAllInvoices(customerEmail?: string, limit: number = 100): Promise<{
    success: boolean
    data?: Array<{
      id: string
      customer_id: string
      customer_email: string
      customer_name: string
      amount_due: number
      amount_paid: number
      amount_remaining: number
      currency: string
      status: string
      paid: boolean
      created: number
      due_date: number | null
      hosted_invoice_url: string | null
      invoice_pdf: string | null
      period_start: number
      period_end: number
      description: string | null
    }>
    error?: string
  }> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'Stripe not initialized. Please configure Stripe API key first.'
      }
    }

    try {
      const stripe = this.stripe!

      // Build query options
      const queryOptions: any = {
        limit,
        expand: ['data.customer']
      }

      // If customer email provided, find customer first
      if (customerEmail) {
        const customers = await stripe.customers.list({
          email: customerEmail,
          limit: 1
        })

        if (customers.data.length === 0) {
          return {
            success: true,
            data: [] // No customer found, return empty array
          }
        }

        queryOptions.customer = customers.data[0].id
      }

      // Fetch invoices from Stripe
      const invoices = await stripe.invoices.list(queryOptions)

      console.log(`✅ Fetched ${invoices.data.length} invoices from Stripe`)

      // Map Stripe invoices to our format
      const mappedInvoices = invoices.data.map(invoice => {
        const customer = invoice.customer as any

        return {
          id: invoice.id,
          customer_id: typeof customer === 'string' ? customer : customer?.id || '',
          customer_email: typeof customer === 'string' ? '' : customer?.email || '',
          customer_name: typeof customer === 'string' ? '' : customer?.name || '',
          amount_due: invoice.amount_due / 100, // Convert from cents to dollars
          amount_paid: invoice.amount_paid / 100,
          amount_remaining: invoice.amount_remaining / 100,
          currency: invoice.currency.toUpperCase(),
          status: invoice.status || 'draft',
          paid: invoice.paid || false,
          created: invoice.created,
          due_date: invoice.due_date,
          hosted_invoice_url: invoice.hosted_invoice_url,
          invoice_pdf: invoice.invoice_pdf,
          period_start: invoice.period_start || invoice.created,
          period_end: invoice.period_end || invoice.created,
          description: invoice.description
        }
      })

      return {
        success: true,
        data: mappedInvoices
      }
    } catch (error) {
      console.error('Failed to fetch invoices from Stripe:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch invoices'
      }
    }
  }

  /**
   * Fetch a single invoice from Stripe by ID
   */
  public async fetchInvoiceById(invoiceId: string): Promise<{
    success: boolean
    data?: any
    error?: string
  }> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'Stripe not initialized. Please configure Stripe API key first.'
      }
    }

    try {
      const stripe = this.stripe!
      const invoice = await stripe.invoices.retrieve(invoiceId, {
        expand: ['customer']
      })

      const customer = invoice.customer as any

      return {
        success: true,
        data: {
          id: invoice.id,
          customer_id: typeof customer === 'string' ? customer : customer?.id || '',
          customer_email: typeof customer === 'string' ? '' : customer?.email || '',
          customer_name: typeof customer === 'string' ? '' : customer?.name || '',
          amount_due: invoice.amount_due / 100,
          amount_paid: invoice.amount_paid / 100,
          amount_remaining: invoice.amount_remaining / 100,
          currency: invoice.currency.toUpperCase(),
          status: invoice.status || 'draft',
          paid: invoice.paid || false,
          created: invoice.created,
          due_date: invoice.due_date,
          hosted_invoice_url: invoice.hosted_invoice_url,
          invoice_pdf: invoice.invoice_pdf,
          period_start: invoice.period_start || invoice.created,
          period_end: invoice.period_end || invoice.created,
          description: invoice.description
        }
      }
    } catch (error) {
      console.error('Failed to fetch invoice from Stripe:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch invoice'
      }
    }
  }
}

// Export singleton instance
export const stripeInvoiceService = new StripeInvoiceService()
export default stripeInvoiceService

// Export types
export type { InvoiceData, InvoiceLineItem, StripeCustomerInfo, CreateInvoiceOptions }
