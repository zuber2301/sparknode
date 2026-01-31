# Copilot API Reference

## Base URL
```
POST /api/copilot/chat
```

## Authentication
All requests require Bearer token authentication via `Authorization` header.

```
Authorization: Bearer <JWT_TOKEN>
```

## Request

### Headers
```
Content-Type: application/json
Authorization: Bearer <JWT_TOKEN>
```

### Body Schema

```python
class CopilotMessageRequest(BaseModel):
    message: str                      # Required: User's question/message
    context: Optional[Dict[str, Any]] # Optional: Contextual metadata
```

#### Context Fields (Optional)
```python
{
    "page": "dashboard|feed|wallet|recognize|redeem|events|budgets",
    "visible_data": {
        # Any relevant data visible on current page
        "user_id": "...",
        "recognition_id": "...",
        "timeframe": "Q1 2026",
        # etc.
    },
    "user_role": "corporate_user|tenant_admin|hr_admin|platform_admin"
}
```

## Response

### Success Response (200)

```python
class CopilotMessageResponse(BaseModel):
    response: str          # AI-generated response text
    timestamp: datetime    # ISO 8601 timestamp
```

**Example:**
```json
{
  "response": "Based on the current data, your top performers this quarter are Sarah Chen with 8 recognitions and James Wilson with 7. The average recognition points awarded have increased by 23% compared to Q4.",
  "timestamp": "2026-01-31T10:30:45.123456"
}
```

### Error Responses

#### 400 - Bad Request
```json
{
  "detail": "Message is required"
}
```

#### 401 - Unauthorized
```json
{
  "detail": "Not authenticated"
}
```

#### 500 - Internal Server Error
```json
{
  "detail": "Failed to process copilot request"
}
```

## Examples

### Basic Example
```bash
curl -X POST http://localhost:8000/api/copilot/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -d '{
    "message": "What were the top recognitions this month?",
    "context": {
      "page": "dashboard"
    }
  }'
```

### With Detailed Context
```bash
curl -X POST http://localhost:8000/api/copilot/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "message": "Tell me more about this employee",
    "context": {
      "page": "feed",
      "visible_data": {
        "user_id": "user_123",
        "user_name": "John Smith",
        "recognition_id": "rec_456"
      },
      "user_role": "tenant_admin"
    }
  }'
```

### JavaScript/Fetch Example
```javascript
async function askCopilot(message, context = {}) {
  try {
    const token = localStorage.getItem('auth_token');
    const response = await fetch('/api/copilot/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        message: message,
        context: context
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return data.response;
  } catch (error) {
    console.error('Copilot request failed:', error);
    return 'Sorry, I encountered an error. Please try again.';
  }
}

// Usage
const response = await askCopilot(
  'What are our budget trends?',
  { page: 'budgets', visible_data: { timeframe: 'Q1' } }
);
console.log(response);
```

### Python Example
```python
import requests
from typing import Optional, Dict, Any

def ask_copilot(
    message: str,
    context: Optional[Dict[str, Any]] = None,
    token: str = None
) -> str:
    """Send a message to the copilot API."""
    
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {token}'
    }
    
    payload = {
        'message': message,
        'context': context or {}
    }
    
    response = requests.post(
        'http://localhost:8000/api/copilot/chat',
        json=payload,
        headers=headers
    )
    
    if response.status_code == 200:
        return response.json()['response']
    else:
        raise Exception(f"Copilot API error: {response.status_code}")

# Usage
token = 'your_jwt_token'
response = ask_copilot(
    'What were the top recognitions this month?',
    context={'page': 'dashboard'},
    token=token
)
print(response)
```

## Rate Limiting

Current rate limits:
- **Default:** 60 requests per minute per user
- **Admin:** 300 requests per minute

Rate limit headers included in response:
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
X-RateLimit-Reset: 1643612400
```

## Response Generation Logic

The copilot uses a keyword-based response system in the MVP:

1. **Extract Keywords** - Parse user message for recognized keywords
2. **Determine Context** - Check current page and visible data
3. **Select Response Template** - Choose appropriate response based on keywords and context
4. **Personalize** - Inject user data (first name, role, etc.) if available
5. **Return Response** - Send personalized response to client

### Supported Keywords

#### General
- `hello`, `hi`, `hey`, `greetings` → Greeting response
- `recognition`, `award`, `reward` → Recognition information
- `budget`, `spend`, `cost`, `allocation` → Budget information
- `user`, `employee`, `person`, `team` → User information
- `tell`, `more`, `about`, `explain`, `what` → Context-aware help

#### Page-Specific
- **Feed**: Questions about recognition events, user achievements
- **Dashboard**: Questions about metrics, trends, charts
- **Wallet**: Questions about redemptions, points, values

## Implementation Details

### Response Generation Function

```python
def generate_copilot_response(
    message: str,
    context: Dict[str, Any],
    user: User
) -> str:
    """
    Generate a contextual response based on message, context, and user.
    
    Args:
        message: User's input message
        context: Optional contextual information
        user: Current authenticated user
    
    Returns:
        Generated response string
    """
    message_lower = message.lower()
    page = context.get('page', '')
    
    # Keyword matching and response generation logic
    # Returns personalized response
