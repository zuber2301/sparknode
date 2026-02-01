# SparkNode Right-Side Copilot Implementation

## Overview

The Right-Side Copilot transforms SparkNode from a "form-filling" tool into an active recognition partner by providing contextual AI assistance in a persistent split-screen panel. This enables multimodal interactions where users can ask questions about what they're viewing without leaving the current page.

## Architecture

### Frontend Components

#### 1. **CopilotContext** (`src/context/copilotContext.jsx`)
- Manages global state for the copilot chat
- Provides hooks for message management and API communication
- Maintains conversation history
- Controls UI visibility and loading states

**Key Exports:**
- `CopilotProvider` - Context provider component
- `useCopilot()` - Hook to access copilot state and methods

**Methods:**
- `sendMessage(userMessage, context)` - Send message to copilot API
- `clearMessages()` - Clear conversation history
- `toggleOpen()` - Toggle copilot visibility
- `addMessage(content, type)` - Manually add message to conversation

#### 2. **RightSideCopilot** (`src/components/RightSideCopilot.jsx`)
- Persistent 320px right-side panel with fixed positioning
- Features:
  - Animated message display with timestamps
  - Textarea input with Enter-to-send and Shift+Enter for new lines
  - Typing indicator while waiting for response
  - Clear conversation button
  - Minimize/maximize toggle
  - Gradient header with SparkNode branding

**Layout:**
```
┌─────────────────────────────────────────────┐
│ [🎨] SparkNode Copilot      [🗑️] [_] [−]   │  ← Header
├─────────────────────────────────────────────┤
│                                             │
│  Assistant: Hello, how can I help?          │
│                                             │
│  You: Tell me about John's recent award     │
│                                             │
│  Assistant: John received "Leader of the... │
│                                             │
├─────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────┐ │
│ │ Ask me anything...                      │ │
│ │                                         │ │
│ └─────────────────────────────────────────┘ │
│ [ Send ]                                    │
│ I can help with recognition trends...      │
└─────────────────────────────────────────────┘
```

#### 3. **Updated Layout** (`src/components/Layout.jsx`)
- Wraps content with `CopilotProvider`
- Adjusts main content area with `pr-80` (320px right padding) when copilot is open
- Maintains responsive behavior on mobile (copilot hidden by default on small screens)
- Smooth transitions when toggling copilot visibility

### Backend Components

#### **Copilot Routes** (`backend/copilot/routes.py`)

**Endpoint:** `POST /api/copilot/chat`

**Request Body:**
```json
{
  "message": "Tell me more about the recognition event",
  "context": {
    "page": "feed|dashboard|wallet",
    "visible_data": {...}
  }
}
```

**Response:**
```json
{
  "response": "The recognition event...",
  "timestamp": "2026-01-31T10:30:00"
}
```

