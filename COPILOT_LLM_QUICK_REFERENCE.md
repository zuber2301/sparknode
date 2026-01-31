# SparkNode Copilot: LLM Integration Quick Reference

## Quick Start

### 1. Setup OpenAI

```bash
# Copy env template
cp backend/.env.example backend/.env

# Edit .env and add your OpenAI API key
export OPENAI_API_KEY=sk-your-key-here

# Install dependencies
pip install -r backend/requirements.txt
```

### 2. Verify LLM Works

```bash
# Check status endpoint
curl http://localhost:8000/api/copilot/status \
  -H "Authorization: Bearer YOUR_TOKEN"

# Validate API key
curl -X POST http://localhost:8000/api/copilot/validate-llm \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. Test Chat

```bash
curl -X POST http://localhost:8000/api/copilot/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "message": "Tell me about recognition",
    "context": {"page": "feed"}
  }'
```

## Key Files

| File | Purpose |
|------|---------|
| `backend/copilot/llm_service.py` | OpenAI integration, token counting, cost estimation |
| `backend/copilot/routes.py` | Chat, status, and validation endpoints |
| `frontend/src/context/copilotContext.jsx` | React state management |
| `frontend/src/components/RightSideCopilot.jsx` | Chat UI component |
| `backend/.env.example` | Configuration template |
| `COPILOT_LLM_SETUP.md` | Complete setup guide |

## API Endpoints

### POST `/api/copilot/chat`

Send a message and get an AI response with fallback.

**Request:**
```json
{
  "message": "Your question here",
  "context": {
    "page": "feed",           // dashboard, feed, wallet, budgets, users
    "selected_item_id": "123" // Optional
  },
  "conversation_history": []  // Optional
}
```

**Response:**
```json
{
  "response": "Answer text...",
  "timestamp": "2024-01-15T10:30:00Z",
  "model": "gpt-4",           // or "keyword-matching"
  "tokens": {
    "prompt": 150,
    "completion": 120,
    "total": 270
  }
}
```

### GET `/api/copilot/status`

Check if LLM is available.

**Response:**
```json
{
  "status": "operational",
  "llm_available": true,
  "model": "gpt-4",
  "version": "0.5"
}
```

### POST `/api/copilot/validate-llm`

Test OpenAI API connectivity.

**Response:**
```json
{
  "valid": true,
  "message": "OpenAI API key is valid",
  "model": "gpt-4"
}
```

## Frontend Usage

### Using the Copilot Context

```jsx
import { useCopilot } from '../context/copilotContext';

function MyComponent() {
  const { messages, sendMessage, isLoading } = useCopilot();
  
  const handleAsk = async (question) => {
    await sendMessage(question, {
      page: 'dashboard',
      selected_item_id: 'recognition_123'
    });
  };
  
  return (
    <button onClick={() => handleAsk('Tell me about this')}>
      Ask Copilot
    </button>
  );
}
```

### Accessing Messages

```jsx
const { messages } = useCopilot();

messages.forEach(msg => {
  console.log(msg.role);      // 'user' or 'assistant'
  console.log(msg.content);   // Message text
  console.log(msg.timestamp); // When sent
  console.log(msg.model);     // Which model responded
});
```

## Backend Usage

### Using LLMService

```python
from copilot.llm_service import LLMService

# Initialize
llm_service = LLMService(api_key="sk-...", model="gpt-4")

# Get response
response = await llm_service.get_response(
    message="User question",
    user=current_user,
    context={"page": "dashboard"},
    conversation_history=[],
    max_tokens=500
)

# Result
print(response['response'])     # AI response text
print(response['model'])        # 'gpt-4'
print(response['tokens'])       # {'prompt': X, 'completion': Y, 'total': Z}
```

### Building Custom System Prompts

Edit `llm_service.py` → `build_system_prompt()`:

```python
def build_system_prompt(self, context: Dict[str, Any]) -> str:
    page = context.get('page', 'dashboard')
    
    base = "You are SparkNode's AI assistant..."
    
    if page == 'feed':
        return base + "\nThe user is viewing recognition events."
    elif page == 'wallet':
        return base + "\nThe user is managing their rewards points."
    
    return base
