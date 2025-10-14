import React, { useState, useEffect } from 'react'
import { FileText, ExternalLink, Download, Trash2, Calendar, DollarSign, User, Mail, RefreshCw } from 'lucide-react'
import { invoiceHistoryService, InvoiceHistoryRecord } from '@/services/invoiceHistoryService'

interface InvoiceRecord extends InvoiceHistoryRecord {
  invoiceId?: string
  timestamp?: string
  amount?: string
  generatedBy?: string
  dateRange?: string
}

const InvoiceHistorySettings: React.FC = () => {
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([])
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRecord | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load invoice history from Supabase
  useEffect(() => {
    loadInvoiceHistory()
  }, [])

  const loadInvoiceHistory = async () => {
    setLoading(true)
    setError(null)

    try {
      const result = await invoiceHistoryService.getInvoices()

      if (result.success && result.data) {
        // Map database records to component format
        const mappedInvoices = result.data.map(invoice => ({
          ...invoice,
          invoiceId: invoice.invoice_id,
          timestamp: invoice.generated_at || invoice.created_at || new Date().toISOString(),
          amount: invoice.amount || `CAD $${invoice.total_cost_cad?.toFixed(2) || '0.00'}`,
          generatedBy: invoice.generated_by || 'Unknown',
          dateRange: invoice.date_range || invoice.invoice_month || 'N/A',
          email: invoice.customer_email,
          customerName: invoice.customer_name
        }))

        setInvoices(mappedInvoices)
        console.log(`✅ Loaded ${mappedInvoices.length} invoices from Supabase`)
      } else {
        // Don't show error for authentication issues (normal during logout)
        if (result.error && !result.error.includes('authenticated')) {
          setError(result.error)
        }
        setInvoices([])
      }
    } catch (error) {
      console.error('Failed to load invoice history:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      // Don't show error for authentication issues
      if (!errorMessage.includes('authenticated')) {
        setError(errorMessage)
      }
      setInvoices([])
    } finally {
      setLoading(false)
    }
  }

  const deleteInvoice = async (id: string) => {
    if (!confirm('Are you sure you want to delete this invoice record? This will remove it from Supabase (and all devices), but not from Stripe.')) {
      return
    }

    try {
      const result = await invoiceHistoryService.deleteInvoice(id)

      if (result.success) {
        // Remove from local state
        const updatedHistory = invoices.filter(inv => inv.id !== id && inv.invoice_id !== id)
        setInvoices(updatedHistory)
        setSelectedInvoice(null)
        console.log('✅ Invoice deleted:', id)
      } else {
        alert(`Failed to delete invoice: ${result.error}`)
      }
    } catch (error) {
      console.error('Failed to delete invoice:', error)
      alert('Failed to delete invoice')
    }
  }

  const clearAllHistory = async () => {
    if (!confirm('Are you sure you want to clear ALL invoice history? This will remove all invoices from Supabase (and all devices). This cannot be undone.')) {
      return
    }

    try {
      const result = await invoiceHistoryService.clearAllInvoices()

      if (result.success) {
        setInvoices([])
        setSelectedInvoice(null)
        console.log('✅ All invoice history cleared')
      } else {
        alert(`Failed to clear invoice history: ${result.error}`)
      }
    } catch (error) {
      console.error('Failed to clear invoice history:', error)
      alert('Failed to clear invoice history')
    }
  }

  const exportHistory = () => {
    try {
      const dataStr = JSON.stringify(invoices, null, 2)
      const dataBlob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(dataBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = `invoice-history-${new Date().toISOString().split('T')[0]}.json`
      link.click()
      URL.revokeObjectURL(url)
      console.log('📥 Invoice history exported')
    } catch (error) {
      console.error('Failed to export invoice history:', error)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Invoice History</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {loading ? 'Loading invoices from Supabase...' : 'View and manage all generated invoices (synced across devices)'}
          </p>
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">
              ⚠️ {error}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadInvoiceHistory}
            disabled={loading}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
            title="Refresh from Supabase"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={exportHistory}
            disabled={invoices.length === 0 || loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={clearAllHistory}
            disabled={invoices.length === 0 || loading}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Clear All
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-600 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-blue-600" />
            <div>
              <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">{invoices.length}</div>
              <div className="text-xs text-blue-700 dark:text-blue-300">Total Invoices</div>
            </div>
          </div>
        </div>

        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-600 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-green-600" />
            <div>
              <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                {invoices.length > 0
                  ? invoices.reduce((sum, inv) => {
                      // Try to get amount from different fields
                      const amountStr = inv.amount || `${inv.total_cost_cad || 0}`
                      const amount = parseFloat(amountStr.toString().replace(/[^0-9.-]+/g, ''))
                      return sum + (isNaN(amount) ? 0 : amount)
                    }, 0).toFixed(2)
                  : '0.00'}
              </div>
              <div className="text-xs text-green-700 dark:text-green-300">Total Amount (CAD)</div>
            </div>
          </div>
        </div>

        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-600 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Calendar className="w-8 h-8 text-purple-600" />
            <div>
              <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                {invoices.length > 0
                  ? new Date(invoices[0].timestamp).toLocaleDateString()
                  : 'N/A'}
              </div>
              <div className="text-xs text-purple-700 dark:text-purple-300">Last Invoice</div>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice List */}
      {invoices.length === 0 ? (
        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
          <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Invoices Yet</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Generated invoices will appear here. Create your first invoice from the Dashboard.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Period
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Generated By
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {invoices.map((invoice) => (
                  <tr
                    key={invoice.invoiceId}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                    onClick={() => setSelectedInvoice(selectedInvoice?.invoiceId === invoice.invoiceId ? null : invoice)}
                  >
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                      {new Date(invoice.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {invoice.customerName}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {invoice.email}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-green-600 dark:text-green-400">
                      {invoice.amount}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {invoice.dateRange}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {invoice.generatedBy}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {invoice.invoiceUrl && (
                          <a
                            href={invoice.invoiceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="p-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                            title="View in Stripe"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteInvoice(invoice.id || invoice.invoice_id)
                          }}
                          className="p-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invoice Details Panel */}
      {selectedInvoice && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-600 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Invoice Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-blue-700 dark:text-blue-300 mb-1">Invoice ID</div>
              <div className="text-sm font-mono text-blue-900 dark:text-blue-100 break-all">
                {selectedInvoice.invoiceId}
              </div>
            </div>
            <div>
              <div className="text-xs text-blue-700 dark:text-blue-300 mb-1">Generated</div>
              <div className="text-sm text-blue-900 dark:text-blue-100">
                {new Date(selectedInvoice.timestamp).toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-xs text-blue-700 dark:text-blue-300 mb-1 flex items-center gap-1">
                <User className="w-3 h-3" />
                Customer Name
              </div>
              <div className="text-sm text-blue-900 dark:text-blue-100">
                {selectedInvoice.customerName}
              </div>
            </div>
            <div>
              <div className="text-xs text-blue-700 dark:text-blue-300 mb-1 flex items-center gap-1">
                <Mail className="w-3 h-3" />
                Customer Email
              </div>
              <div className="text-sm text-blue-900 dark:text-blue-100">
                {selectedInvoice.email}
              </div>
            </div>
            <div>
              <div className="text-xs text-blue-700 dark:text-blue-300 mb-1 flex items-center gap-1">
                <DollarSign className="w-3 h-3" />
                Amount
              </div>
              <div className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                {selectedInvoice.amount}
              </div>
            </div>
            <div>
              <div className="text-xs text-blue-700 dark:text-blue-300 mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Billing Period
              </div>
              <div className="text-sm text-blue-900 dark:text-blue-100">
                {selectedInvoice.dateRange}
              </div>
            </div>
            <div className="md:col-span-2">
              <div className="text-xs text-blue-700 dark:text-blue-300 mb-1 flex items-center gap-1">
                <User className="w-3 h-3" />
                Generated By
              </div>
              <div className="text-sm text-blue-900 dark:text-blue-100">
                {selectedInvoice.generatedBy}
              </div>
            </div>
            {selectedInvoice.invoiceUrl && (
              <div className="md:col-span-2">
                <a
                  href={selectedInvoice.invoiceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <ExternalLink className="w-4 h-4" />
                  View Invoice in Stripe
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default InvoiceHistorySettings