**Features:**
- Keyword-based intelligent responses for MVP
- Context-aware answers based on current page
- User personalization (includes user's first name in responses)
- Error handling and logging
- Authentication via JWT token (Depends on `get_current_user`)

## Use Cases

### 1. Feed Page
**User Action:** Sees a recognition notification
**User Input:** "Tell me more about John's award"
**Copilot Response:** Contextual information about the recognition event, John's achievements, impact

### 2. Dashboard
**User Action:** Views metrics and trends
**User Input:** "What does this spike in Q1 mean?"
**Copilot Response:** Explanation of the trend, potential factors, comparison to other periods

### 3. Wallet Page
**User Action:** Looks at available redemptions
**User Input:** "Which reward has the best value?"
**Copilot Response:** Analysis of point-to-value ratios, personalized recommendations based on spending history

### 4. Budget Management
**User Action:** Reviews budget allocations
**User Input:** "How much have we spent so far?"
**Copilot Response:** Current spend details, percentage of budget used, projections

## Styling & Responsiveness

### Desktop (1024px+)
- Copilot panel always available
- Main content automatically adjusts with `pr-80` class
- Smooth transitions between open/closed states
- Independent scrolling for main content and copilot

### Tablet (768px-1023px)
- Copilot panel available with toggle
- Main content adjusts when copilot is open
- Touch-friendly button sizing

### Mobile (< 768px)
- Copilot hidden by default to preserve screen space
- User can toggle to full-width or split view
- Optimized for small screens

## Implementation Details

### State Management
```jsx
// Global state via CopilotContext
{
  isOpen: boolean,           // Is copilot panel visible?
  messages: Message[],       // Conversation history
  isLoading: boolean,        // Waiting for response?
}

// Message structure
{
  id: string,
  type: 'user' | 'assistant',
  content: string,
  timestamp: Date
}
```

### Message Flow
```
User types message
    ↓
addMessage(userMessage, 'user')  // Add to UI immediately
    ↓
sendMessage() called
    ↓
POST /api/copilot/chat with message + context
    ↓
Backend processes with generate_copilot_response()
    ↓
addMessage(response, 'assistant')  // Add response to UI
    ↓
User sees assistant message
```

## Configuration

### Copilot Panel Width
- Current: 320px (`w-80` in Tailwind)
- Adjustable by modifying the `pr-80` class in Layout.jsx and `w-80` in RightSideCopilot.jsx

### Colors
- Uses SparkNode brand colors from Tailwind config
- Header gradient: `from-sparknode-purple to-sparknode-blue`
- Message bubbles: Purple for user, white for assistant

### Animations
- Smooth slide-in/out transitions (300ms)
- Message fade-in with timestamps
- Typing indicator with staggered bounce animation

## Future Enhancements

### Phase 2: LLM Integration
- Replace keyword matching with actual LLM (OpenAI GPT-4, Anthropic Claude)
- Semantic understanding of complex queries
- Multi-turn conversations with memory
- Code generation for admin tasks

### Phase 3: Contextual Intelligence
- Real-time data injection from visible components
- Recognition trends analysis
- Budget forecasting
- Personalized recommendations

### Phase 4: Advanced Features
- Voice input/output
- Screenshot analysis ("What do you see on my screen?")
- Historical question answering
- Export conversation as report

## Testing

### Unit Tests
- CopilotContext state management
- Message formatting and timestamps
- API error handling

### Integration Tests
- End-to-end chat flow
- Split-screen layout adjustments
- Responsive behavior across screen sizes

### Manual Testing Checklist
- [ ] Send message and receive response
- [ ] Clear conversation history
- [ ] Toggle copilot visibility
- [ ] Test on mobile/tablet/desktop
- [ ] Verify scrolling behavior
- [ ] Check keyboard shortcuts (Enter, Shift+Enter)
- [ ] Test with different user roles
- [ ] Verify message timestamps

## Deployment

1. Ensure backend `copilot` module is included in deployment
2. Update API documentation with copilot endpoints
3. Set up LLM API keys in environment (future)
4. Monitor copilot usage and performance metrics
5. Gather user feedback for improvements

## Files Modified/Created

### Frontend
- ✅ `src/context/copilotContext.jsx` - New context provider
- ✅ `src/components/RightSideCopilot.jsx` - New UI component
- ✅ `src/components/Layout.jsx` - Updated to include copilot

### Backend
- ✅ `backend/copilot/__init__.py` - New module
- ✅ `backend/copilot/routes.py` - New API endpoints
- ✅ `backend/main.py` - Updated to include copilot router

## API Documentation

### POST /api/copilot/chat

Sends a message to the copilot and receives a contextual response.

**Authentication:** Required (JWT Bearer token)

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| message | string | Yes | User's question or statement |
| context | object | No | Contextual information (page, visible_data, etc.) |

**Response:**
```json
{
  "response": "string - AI-generated response",
  "timestamp": "ISO 8601 datetime"
}
```

**Error Responses:**
- `400 Bad Request` - Message is empty or missing
- `401 Unauthorized` - Invalid or missing authentication token
- `500 Internal Server Error` - Server-side processing error

**Example Request:**
```bash
curl -X POST http://localhost:8000/api/copilot/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "message": "What are the top performers this quarter?",
    "context": {
      "page": "dashboard",
      "visible_data": {"timeframe": "Q1 2026"}
    }
  }'
```

**Example Response:**
```json
{
  "response": "Based on the current data, your top performers this quarter are... [contextual analysis]",
  "timestamp": "2026-01-31T10:30:45.123456"
}
```

## Performance Considerations

- **Message History:** Limited to last 100 messages to prevent memory bloat
- **API Response Time:** Aimed for < 2 seconds (keyword matching), < 5 seconds (LLM integration)
- **Bundle Size:** Copilot adds ~8KB minified (context + component)
- **Re-renders:** Memoized context updates to prevent unnecessary re-renders

## Security

- All copilot requests require authentication
- Messages are not persisted by default (stored only in client session)
- Context data should never include sensitive information
- API responses are rate-limited to prevent abuse
- CORS properly configured for frontend-to-backend communication

## Troubleshooting

### Copilot panel not showing
- Check if `isOpen` state is true in CopilotContext
- Verify `RightSideCopilot` component is mounted in Layout
- Check z-index conflicts with other fixed elements

### Messages not sending
- Verify authentication token is valid
- Check browser console for API errors
- Ensure backend `/api/copilot/chat` endpoint is accessible
- Check CORS headers

### Styling issues
- Verify Tailwind CSS is properly compiled
- Check for conflicting CSS classes
- Ensure custom SparkNode colors are defined in tailwind.config.js

## Support

For issues or feature requests, contact the SparkNode platform team or create an issue in the project repository.
