/**
 * Toast Notification Service - Enhanced Strict Mode
 *
 * Provides real-time toast notifications for TRULY NEW Call and SMS records ONLY.
 * Features comprehensive filtering to ensure no old notifications are ever shown:
 * - Session-based tracking prevents pre-existing record notifications
 * - Ultra-strict 30-second window for new record acceptance
 * - Automatic queue cleanup for stale notifications
 * - Multiple timestamp validation safeguards
 * - Cross-device synchronization with user preference integration
 */

import { supabase } from '@/config/supabase'
import { RealtimeChannel } from '@supabase/supabase-js'
import { ToastNotificationData } from '@/components/common/ToastNotification'
import { sendNewSMSNotification, sendNewCallNotification } from './emailNotificationService'

export interface ToastNotificationPreferences {
  enabled: boolean
  soundEnabled: boolean
  doNotDisturb: {
    enabled: boolean
    startTime: string // Format: "22:00"
    endTime: string   // Format: "08:00"
  }
}

export type ToastNotificationCallback = (notification: ToastNotificationData) => void

class ToastNotificationService {
  private isInitialized = false
  private callsChannel: RealtimeChannel | null = null
  private smsChannel: RealtimeChannel | null = null
  private callbacks: Set<ToastNotificationCallback> = new Set()
  private preferences: ToastNotificationPreferences = {
    enabled: true,
    soundEnabled: true,
    doNotDisturb: {
      enabled: false,
      startTime: "22:00",
      endTime: "08:00"
    }
  }

  // Session tracking to prevent showing pre-existing records
  private serviceStartTime: number = 0
  private monitoringStartTime: number = 0

  // Deduplication tracking
  private recentNotifications = new Map<string, number>()
  private readonly DEDUP_WINDOW = 5000 // 5 seconds

  // Time window for new records - balanced for development and production
  private readonly NEW_RECORD_WINDOW = 60000 // 60 seconds (1 minute for development testing)

  // Tab visibility tracking
  private isTabVisible = true
  private pendingNotifications: ToastNotificationData[] = []

  // Maximum age for queued notifications (2 minutes)
  private readonly MAX_QUEUE_AGE = 2 * 60 * 1000

  /**
   * Initialize the toast notification service
   */
  async initialize(userId: string): Promise<void> {
    if (this.isInitialized) return

    // Record service start time to prevent showing pre-existing records
    this.serviceStartTime = Date.now()

    console.log('🔔 Initializing Toast Notification Service...', {
      serviceStartTime: new Date(this.serviceStartTime).toISOString()
    })

    // Load user preferences
    await this.loadUserPreferences(userId)

    // Set up tab visibility tracking
    this.setupVisibilityTracking()

    // Set up real-time monitoring if notifications are enabled
    if (this.preferences.enabled) {
      await this.setupRealtimeMonitoring()
    }

    this.isInitialized = true
    console.log('✅ Toast Notification Service initialized with strict new-record filtering')
  }

  /**
   * Subscribe to toast notifications
   */
  subscribe(callback: ToastNotificationCallback): () => void {
    this.callbacks.add(callback)

    return () => {
      this.callbacks.delete(callback)
    }
  }

  /**
   * Update notification preferences
   */
  async updatePreferences(userId: string, preferences: Partial<ToastNotificationPreferences>): Promise<void> {
    this.preferences = { ...this.preferences, ...preferences }

    // Save to localStorage for quick access
    localStorage.setItem('toast_notification_preferences', JSON.stringify(this.preferences))

    // Restart monitoring if enabled status changed
    if (preferences.enabled !== undefined) {
      if (preferences.enabled && !this.callsChannel && !this.smsChannel) {
        await this.setupRealtimeMonitoring()
      } else if (!preferences.enabled && (this.callsChannel || this.smsChannel)) {
        this.stopRealtimeMonitoring()
        // Clear any pending notifications when disabling
        this.pendingNotifications = []
      }
    }

    console.log('🔔 Toast notification preferences updated:', this.preferences)
  }

