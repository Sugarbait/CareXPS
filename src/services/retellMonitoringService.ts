/**
 * Retell AI Monitoring Service
 * Polls Retell AI for new calls/SMS and triggers email notifications
 * Also syncs new records to Supabase to enable toast notifications
 */

import { retellService } from './retellService'
import { sendNewCallNotification, sendNewSMSNotification } from './emailNotificationService'
import { supabase } from '@/config/supabase'

class RetellMonitoringService {
  private isMonitoring = false
  private pollInterval: number | null = null
  private lastCheckTime: number = Date.now()
  private seenCallIds = new Set<string>()
  private seenChatIds = new Set<string>()

  // Poll every 2 minutes
  private readonly POLL_INTERVAL = 2 * 60 * 1000

  /**
   * Start monitoring Retell AI for new records
   */
  start(): void {
    if (this.isMonitoring) {
      console.log('📊 Retell monitoring already running')
      return
    }

    console.log('📊 Starting Retell AI monitoring for email notifications...')
    this.isMonitoring = true
    this.lastCheckTime = Date.now()

    // Initial check
    this.checkForNewRecords()

    // Set up polling interval
    this.pollInterval = window.setInterval(() => {
      this.checkForNewRecords()
    }, this.POLL_INTERVAL)
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.pollInterval !== null) {
      clearInterval(this.pollInterval)
      this.pollInterval = null
    }
    this.isMonitoring = false
    console.log('📊 Retell AI monitoring stopped')
  }

  /**
   * Check for new records since last check
   */
  private async checkForNewRecords(): Promise<void> {
    try {
      // Check if Retell AI is configured
      if (!retellService.isConfigured()) {
        console.log('📊 Retell AI not configured, skipping check')
        return
      }

      const now = Date.now()
      const checkWindowStart = new Date(this.lastCheckTime)
      const checkWindowEnd = new Date(now)

      console.log('📊 Checking for new Retell records...', {
        windowStart: checkWindowStart.toISOString(),
        windowEnd: checkWindowEnd.toISOString()
      })

      // Check for new calls
      await this.checkNewCalls(checkWindowStart, checkWindowEnd)

      // Check for new SMS/chats
      await this.checkNewChats(checkWindowStart, checkWindowEnd)

      // Update last check time
      this.lastCheckTime = now

    } catch (error) {
      console.error('📊 Error checking for new records:', error)
    }
  }

  /**
   * Check for new calls
   */
  private async checkNewCalls(startDate: Date, endDate: Date): Promise<void> {
    try {
      const response = await retellService.getCallHistoryByDateRange(startDate, endDate, { limit: 50 })

      if (!response || !response.calls || response.calls.length === 0) {
        console.log('📊 No new calls found')
        return
      }

      // Filter to truly new calls we haven't seen before
      const newCalls = response.calls.filter(call => {
        const callId = call.call_id
        if (this.seenCallIds.has(callId)) {
          return false
        }
        this.seenCallIds.add(callId)
        return true
      })

      if (newCalls.length > 0) {
        console.log(`📊 Found ${newCalls.length} new calls, sending email notification and syncing to Supabase`)

        // Send email notification
        try {
          sendNewCallNotification(newCalls.length)
          console.log('✅ Email notification sent for new calls')
        } catch (error) {
          console.error('Failed to send call email notification:', error)
        }

        // Sync to Supabase to enable toast notifications
        try {
          await this.syncCallsToSupabase(newCalls)
          console.log('✅ Synced calls to Supabase for toast notifications')
        } catch (error) {
          console.error('Failed to sync calls to Supabase (non-critical):', error)
        }
      }

      // Clean up old IDs to prevent memory leak (keep last 500)
      if (this.seenCallIds.size > 500) {
        const idsArray = Array.from(this.seenCallIds)
        this.seenCallIds = new Set(idsArray.slice(-500))
      }

    } catch (error) {
      console.error('📊 Error checking new calls:', error)
    }
  }

  /**
   * Check for new chats/SMS
   */
  private async checkNewChats(startDate: Date, endDate: Date): Promise<void> {
    try {
      const response = await retellService.getChatHistory({ limit: 50 })

      if (!response || !response.chats || response.chats.length === 0) {
        console.log('📊 No new chats found')
        return
      }

      // Filter to chats within our time window
      const chatsInWindow = response.chats.filter(chat => {
        const chatTime = new Date(chat.start_timestamp).getTime()
        return chatTime >= startDate.getTime() && chatTime <= endDate.getTime()
      })

      // Filter to truly new chats we haven't seen before
      const newChats = chatsInWindow.filter(chat => {
        const chatId = chat.chat_id
        if (this.seenChatIds.has(chatId)) {
          return false
        }
        this.seenChatIds.add(chatId)
        return true
      })

      if (newChats.length > 0) {
        console.log(`📊 Found ${newChats.length} new chats/SMS, sending email notification and syncing to Supabase`)

        // Send email notification
        try {
          sendNewSMSNotification(newChats.length)
          console.log('✅ Email notification sent for new SMS')
        } catch (error) {
          console.error('Failed to send SMS email notification:', error)
        }

        // Sync to Supabase to enable toast notifications
        try {
          await this.syncChatsToSupabase(newChats)
          console.log('✅ Synced chats to Supabase for toast notifications')
        } catch (error) {
          console.error('Failed to sync chats to Supabase (non-critical):', error)
        }
      }

      // Clean up old IDs to prevent memory leak (keep last 500)
      if (this.seenChatIds.size > 500) {
        const idsArray = Array.from(this.seenChatIds)
        this.seenChatIds = new Set(idsArray.slice(-500))
      }

    } catch (error) {
      console.error('📊 Error checking new chats:', error)
    }
  }

  /**
   * Sync calls to Supabase to enable toast notifications
   */
  private async syncCallsToSupabase(calls: any[]): Promise<void> {
    if (!calls || calls.length === 0) return

    try {
      const records = calls.map(call => ({
        id: call.call_id,
        call_id: call.call_id,
        agent_id: call.agent_id || null,
        start_time: call.start_timestamp || new Date().toISOString(),
        end_time: call.end_timestamp || null,
        duration: call.call_analysis?.call_summary?.duration || 0,
        sentiment: call.call_analysis?.call_summary?.user_sentiment?.toLowerCase() || null,
        created_at: call.start_timestamp || new Date().toISOString()
      }))

      const { error } = await supabase
        .from('calls')
        .upsert(records, { onConflict: 'id', ignoreDuplicates: true })

      if (error) {
        console.error('Supabase sync error (non-critical):', error)
      }
    } catch (error) {
      // Non-critical error - don't break email notifications
      console.error('Failed to sync calls to Supabase:', error)
    }
  }

  /**
   * Sync chats/SMS to Supabase to enable toast notifications
   */
  private async syncChatsToSupabase(chats: any[]): Promise<void> {
    if (!chats || chats.length === 0) return

    try {
      const records = chats.map(chat => ({
        id: chat.chat_id,
        chat_id: chat.chat_id,
        agent_id: chat.agent_id || null,
        start_time: chat.start_timestamp || new Date().toISOString(),
        end_time: chat.end_timestamp || null,
        sentiment: chat.custom_analysis_data?.user_sentiment?.toLowerCase() || null,
        created_at: chat.start_timestamp || new Date().toISOString()
      }))

      const { error } = await supabase
        .from('sms_messages')
        .upsert(records, { onConflict: 'id', ignoreDuplicates: true })

      if (error) {
        console.error('Supabase sync error (non-critical):', error)
      }
    } catch (error) {
      // Non-critical error - don't break email notifications
      console.error('Failed to sync chats to Supabase:', error)
    }
  }

  /**
   * Get monitoring status
   */
  getStatus(): { isMonitoring: boolean, lastCheckTime: Date, pollInterval: number } {
    return {
      isMonitoring: this.isMonitoring,
      lastCheckTime: new Date(this.lastCheckTime),
      pollInterval: this.POLL_INTERVAL
    }
  }
}

// Export singleton instance
export const retellMonitoringService = new RetellMonitoringService()
export default retellMonitoringService

// Expose to window for testing (development only)
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  (window as any).retellMonitoringService = retellMonitoringService
  console.log('📊 Retell Monitoring Service exposed to window for testing')
  console.log('  - retellMonitoringService.getStatus()')
}
