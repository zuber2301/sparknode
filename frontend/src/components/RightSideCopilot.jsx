import { useRef, useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useCopilot } from '../context/copilotContext'
import { useAuthStore } from '../store/authStore'
import { tenantsAPI } from '../lib/api'
import {
  HiOutlineTrash,
  HiOutlinePaperAirplane,
  HiOutlineSparkles,
  HiOutlineX,
  HiOutlineLockClosed,
  HiOutlineLockOpen,
} from 'react-icons/hi'

export default function RightSideCopilot() {
  const {
    messages,
    isLoading,
    sendMessage,
    clearMessages,
    isOpen,
    setIsOpen,
    pinned,
    togglePinned
  } = useCopilot()
  const { user, tenantContext, updateTenantContext } = useAuthStore()
  const [inputValue, setInputValue] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const isPlatformAdmin = user?.org_role === 'platform_admin'
  const isManager = isPlatformAdmin || ['tenant_manager', 'hr_admin', 'dept_lead'].includes(user?.org_role)

  // Role-aware suggested prompts shown before first message
  const SUGGESTED_PROMPTS_EMPLOYEE = [
    'What is my points balance?',
    'When are my points expiring?',
    'What can I buy with 500 points?',
    'Show my last 10 redemptions',
    'Show my recent recognitions',
  ]
  const SUGGESTED_PROMPTS_MANAGER = [
    'Top 5 departments by budget',
    'Which departments have under-utilised budgets?',
    'Which employees haven\'t been recognised in 60 days?',
    'How many recognitions last 30 days?',
  ]
  const suggestedPrompts = isManager
    ? [...SUGGESTED_PROMPTS_EMPLOYEE, ...SUGGESTED_PROMPTS_MANAGER]
    : SUGGESTED_PROMPTS_EMPLOYEE

  // Fetch feature flags if not already in tenantContext (skip for platform admin — no tenant)
  const { data: currentTenantResponse } = useQuery({
    queryKey: ['currentTenant-copilot'],
    queryFn: () => tenantsAPI.getCurrent(),
    enabled: !isPlatformAdmin && !tenantContext?.feature_flags,
    onSuccess: (response) => {
      if (response?.data?.feature_flags && !tenantContext?.feature_flags) {
        updateTenantContext({ feature_flags: response.data.feature_flags })
      }
    },
  })

  // Check if AI copilot is enabled for this tenant
  const featureFlags = tenantContext?.feature_flags || currentTenantResponse?.data?.feature_flags
  const aiCopilotEnabled = isPlatformAdmin || featureFlags?.ai_copilot || featureFlags?.ai_module_enabled

  // Keep the panel open if pinned (must be before early return - Rules of Hooks)
  useEffect(() => {
    if (pinned) setIsOpen(true)
  }, [pinned, setIsOpen])

  // Auto-scroll to bottom when new messages arrive (must be before early return - Rules of Hooks)
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Don't render anything if AI copilot is not enabled
  if (!aiCopilotEnabled) {
    return null
  }

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!inputValue.trim() || isLoading) return

    await sendMessage(inputValue.trim())
    setInputValue('')
    // focus the textarea after send; use a small delay to ensure re-render and re-enable
    setTimeout(() => {
      try {
        inputRef.current?.focus()
        const el = inputRef.current
        if (el && typeof el.setSelectionRange === 'function') {
          const len = (el.value || '').length
          el.setSelectionRange(len, len)
        }
      } catch (err) {
        // ignore focus errors
      }
    }, 50)
  }

  if (!isOpen) {
    // Render a small pinned handle on the left so user can re-open the panel
    return (
      <div className="hidden lg:flex fixed left-6 top-40 z-50">
        <button
          onClick={() => setIsOpen(true)}
          title="Open SNPilot"
          className="bg-sparknode-purple text-white px-3 py-2 rounded-r-lg shadow-md"
        >
          SNPilot
        </button>
      </div>
    )
  }

  return (
    <div className="hidden lg:flex fixed left-6 top-20 z-50 bg-white flex-col shadow-md h-[calc(100vh-7rem)] w-[520px] rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-sparknode-purple/5 to-sparknode-blue/5 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-sparknode-purple to-sparknode-blue flex items-center justify-center">
            <HiOutlineSparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900">SNPilot</h3>
            <p className="text-xs text-gray-500">AI Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={clearMessages}
            title="Clear conversation"
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-600"
          >
            <HiOutlineTrash className="w-4 h-4" />
          </button>
          {/* Pin / Unpin - keeps the Copilot fixed-open on the left */}
          <button
            onClick={() => { togglePinned && togglePinned() }}
            title={pinned ? 'Unpin SNPilot' : 'Pin SNPilot'}
            className={`p-1.5 rounded-lg hover:bg-gray-100 transition-colors ${pinned ? 'text-sparknode-purple' : 'text-gray-600'}`}
          >
            {pinned ? <HiOutlineLockClosed className="w-4 h-4" /> : <HiOutlineLockOpen className="w-4 h-4" />}
          </button>

          {/* Minimize */}
          <button
            onClick={() => setIsOpen(false)}
            title="Minimize"
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-600"
          >
            <HiOutlineX className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 scrollbar min-h-0" style={{
        scrollbarWidth: 'thin',
        scrollbarColor: '#9ca3af #f3f4f6'
      }}>
        {messages.map((message) => {
          const timeStr = message.timestamp.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })
          const displayName = message.type === 'user' ? (user?.first_name || 'You') : 'SNPilot'
          
          return (
          <div
            key={message.id}
            className={`flex ${
              message.type === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                message.type === 'user'
                  ? 'bg-sparknode-purple text-white rounded-br-none'
                  : 'bg-white border border-gray-200 text-gray-900 rounded-bl-none'
              }`}
            >
              <p className="leading-relaxed whitespace-pre-wrap">
                <span className="font-semibold">{displayName}:</span> {message.content} <span className={`text-xs ml-1 ${
                  message.type === 'user'
                    ? 'text-purple-200'
                    : 'text-gray-500'
                }`}>[{timeStr}]</span>
              </p>
            </div>
          </div>
          )
        })}

        {/* Suggested prompts — shown only before first user message */}
        {messages.length <= 1 && !isLoading && (
          <div className="space-y-2 mt-2">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide px-1">Try asking…</p>
            <div className="flex flex-wrap gap-2">
              {suggestedPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => {
                    setInputValue(prompt)
                    setTimeout(() => inputRef.current?.focus(), 50)
                  }}
                  className="text-xs bg-white border border-sparknode-purple/30 text-sparknode-purple rounded-full px-3 py-1.5 hover:bg-sparknode-purple/5 hover:border-sparknode-purple/60 transition-colors text-left"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 px-3 py-2 rounded-lg rounded-bl-none">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <div
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: '0.1s' }}
                />
                <div
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: '0.2s' }}
                />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 p-4 bg-white">
        <form onSubmit={handleSendMessage} className="space-y-2">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSendMessage(e)
              }
            }}
            placeholder="Ask me anything... (Shift+Enter for new line)"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-sparknode-purple focus:border-transparent outline-none transition-all"
            rows="3"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-sparknode-purple to-sparknode-blue text-white font-medium py-2 px-4 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <HiOutlinePaperAirplane className="w-4 h-4" />
            Send
          </button>
        </form>
      </div>
    </div>
  )
}
