# Right-Side Copilot Architecture Diagram

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SparkNode Application                       │
├──────────────────────────────────────────┬──────────────────────────┤
│                                          │                          │
│        Main Content Area                 │   Right-Side Copilot     │
│  (Dashboard/Feed/Wallet)                 │      (320px fixed)       │
│                                          │                          │
│  ┌────────────────────────────────────┐  │  ┌──────────────────────┐│
│  │        Header / Navigation          │  │  │ 🎨 SparkNode Copilot ││
│  │                                     │  │  │ AI Assistant      [−]││
│  ├────────────────────────────────────┤  │  ├──────────────────────┤│
│  │                                     │  │  │                      ││
│  │  Main Content (scrollable)          │  │  │ Assistant: Hello!    ││
│  │  - Cards                           │  │  │                      ││
│  │  - Charts                          │  │  │ You: Tell me more    ││
│  │  - Tables                          │  │  │                      ││
│  │  - Lists                           │  │  │ Assistant: [response]││
│  │                                     │  │  │                      ││
│  │                                     │  │  │                      ││
│  │                                     │  │  ├──────────────────────┤│
│  │                                     │  │  │ ┌──────────────────┐ ││
│  │                                     │  │  │ │ Ask me anything  │ ││
│  │                                     │  │  │ │ Shift+Enter...   │ ││
│  │                                     │  │  │ └──────────────────┘ ││
│  │                                     │  │  │ [ Send ]             ││
│  │                                     │  │  │ Help text...         ││
│  └────────────────────────────────────┘  │  └──────────────────────┘│
│                                          │                          │
│  pr-80 when copilot open                 │  w-80 fixed right       │
│  no padding when closed                  │  z-40 positioning       │
└──────────────────────────────────────────┴──────────────────────────┘
```

## Component Hierarchy

```
<App>
  └── <Layout>
      └── <CopilotProvider>
          ├── <Sidebar>
          ├── <MainContent>
          │   ├── <Header>
          │   └── <Outlet> (Dashboard/Feed/etc)
          │
          └── <RightSideCopilot>
              ├── Header
              │   ├── Title & Icon
              │   ├── Clear Button
              │   └── Toggle Button
              │
              ├── Messages Area
              │   ├── Message 1 (Assistant)
              │   ├── Message 2 (User)
              │   └── Message 3 (Assistant)
              │
              └── Input Area
                  ├── Textarea
                  └── Send Button
```

## Data Flow Diagram

```
Frontend                    Backend                Database
───────────────────────────────────────────────────────────

User Types Message
        │
        ▼
useCopilot.sendMessage()
        │
        ▼
addMessage(userMessage)      [Add to UI immediately]
        │
        ▼
POST /api/copilot/chat
        │
        ├──────────────────▶ verify_token()
        │                         │
        │                         ▼
        │                   get_current_user
        │                         │
        ├──────────────────────────▶ JWT Lookup
        │
        ├──────────────────▶ generate_copilot_response()
        │                         │
        │                         ▼
        │                   Keyword Matching
        │                         │
        │                         ▼
        │                   Context Analysis
        │                         │
        │                         ▼
        │                   Response Template
        │                         │
        ◀──────────────────────── Response JSON
        │
        ▼
addMessage(assistantResponse)  [Add response to UI]
        │
        ▼
Display in Chat Interface
        │
        ▼
User Sees Response
```

## State Management Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    CopilotContext                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  State:                                                     │
│  ├── isOpen: boolean                                       │
│  ├── messages: Message[]                                   │
│  ├── isLoading: boolean                                    │
│                                                             │
│  Methods:                                                   │
│  ├── sendMessage(content, context)                         │
│  ├── addMessage(content, type)                             │
│  ├── clearMessages()                                       │
│  └── toggleOpen()                                          │
│                                                             │
│  Consumed by:                                              │
│  └── RightSideCopilot Component                           │
│      └── useCopilot() hook                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Message Object Structure

```json
{
  "id": "1705147445000",
  "type": "user|assistant",
  "content": "Tell me more about this",
  "timestamp": "2026-01-31T10:30:45.123Z"
}
```

## API Request/Response Structure

```
POST /api/copilot/chat

Headers:
├── Content-Type: application/json
└── Authorization: Bearer <JWT_TOKEN>

