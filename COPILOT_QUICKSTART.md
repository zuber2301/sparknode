# SparkNode Right-Side Copilot - Quick Start Guide

## What is the Right-Side Copilot?

The Right-Side Copilot is an AI-powered assistant that appears in a persistent 300-400px panel on the right side of your screen. It allows you to ask contextual questions about what you're viewing without navigating away from the page.

## Key Features

✨ **Persistent Split-Screen** - Dashboard, Feed, and Wallet scroll independently on the left while the copilot stays pinned on the right

🤖 **Contextual Intelligence** - The copilot understands what page you're on and provides relevant assistance

💬 **Natural Conversation** - Ask follow-up questions like "Tell me more about John's award" 

🎯 **Multimodal Interactions** - See a notification, ask about it immediately without context-switching

📱 **Responsive Design** - Works seamlessly on desktop, tablet, and mobile devices

## Getting Started

### For Users

1. **Open SparkNode Dashboard**
   - Log in to your SparkNode account
   - Navigate to Dashboard, Feed, Wallet, or any main section

2. **Locate the Copilot Panel**
   - Look for the right-side panel with "SparkNode Copilot" header
   - It's visible by default on desktop (hidden on mobile to save space)

3. **Ask Your First Question**
   - Click in the text area at the bottom of the copilot panel
   - Type something like: "What was this recognition event about?"
   - Press Enter or click the Send button

4. **Continue the Conversation**
   - The copilot responds with contextual information
   - Ask follow-up questions naturally
   - Use Shift+Enter to create line breaks in your message

### For Developers

#### Installation

1. **Frontend is pre-configured**
   ```bash
   cd frontend
   npm install  # Already includes all dependencies
   npm run dev  # Start development server
   ```

2. **Backend is pre-configured**
   ```bash
   cd backend
   pip install -r requirements.txt  # Ensure copilot module is imported
   python main.py  # Start FastAPI server
   ```

#### Testing the Copilot

**Test in Browser Console:**
```javascript
// Check copilot context is available
console.log(localStorage.getItem('copilot_enabled'));

// Send a test message
fetch('/api/copilot/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_TOKEN'
  },
  body: JSON.stringify({
    message: 'Hello copilot!',
    context: { page: 'dashboard' }
  })
})
.then(r => r.json())
.then(d => console.log(d));
```

**Test API Directly:**
```bash
curl -X POST http://localhost:8000/api/copilot/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "message": "Hello copilot",
    "context": {"page": "dashboard"}
  }'
```

#### File Structure

```
frontend/src/
├── components/
│   ├── Layout.jsx              # Updated with copilot integration
│   └── RightSideCopilot.jsx    # NEW: Copilot UI component
├── context/
│   └── copilotContext.jsx      # NEW: State management
└── ...

backend/
├── copilot/
│   ├── __init__.py             # NEW: Module initialization
│   └── routes.py               # NEW: API endpoints
├── main.py                      # Updated with copilot router
└── ...
```

## Example Conversations

### Scenario 1: Recognition Feed
**You:** "Tell me more about the award Sarah received"
**Copilot:** "Sarah received the 'Innovation Leader' award on January 28, 2026. This recognition highlights her contributions to the cloud migration project. She's earned 5 similar awards this quarter, placing her in the top 10% of recognized employees."

### Scenario 2: Budget Review
**You:** "How much budget remains?"
**Copilot:** "Your current recognition budget shows $45,000 remaining out of $100,000 allocated for Q1 2026. That's 45% of your quarterly budget. At the current spend rate, you'll have sufficient budget through the quarter."

### Scenario 3: Redemptions
**You:** "Which rewards offer the best value?"
**Copilot:** "Based on point-to-value analysis, the 'Premium Coffee Maker' offers the best value at $2.50 per point. The 'Wellness Package' is second at $2.15 per point. Both are good choices for your current point balance of 2,500 points."

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Enter` | Send message |
| `Shift+Enter` | New line in message |
| `Escape` | Close copilot (on mobile) |

## Settings & Customization

### Toggle Copilot Visibility
- Click the **collapse/expand button** (−) in the copilot header to minimize
- Click again to restore the panel
- Your preference is saved per session

### Clear Conversation
- Click the **trash icon** (🗑️) in the header to clear all messages
- Starts fresh with the initial greeting

### Mobile Experience
- On small screens, tap the copilot icon to toggle visibility
- Copilot expands to full width when opened
- Main content becomes scrollable sidebar

## Troubleshooting

### Copilot not appearing
1. Clear your browser cache
2. Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
3. Check if you're logged in
4. Verify JavaScript is enabled

### Messages not sending
1. Check your internet connection
2. Ensure the backend server is running
3. Check browser console for errors (F12 → Console tab)
4. Verify your authentication token is valid

### Responses seem generic
- The current version uses keyword matching
- More sophisticated AI responses coming in future updates
- Provide more context in your questions for better responses

## Next Steps

### Coming Soon (Roadmap)

**v0.5 - Enhanced AI**
- Integration with LLM (Large Language Model)
- Better understanding of complex questions
- Memory of previous conversations

**v0.6 - Advanced Features**
- Voice input support
- Screenshot analysis
- Conversation export
- Recommendations engine

**v0.7 - Integration**
- Admin task automation
- Report generation
- Workflow suggestions

## Tips for Best Results

1. **Be Specific** - "John's recognition" works better than "that award"
2. **Ask Follow-ups** - The copilot understands context
3. **Provide Context** - Tell it what page you're on or what you're looking at
4. **Use Natural Language** - Speak as you normally would
5. **Explore Features** - Try different question types to discover capabilities

## Feedback & Support

Have ideas for improving the copilot? Found a bug?

1. **Report Issues** - Create an issue in the project repository
2. **Share Feedback** - Contact the SparkNode team with suggestions
3. **Feature Requests** - Let us know what you'd like the copilot to do

## FAQ

**Q: Are my conversations saved?**
A: Conversations are stored only in your browser session. They're cleared when you close the browser tab or clear browser data.

**Q: Can the copilot access my sensitive data?**
A: The copilot only has access to what's visible on the current page and what you tell it. All communication is authenticated and encrypted.

**Q: Is the copilot using my data to train AI models?**
A: No. The current version uses keyword matching. When LLM integration comes, we'll have clear data privacy policies in place.

**Q: Can I use the copilot on mobile?**
A: Yes! The copilot is fully responsive, though it takes up screen space on small devices. You can minimize it if needed.

**Q: What if the copilot gives me wrong information?**
A: Always verify important decisions with actual data. The copilot is a helper, not a source of truth. We're continuously improving accuracy.

---

**Version:** 0.4 (MVP)
**Last Updated:** January 31, 2026