```

### Authentication & User Context

All requests automatically include:
- **Current User ID** - From JWT token
- **Tenant Context** - From tenant middleware
- **User Metadata** - Name, role, organization

These are available to the response generator for personalization.

## Future Enhancements

### LLM Integration (v0.5)
```python
from openai import OpenAI

def generate_copilot_response_llm(
    message: str,
    context: Dict[str, Any],
    user: User
) -> str:
    """Use LLM for sophisticated responses."""
    
    client = OpenAI(api_key=settings.openai_api_key)
    
    system_prompt = f"""
    You are SparkNode's helpful AI assistant. 
    The user {user.first_name} is viewing the {context.get('page')} page.
    Provide helpful, contextual responses about recognition, budgets, and employee data.
    """
    
    response = client.chat.completions.create(
        model="gpt-4",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": message}
        ],
        max_tokens=500
    )
    
    return response.choices[0].message.content
```

### Conversation Memory (v0.5)
```python
class CopilotConversation(Base):
    __tablename__ = "copilot_conversations"
    
    id = Column(UUID, primary_key=True)
    user_id = Column(UUID, ForeignKey("users.id"))
    messages = Column(JSON)  # Store full conversation
    created_at = Column(DateTime)
    updated_at = Column(DateTime)
```

### Analytics (v0.6)
```python
class CopilotAnalytics:
    """Track copilot usage and effectiveness."""
    
    - Messages per user
    - Response time metrics
    - User satisfaction (from feedback)
    - Most asked questions
    - Feature requests
```

## Monitoring & Logging

### Log Levels

- **DEBUG**: All requests, responses, processing steps
- **INFO**: Successful requests, usage statistics
- **WARNING**: Slow responses, rate limit approaching
- **ERROR**: Failed requests, API errors

### Metrics to Track

1. **Response Time** - How long does it take to generate a response?
2. **User Engagement** - How many users use the copilot?
3. **Message Success Rate** - How many messages generate valid responses?
4. **Error Rate** - How often do requests fail?

### Observability

```python
from prometheus_client import Counter, Histogram

copilot_messages_total = Counter(
    'copilot_messages_total',
    'Total copilot messages',
    ['user_role', 'page']
)

copilot_response_time = Histogram(
    'copilot_response_seconds',
    'Copilot response time'
)
```

## Security Considerations

1. **Authentication Required** - All endpoints require valid JWT token
2. **Rate Limiting** - Prevent abuse with per-user rate limits
3. **Data Validation** - Sanitize message input
4. **CORS Policy** - Restrict requests to authorized origins
5. **Audit Logging** - Log all copilot interactions
6. **Data Privacy** - Don't store sensitive data in conversation history

## Testing

### Unit Tests
```python
def test_copilot_requires_auth(client):
    response = client.post('/api/copilot/chat', json={'message': 'hello'})
    assert response.status_code == 401

def test_copilot_requires_message(client, auth_headers):
    response = client.post('/api/copilot/chat', json={}, headers=auth_headers)
    assert response.status_code == 400

def test_copilot_response_format(client, auth_headers):
    response = client.post(
        '/api/copilot/chat',
        json={'message': 'hello'},
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert 'response' in data
    assert 'timestamp' in data
```

### Integration Tests
```python
def test_full_conversation_flow(client, auth_headers):
    # Send message
    response = client.post(
        '/api/copilot/chat',
        json={'message': 'tell me about recognitions'},
        headers=auth_headers
    )
    
    # Verify response
    assert response.status_code == 200
    assert len(response.json()['response']) > 0
    
    # Verify timestamp format
    import dateutil.parser
    dateutil.parser.parse(response.json()['timestamp'])
```

---

**API Version:** 0.4 (MVP)
**Last Updated:** January 31, 2026