  /**
   * Check if notifications should be shown (Do Not Disturb mode)
   */
  private shouldShowNotification(): boolean {
    if (!this.preferences.enabled) return false
    if (!this.preferences.doNotDisturb.enabled) return true

    const now = new Date()
    const currentTime = now.getHours() * 100 + now.getMinutes()

    const startTime = this.parseTime(this.preferences.doNotDisturb.startTime)
    const endTime = this.parseTime(this.preferences.doNotDisturb.endTime)

    // Handle overnight DND (e.g., 22:00 to 08:00)
    if (startTime > endTime) {
      return !(currentTime >= startTime || currentTime <= endTime)
    } else {
      return !(currentTime >= startTime && currentTime <= endTime)
    }
  }

  /**
   * Parse time string to minutes since midnight
   */
  private parseTime(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number)
    return hours * 100 + minutes
  }

  /**
   * Load user notification preferences
   */
  private async loadUserPreferences(userId: string): Promise<void> {
    try {
      // Try to load from localStorage first (fast)
      const stored = localStorage.getItem('toast_notification_preferences')
      if (stored) {
        this.preferences = { ...this.preferences, ...JSON.parse(stored) }
      }

      // TODO: In future, sync with Supabase user_settings table
      // For now, we'll use localStorage only to keep it simple

    } catch (error) {
      console.warn('Failed to load toast notification preferences:', error)
    }
  }

  /**
   * Set up tab visibility tracking
   */
  private setupVisibilityTracking(): void {
    document.addEventListener('visibilitychange', () => {
      const wasVisible = this.isTabVisible
      this.isTabVisible = !document.hidden

      // If tab becomes visible and we have pending notifications, show only fresh ones
      if (!wasVisible && this.isTabVisible && this.pendingNotifications.length > 0) {
        const now = Date.now()

        // Filter out stale notifications that are older than MAX_QUEUE_AGE
        const freshNotifications = this.pendingNotifications.filter(notification => {
          const age = now - notification.timestamp.getTime()
          const isFresh = age <= this.MAX_QUEUE_AGE
          if (!isFresh) {
            console.log(`🔔 Discarding stale queued notification: ${notification.title} (age: ${Math.round(age/1000)}s)`)
          }
          return isFresh
        })

        console.log(`🔔 Tab visible again, showing ${freshNotifications.length} fresh notifications (discarded ${this.pendingNotifications.length - freshNotifications.length} stale)`)

        // Show fresh notifications with a small delay to avoid overwhelming
        freshNotifications.forEach((notification, index) => {
          setTimeout(() => {
            this.showNotification(notification)
          }, index * 500) // Stagger by 500ms
        })

        this.pendingNotifications = []
      }
    })
  }

  /**
   * Set up real-time monitoring for new records
   */
  private async setupRealtimeMonitoring(): Promise<void> {
    try {
      // Record when monitoring starts to ensure we only show records created after this point
      this.monitoringStartTime = Date.now()

      console.log('🔔 Setting up real-time monitoring for new records...', {
        monitoringStartTime: new Date(this.monitoringStartTime).toISOString()
      })

      // Monitor calls table for new records
      this.callsChannel = supabase
        .channel('toast_calls_monitor')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'calls'
          },
          (payload) => {
            this.handleNewCall(payload.new as any)
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('✅ Toast notifications active for calls')
          }
        })

      // Monitor SMS table for new records
      this.smsChannel = supabase
        .channel('toast_sms_monitor')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'sms_messages'
          },
          (payload) => {
            this.handleNewSMS(payload.new as any)
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('✅ Toast notifications active for SMS')
          }
        })

    } catch (error) {
      console.error('Failed to set up real-time monitoring:', error)
    }
  }

  /**
   * Stop real-time monitoring
   */
  private stopRealtimeMonitoring(): void {
    if (this.callsChannel) {
      supabase.removeChannel(this.callsChannel)
      this.callsChannel = null
    }

    if (this.smsChannel) {
      supabase.removeChannel(this.smsChannel)
      this.smsChannel = null
    }

    console.log('🔔 Real-time monitoring stopped')
  }

  /**
   * Validate if a record is truly new and should trigger a notification
   */
  private isRecordTrulyNew(recordTimestamp: string | Date, recordId: string): boolean {
    const recordTime = new Date(recordTimestamp).getTime()
    const now = Date.now()

    // Check 1: Record must be created after service started monitoring (primary check)
    if (recordTime < this.monitoringStartTime) {
      console.log(`🔔 Rejecting notification: Record ${recordId} created before monitoring started (${new Date(recordTime).toISOString()} < ${new Date(this.monitoringStartTime).toISOString()})`)
      return false
    }

    // Check 2: Record must be created after service initialization (backup safeguard)
    if (recordTime < this.serviceStartTime) {
      console.log(`🔔 Rejecting notification: Record ${recordId} created before service initialization (${new Date(recordTime).toISOString()} < ${new Date(this.serviceStartTime).toISOString()})`)
      return false
    }

    // Check 3: Record must be recent (within NEW_RECORD_WINDOW) - for development testing
    const age = now - recordTime
    if (age > this.NEW_RECORD_WINDOW) {
      console.log(`🔔 Rejecting notification: Record ${recordId} too old (age: ${Math.round(age/1000)}s, limit: ${this.NEW_RECORD_WINDOW/1000}s)`)
      return false
    }

    // Check 4: Record must not be from the future (clock skew protection)
    const maxFutureSkew = 10000 // 10 seconds (reduced from 30)
    if (recordTime > now + maxFutureSkew) {
      console.log(`🔔 Rejecting notification: Record ${recordId} appears to be from the future (${new Date(recordTime).toISOString()})`)
      return false
    }

    // Check 5: Final validation - Record must be within acceptable time window
    if (age < -10000 || age > this.NEW_RECORD_WINDOW) {
      console.log(`🔔 Rejecting notification: Record ${recordId} not in acceptable window (age: ${Math.round(age/1000)}s)`)
      return false
    }

    console.log(`✅ Accepting notification: Record ${recordId} is truly new (age: ${Math.round(age/1000)}s)`)
    return true
  }

  /**
   * Handle new call record
   */
  private handleNewCall(callRecord: any): void {
    if (!this.shouldShowNotification()) return

    // Use strict validation to ensure record is truly new
    const recordTimestamp = callRecord.start_timestamp || callRecord.created_at
    if (!recordTimestamp || !this.isRecordTrulyNew(recordTimestamp, callRecord.call_id)) {
      return
    }

    const recordTime = new Date(recordTimestamp)

    const notificationId = `call_${callRecord.call_id}_${Date.now()}`

    // Check for recent duplicates
    if (this.isDuplicate(notificationId, callRecord.call_id)) return

    const notification: ToastNotificationData = {
      id: notificationId,
      type: 'call',
      title: 'New Call Record Received',
      timestamp: recordTime,
      recordId: callRecord.call_id
    }

    this.processNotification(notification)

    // Send email notification
    try {
      sendNewCallNotification(1)
    } catch (error) {
      console.error('Failed to send call email notification:', error)
    }
  }

  /**
   * Handle new SMS record
   */
  private handleNewSMS(smsRecord: any): void {
    if (!this.shouldShowNotification()) return

    // Use strict validation to ensure record is truly new
    const recordTimestamp = smsRecord.created_at
    if (!recordTimestamp || !this.isRecordTrulyNew(recordTimestamp, smsRecord.id)) {
      return
    }

    const recordTime = new Date(recordTimestamp)

    const notificationId = `sms_${smsRecord.id}_${Date.now()}`

    // Check for recent duplicates
    if (this.isDuplicate(notificationId, smsRecord.id)) return

    const notification: ToastNotificationData = {
      id: notificationId,
      type: 'sms',
      title: 'New SMS Message Received',
      timestamp: recordTime,
      recordId: smsRecord.id
    }

    this.processNotification(notification)

    // Send email notification
    try {
      sendNewSMSNotification(1)
    } catch (error) {
      console.error('Failed to send SMS email notification:', error)
    }
  }

  /**
   * Check if notification is a duplicate
   */
  private isDuplicate(notificationId: string, recordId: string): boolean {
    const now = Date.now()
    const recentKey = `${recordId}`

    // Clean old entries
    for (const [key, timestamp] of this.recentNotifications.entries()) {
      if (now - timestamp > this.DEDUP_WINDOW) {
        this.recentNotifications.delete(key)
      }
    }

    // Check if we've seen this record recently
    if (this.recentNotifications.has(recentKey)) {
      console.log(`🔔 Duplicate notification filtered: ${recordId}`)
      return true
    }

    // Track this notification
    this.recentNotifications.set(recentKey, now)
    return false
  }

  /**
   * Process notification (show immediately or queue for later)
   */
  private processNotification(notification: ToastNotificationData): void {
    if (this.isTabVisible) {
      this.showNotification(notification)
    } else {
      // Clean stale notifications from queue before adding new one
      this.cleanStaleQueuedNotifications()

      // Queue for when tab becomes visible
      this.pendingNotifications.push(notification)
      console.log(`🔔 Notification queued (tab not visible): ${notification.title}`)
    }
  }

  /**
   * Clean stale notifications from the queue
   */
  private cleanStaleQueuedNotifications(): void {
    const now = Date.now()
    const originalCount = this.pendingNotifications.length

    this.pendingNotifications = this.pendingNotifications.filter(notification => {
      const age = now - notification.timestamp.getTime()
      const isFresh = age <= this.MAX_QUEUE_AGE
      if (!isFresh) {
        console.log(`🔔 Removing stale queued notification: ${notification.title} (age: ${Math.round(age/1000)}s)`)
      }
      return isFresh
    })

    const removedCount = originalCount - this.pendingNotifications.length
    if (removedCount > 0) {
      console.log(`🔔 Cleaned ${removedCount} stale notifications from queue (${this.pendingNotifications.length} remaining)`)
    }
  }

  /**
   * Show notification to all subscribers
   */
  private showNotification(notification: ToastNotificationData): void {
    console.log(`🔔 Showing notification: ${notification.title}`)

    this.callbacks.forEach(callback => {
      try {
        callback(notification)
      } catch (error) {
        console.error('Error in toast notification callback:', error)
      }
    })
  }

  /**
   * Get current preferences
   */
  getPreferences(): ToastNotificationPreferences {
    return { ...this.preferences }
  }

  /**
   * Get debug information about the service state
   */
  getDebugInfo(): any {
    const now = Date.now()
    return {
      isInitialized: this.isInitialized,
      serviceStartTime: this.serviceStartTime > 0 ? new Date(this.serviceStartTime).toISOString() : 'Not set',
      monitoringStartTime: this.monitoringStartTime > 0 ? new Date(this.monitoringStartTime).toISOString() : 'Not set',
      serviceAge: this.serviceStartTime > 0 ? Math.round((now - this.serviceStartTime) / 1000) + 's' : 'N/A',
      monitoringAge: this.monitoringStartTime > 0 ? Math.round((now - this.monitoringStartTime) / 1000) + 's' : 'N/A',
      newRecordWindow: this.NEW_RECORD_WINDOW / 1000 + 's',
      maxQueueAge: this.MAX_QUEUE_AGE / 1000 + 's',
      isTabVisible: this.isTabVisible,
      pendingNotifications: this.pendingNotifications.length,
      recentNotifications: this.recentNotifications.size,
      hasCallsChannel: !!this.callsChannel,
      hasSmsChannel: !!this.smsChannel,
      preferences: this.preferences
    }
  }

  /**
   * Test method to trigger a demo notification (for testing purposes)
   */
  triggerTestNotification(type: 'call' | 'sms'): void {
    const testNotification: ToastNotificationData = {
      id: `test_${type}_${Date.now()}`,
      type,
      title: type === 'call' ? 'New Call Record Received' : 'New SMS Record Received',
      timestamp: new Date(),
      recordId: `test_${type}_${Math.random().toString(36).substr(2, 9)}`
    }

    console.log('🧪 Toast service triggering test notification:', testNotification)
    this.showNotification(testNotification)
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.stopRealtimeMonitoring()
    this.callbacks.clear()
    this.recentNotifications.clear()
    this.pendingNotifications = []

    // Reset timing variables to prevent issues with re-initialization
    this.serviceStartTime = 0
    this.monitoringStartTime = 0

    this.isInitialized = false
    console.log('🔔 Toast Notification Service cleaned up (timing variables reset)')
  }
}

// Export singleton instance
export const toastNotificationService = new ToastNotificationService()
export default toastNotificationService