```

## Cost Estimation

### Per Request

```python
# Estimate for one request
service = LLMService()
cost = service.estimate_cost(
    prompt_tokens=150,
    completion_tokens=120
)
# Returns: {'prompt': $0.0045, 'completion': $0.0072, 'total': $0.0117}
```

### Monthly Projection

```
1000 requests/day × 30 days = 30,000 requests
$0.0117/request × 30,000 = $351/month (GPT-4)
```

**Savings with GPT-3.5-turbo: 10x cheaper (~$35/month)**

## Fallback Strategy

The copilot automatically falls back if:
- ❌ OpenAI API key is not configured
- ❌ API key is invalid or expired
- ❌ Network error or API timeout
- ❌ Rate limit exceeded
- ❌ Unexpected API error

Then uses keyword-based responses instead.

## Troubleshooting

### LLM Not Available

```bash
# Check status
curl http://localhost:8000/api/copilot/status \
  -H "Authorization: Bearer TOKEN"

# Look for: "llm_available": false

# Validate key
curl -X POST http://localhost:8000/api/copilot/validate-llm \
  -H "Authorization: Bearer TOKEN"
```

### High Latency

First LLM request takes ~2-3 seconds. Subsequent requests are faster.

### Rate Limiting

If getting 429 errors:
1. Check OpenAI dashboard usage
2. Upgrade your plan
3. Implement request queuing

### Always Getting Keyword Matching

```python
# Debug in code
from copilot.llm_service import LLMService

if LLMService.is_llm_configured():
    print("LLM configured")
else:
    print("Missing OPENAI_API_KEY")
```

## Testing

```bash
# Run copilot tests
cd backend
pytest tests/test_copilot.py -v

# Run specific test
pytest tests/test_copilot.py::TestCopilotChat::test_chat_with_empty_message -v
```

## Environment Variables

```env
# Required for LLM
OPENAI_API_KEY=sk-your-key

# Optional - customize behavior
OPENAI_MODEL=gpt-4                    # or gpt-3.5-turbo
OPENAI_MAX_TOKENS=500                 # Response length limit
COPILOT_ENABLED=true                  # Feature flag
```

## Common Patterns

### Ask About Current Page

```jsx
const { sendMessage } = useCopilot();

// From feed page
sendMessage("What is this recognition event?", {
  page: 'feed',
  selected_item_id: recognition.id
});

// From dashboard
sendMessage("Explain this chart", {
  page: 'dashboard',
  chart: 'recognition_trends'
});
```

### Multi-Turn Conversation

```jsx
const { messages, sendMessage } = useCopilot();

// First question
await sendMessage("Tell me about budgets");

// Follow-up uses entire history
await sendMessage("How much is left?", {}, messages);
```

### Error Handling

```jsx
const { sendMessage, isLoading } = useCopilot();

try {
  await sendMessage("Question");
} catch (error) {
  console.error('Copilot error:', error);
  // User still gets keyword-based response
}
```

## Production Checklist

- [ ] Set `OPENAI_API_KEY` in production environment
- [ ] Configure billing alerts in OpenAI dashboard
- [ ] Test `/api/copilot/validate-llm` endpoint
- [ ] Monitor costs weekly
- [ ] Set up request logging
- [ ] Configure rate limits
- [ ] Test fallback behavior
- [ ] Document custom prompts
- [ ] Set `ENVIRONMENT=production` in .env
- [ ] Verify error logs are being collected

## Next Steps

1. **Add conversation persistence** - Store chat history in database
2. **Implement caching** - Cache repeated questions
3. **Add analytics** - Track which questions users ask
4. **Custom models** - Fine-tune for SparkNode domain
5. **Streaming responses** - Real-time token-by-token responses
6. **Voice input** - OpenAI Whisper integration

## References

- [OpenAI API Docs](https://platform.openai.com/docs)
- [GPT-4 Models](https://platform.openai.com/docs/models/gpt-4)
- [Token Counting](https://github.com/openai/tiktoken)
- [Rate Limits](https://platform.openai.com/docs/guides/rate-limits)
