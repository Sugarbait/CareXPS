import React, { useState, useCallback } from 'react'
import { SearchIcon, PhoneIcon, MessageSquareIcon, XIcon, ClockIcon, DollarSignIcon, UserIcon } from 'lucide-react'
import { fuzzySearchService } from '@/services/fuzzySearchService'
import { CallDetailModal } from '@/components/common/CallDetailModal'
import { ChatDetailModal } from '@/components/common/ChatDetailModal'
import type { Chat } from '@/services/chatService'

interface UniversalSearchProps {
  calls: any[]
  chats: Chat[]
  isLoading?: boolean
  onCallsRefresh?: () => void
  onChatsRefresh?: () => void
}

export const UniversalSearch: React.FC<UniversalSearchProps> = ({
  calls,
  chats,
  isLoading = false,
  onCallsRefresh,
  onChatsRefresh
}) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<{
    calls: any[]
    chats: Chat[]
  }>({ calls: [], chats: [] })
  const [selectedCall, setSelectedCall] = useState<any | null>(null)
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null)
  const [isCallModalOpen, setIsCallModalOpen] = useState(false)
  const [isChatModalOpen, setIsChatModalOpen] = useState(false)

  const handleSearch = useCallback((query: string) => {
    setSearchTerm(query)

    if (!query.trim()) {
      setSearchResults({ calls: [], chats: [] })
      return
    }

    // 🔍 DEBUG: Log data being searched
    console.log('🔍 [UNIVERSAL SEARCH] Starting search with query:', query)
    console.log('🔍 [UNIVERSAL SEARCH] Calls data:', {
      count: calls.length,
      sample: calls.slice(0, 2).map(c => ({
        call_id: c.call_id,
        patient_id: c.patient_id,
        phone: c.metadata?.phone_number,
        name: c.metadata?.patient_name
      }))
    })
    console.log('🔍 [UNIVERSAL SEARCH] Chats data:', {
      count: chats.length,
      sample: chats.slice(0, 2).map(c => ({
        chat_id: c.chat_id,
        phone: c.metadata?.phone_number || c.metadata?.customer_phone_number,
        name: c.metadata?.patient_name || c.metadata?.customer_name
      }))
    })

    // Search calls
    const callResults = fuzzySearchService.basicCallsSearch(calls, query)
    console.log('🔍 [UNIVERSAL SEARCH] Call search results:', callResults.length)

    // Search chats
    const chatResults = fuzzySearchService.basicSMSSearch(chats, query)
    console.log('🔍 [UNIVERSAL SEARCH] Chat search results:', chatResults.length)

    setSearchResults({
      calls: callResults, // Show all results
      chats: chatResults  // Show all results
    })
  }, [calls, chats])

  const clearSearch = () => {
    setSearchTerm('')
    setSearchResults({ calls: [], chats: [] })
  }

  const handleCallClick = (call: any) => {
    setSelectedCall(call)
    setIsCallModalOpen(true)
  }

  const handleChatClick = (chat: Chat) => {
    setSelectedChat(chat)
    setIsChatModalOpen(true)
  }

  const formatDuration = (call: any) => {
    // Try multiple duration sources in order of priority
    let seconds: number | undefined = undefined

    // 1. Check call_length_seconds field
    if (call.call_length_seconds && call.call_length_seconds > 0) {
      seconds = call.call_length_seconds
    }
    // 2. Check duration_ms field (Retell AI API field)
    else if (call.duration_ms !== undefined && call.duration_ms !== null && call.duration_ms > 0) {
      seconds = call.duration_ms / 1000
    }
    // 3. Calculate from timestamps
    else if (call.start_timestamp && call.end_timestamp) {
      let startMs = call.start_timestamp
      let endMs = call.end_timestamp

      // Handle both milliseconds and seconds timestamps
      if (call.start_timestamp.toString().length <= 10) {
        startMs = call.start_timestamp * 1000
      }
      if (call.end_timestamp.toString().length <= 10) {
        endMs = call.end_timestamp * 1000
      }

      seconds = (endMs - startMs) / 1000
    }

    if (!seconds || seconds <= 0) return '0s'
    if (seconds < 60) return `${seconds.toFixed(0)}s`
    const minutes = seconds / 60
    return `${minutes.toFixed(1)} min`
  }

  const formatCost = (cost?: number) => {
    if (!cost) return '$0.00'
    return `$${cost.toFixed(2)}`
  }

  const getSentimentColor = (sentiment?: string) => {
    switch (sentiment?.toLowerCase()) {
      case 'positive': return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30'
      case 'negative': return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30'
      case 'neutral': return 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30'
      default: return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800/30'
    }
  }

  const hasResults = searchResults.calls.length > 0 || searchResults.chats.length > 0

  return (
    <div className="mb-6">
      {/* Search Input */}
      <div className="relative">
        <SearchIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
        <input
          type="text"
          placeholder={isLoading ? "Loading data, please wait..." : "Search across Calls and SMS by Patient ID, name, phone, or content..."}
          value={searchTerm}
          onChange={(e) => handleSearch(e.target.value)}
          disabled={isLoading}
          className="w-full pl-10 pr-10 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        {searchTerm && !isLoading && (
          <button
            onClick={clearSearch}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <XIcon className="w-5 h-5" />
          </button>
        )}
        {isLoading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
          </div>
        )}
      </div>

      {/* Search Results */}
      {searchTerm && (
        <div className="mt-4 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 max-h-[500px] overflow-y-auto">
          {!hasResults ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              No results found for "{searchTerm}"
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {/* Call Results Section */}
              {searchResults.calls.length > 0 && (
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <PhoneIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                      Calls ({searchResults.calls.length})
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {searchResults.calls.map((call) => (
                      <button
                        key={call.call_id}
                        onClick={() => handleCallClick(call)}
                        className="w-full text-left p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-600"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
                                {call.metadata?.patient_name || `Patient ${call.patient_id}`}
                              </span>
                              {call.sentiment_analysis && (
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getSentimentColor(call.sentiment_analysis.overall_sentiment)}`}>
                                  {call.sentiment_analysis.overall_sentiment}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                              <span className="flex items-center gap-1">
                                <UserIcon className="w-3 h-3" />
                                {call.patient_id || call.from_number || 'Unknown'}
                              </span>
                              <span className="flex items-center gap-1">
                                <ClockIcon className="w-3 h-3" />
                                {formatDuration(call)}
                              </span>
                              {call.cost && (
                                <span className="flex items-center gap-1">
                                  <DollarSignIcon className="w-3 h-3" />
                                  {formatCost(call.cost)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* SMS Results Section */}
              {searchResults.chats.length > 0 && (
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <MessageSquareIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                      SMS ({searchResults.chats.length})
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {searchResults.chats.map((chat) => {
                      const phoneNumber = chat.metadata?.phone_number ||
                                         chat.metadata?.customer_phone_number ||
                                         chat.chat_analysis?.custom_analysis_data?.phone_number ||
                                         'Unknown'
                      const patientName = chat.metadata?.patient_name ||
                                         chat.metadata?.customer_name ||
                                         chat.chat_analysis?.custom_analysis_data?.patient_name ||
                                         `Patient ${phoneNumber}`

                      return (
                        <button
                          key={chat.chat_id}
                          onClick={() => handleChatClick(chat)}
                          className="w-full text-left p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-600"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
                                  {patientName}
                                </span>
                                {chat.chat_analysis?.user_sentiment && (
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getSentimentColor(chat.chat_analysis.user_sentiment)}`}>
                                    {chat.chat_analysis.user_sentiment}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                                <span className="flex items-center gap-1">
                                  <UserIcon className="w-3 h-3" />
                                  {phoneNumber}
                                </span>
                                <span className="truncate">
                                  {chat.chat_analysis?.chat_summary?.substring(0, 60) || 'No summary available'}
                                  {(chat.chat_analysis?.chat_summary?.length || 0) > 60 && '...'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Call Detail Modal */}
      {selectedCall && (
        <CallDetailModal
          call={selectedCall}
          isOpen={isCallModalOpen}
          onClose={() => {
            setIsCallModalOpen(false)
            setSelectedCall(null)
            onCallsRefresh?.()
          }}
          onNotesChanged={onCallsRefresh}
        />
      )}

      {/* Chat Detail Modal */}
      {selectedChat && (
        <ChatDetailModal
          chat={selectedChat}
          isOpen={isChatModalOpen}
          onClose={() => {
            setIsChatModalOpen(false)
            setSelectedChat(null)
            onChatsRefresh?.()
          }}
          onNotesChanged={onChatsRefresh}
        />
      )}
    </div>
  )
}
