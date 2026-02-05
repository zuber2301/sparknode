import { createContext, useContext, useState, useCallback } from 'react'

const CopilotContext = createContext(undefined)

export function CopilotProvider({ children }) {
  // Persisted "pinned" state controls whether SNPilot remains fixed-open
  const [pinned, setPinned] = useState(() => {
    try {
      const s = localStorage.getItem('copilotPinned')
      return s ? JSON.parse(s) : true
    } catch (e) {
      return true
    }
  })

  // Start open if pinned, otherwise can be toggled
  const [isOpen, setIsOpen] = useState(pinned)
  const [messages, setMessages] = useState([
    {
      id: '1',
      type: 'assistant',
      content: 'Hey! I\'m SNPilot.\nAsk me about events, data, or anything on screen.',
      timestamp: new Date(),
    },
  ])
  const [isLoading, setIsLoading] = useState(false)

  const addMessage = useCallback((content, type = 'user') => {
    const newMessage = {
      id: Date.now().toString(),
      type,
      content,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, newMessage])
    return newMessage
  }, [])

  const sendMessage = useCallback(async (userMessage, context = {}) => {
    // Add user message
    addMessage(userMessage, 'user')
    setIsLoading(true)

    try {
      // TODO: Connect to actual API endpoint for AI responses
      // For now, return a placeholder response
      const response = await fetch('/api/copilot/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          context, // Pass contextual information (current page, visible data, etc.)
        }),
      }).then((res) => res.json())
      
      if (response.error) {
        addMessage('Sorry, I encountered an error. Please try again.', 'assistant')
      } else {
        addMessage(response.response || response.message, 'assistant')
      }
    } catch (error) {
      console.error('Copilot error:', error)
      addMessage(
        'I\'m having trouble connecting. Please try again in a moment.',
        'assistant'
      )
    } finally {
      setIsLoading(false)
    }
  }, [addMessage])

  const clearMessages = useCallback(() => {
    setMessages([
      {
        id: '1',
        type: 'assistant',
        content: 'Hey! I\'m SNPilot.\nAsk me about events, data, or anything on screen.',
        timestamp: new Date(),
      },
    ])
  }, [])

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => !prev)
  }, [])

  const togglePinned = useCallback(() => {
    setPinned((prev) => {
      const next = !prev
      try {
        localStorage.setItem('copilotPinned', JSON.stringify(next))
      } catch (e) {
        // ignore
      }
      // Keep the open state in sync with pinned
      if (next) setIsOpen(true)
      return next
    })
  }, [])

  return (
    <CopilotContext.Provider
      value={{
        isOpen,
        setIsOpen,
        pinned,
        setPinned,
        togglePinned,
        messages,
        isLoading,
        sendMessage,
        clearMessages,
        toggleOpen,
      }}
    >
      {children}
    </CopilotContext.Provider>
  )
}

export function useCopilot() {
  const context = useContext(CopilotContext)
  if (!context) {
    throw new Error('useCopilot must be used within CopilotProvider')
  }
  return context
}
