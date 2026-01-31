import { useRef, useEffect, useState } from 'react'
import { useCopilot } from '../context/copilotContext'
import {
  HiOutlineChevronDown,
  HiOutlineChevronUp,
  HiOutlineTrash,
  HiOutlinePaperAirplane,
  HiOutlineSparkles,
} from 'react-icons/hi'

export default function RightSideCopilot() {
  const {
    isOpen,
    messages,
    isLoading,
    sendMessage,
    clearMessages,
    toggleOpen,
  } = useCopilot()
  const [inputValue, setInputValue] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!inputValue.trim() || isLoading) return

    await sendMessage(inputValue.trim())
    setInputValue('')
    inputRef.current?.focus()
  }

  return (
    <div className="hidden lg:flex lg:w-80 bg-white border-l border-gray-200 flex-col shadow-lg h-[calc(100vh-3.5rem)]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-sparknode-purple/5 to-sparknode-blue/5 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-sparknode-purple to-sparknode-blue flex items-center justify-center">
            <HiOutlineSparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900">SparkNode Copilot</h3>
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
          <button
            onClick={toggleOpen}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-600"
          >
            {isOpen ? (
              <HiOutlineChevronDown className="w-4 h-4" />
            ) : (
              <HiOutlineChevronUp className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.map((message) => (
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
              <p className="leading-relaxed">{message.content}</p>
              <p
                className={`text-xs mt-1 ${
                  message.type === 'user'
                    ? 'text-purple-200'
                    : 'text-gray-500'
                }`}
              >
                {message.timestamp.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        ))}

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

        {/* Help text */}
        <p className="text-xs text-gray-500 mt-3 text-center">
          I can help you understand your data and provide insights about recognition events.
        </p>
      </div>
    </div>
  )
}