Request Body:
{
  "message": "What does this chart show?",
  "context": {
    "page": "dashboard",
    "visible_data": {
      "timeframe": "Q1 2026",
      "metric": "recognitions"
    }
  }
}

Response (200 OK):
{
  "response": "This chart shows...",
  "timestamp": "2026-01-31T10:30:45.123456"
}
```

## Layout Responsive Behavior

```
Desktop (1024px+):
┌─────────────────────────────────────────────┐
│ Sidebar  │  Main Content      │ Copilot     │
│  264px   │   [responsive]     │   320px     │
└─────────────────────────────────────────────┘

Tablet (768px-1023px):
┌──────────────────────────────────┐
│ Menu │ Main Content │ Copilot     │
│      │  (adjusts)   │ (320px)     │
└──────────────────────────────────┘

Mobile (<768px):
┌────────────────────────┐
│ Menu │ Main Content     │
│      │ (full width)     │ ← Copilot hidden
└────────────────────────┘

[Toggle Copilot] (when tapped, shows in overlay)
```

## CSS Class Flow

```
Layout.jsx
└── <div className="min-h-screen bg-gray-50">
    ├── <aside> (w-64 sidebar)
    │
    └── <div className="lg:pl-64 flex flex-col 
                        transition-all duration-300
                        ${isOpen ? 'pr-80' : ''}">
        ├── <header> (sticky top)
        └── <main> (flex-1)
            └── <Outlet />
    
    └── {isOpen && <RightSideCopilot />}
        └── <div className="fixed right-0 top-0 
                           h-screen w-80 
                           bg-white shadow-lg z-40">
```

## Authentication Flow

```
Browser Session
    ↓
User Login
    ↓
JWT Token Stored (localStorage or session)
    ↓
User Navigate to Protected Route
    ↓
Layout Component Mounts
    ↓
CopilotProvider Created
    ↓
User Sends Copilot Message
    ↓
sendMessage() includes Authorization Header
    ↓
Backend: get_current_user dependency
    ↓
Verify JWT Token
    ↓
Extract User Info
    ↓
Process Copilot Request with User Context
    ↓
Return Response
```

## Event Flow Diagram

```
User Types → onKeyDown → Check for Enter
            ↓
         If Enter (not Shift+Enter)
            ↓
         handleSendMessage()
            ↓
         Check inputValue not empty
            ↓
         Call sendMessage(inputValue)
            ↓
         addMessage(userMessage, 'user')
            ↓
         Clear inputValue
            ↓
         setIsLoading(true)
            ↓
         POST /api/copilot/chat
            ↓
         Response Received
            ↓
         addMessage(response, 'assistant')
            ↓
         setIsLoading(false)
            ↓
         messagesEndRef.scrollIntoView()
            ↓
         Display Complete
```

## Error Handling Flow

```
sendMessage() called
    ↓
Try Block
    │
    ├─→ fetch('/api/copilot/chat')
    │       ↓
    │    Response OK?
    │       ├─ Yes → Parse JSON → Return response
    │       └─ No → throw Error
    │
    └─→ Catch Block
            ↓
         Add Error Message
            ↓
         Log Error
            ↓
         Display Friendly Message
```

## Responsive Visibility

```
Screen Width        Copilot Status      User Action
────────────────────────────────────────────────────
< 768px             Hidden by default   Toggle shows overlay
768px - 1023px      Visible as toggle   Always available
1024px+             Always visible      Always available
```

## Performance Optimization Points

```
✅ Memoization
   - useCopilot hook prevents unnecessary re-renders
   - Context updates only notify subscribers

✅ Lazy Loading
   - Messages loaded as conversation grows
   - No initial data fetching

✅ Scroll Performance
   - useRef for message end element
   - Smooth scroll behavior

✅ Input Optimization
   - Textarea only updates on change
   - Send button disabled during loading

✅ Network Optimization
   - Single API call per message
   - Minimal payload size
```

## Future Enhancement Points

```
Phase 2: LLM Integration
├── Replace generate_copilot_response()
├── Add streaming responses
└── Implement conversation memory

Phase 3: Advanced Features
├── Voice input (Web Speech API)
├── Screenshot capture (html2canvas)
├── Conversation export
└── Analytics integration

Phase 4: Intelligence
├── Real-time data fetching
├── Recommendation engine
├── Task automation
└── Predictive suggestions
```

---

**Last Updated:** January 31, 2026
