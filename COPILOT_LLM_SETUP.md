# SparkNode Copilot: OpenAI LLM Setup Guide

## Overview

This guide explains how to set up OpenAI integration for the SparkNode Copilot to enable GPT-4 powered responses with intelligent fallback to keyword-matching.

## Prerequisites

- Python 3.11+
- FastAPI backend running
- An OpenAI account with API access

## Installation

### 1. Update Dependencies

The required libraries have been added to `requirements.txt`:

```bash
# Install new dependencies
pip install openai==1.3.9 tiktoken==0.5.1

# Or update entire requirements
pip install -r backend/requirements.txt
```

### 2. Environment Configuration

Create or update your `.env` file in the project root:

```env
# OpenAI Configuration
OPENAI_API_KEY=sk-your-api-key-here
OPENAI_MODEL=gpt-4  # or gpt-3.5-turbo for cost savings
OPENAI_MAX_TOKENS=500
```

**Important:** Never commit your `.env` file to version control. It's already in `.gitignore`.

### 3. Getting an OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com)
2. Sign up or log in to your account
3. Navigate to **API keys** section
4. Click **Create new secret key**
5. Copy the key and add it to your `.env` file
6. **Never share or expose this key**

### 4. Set API Usage Limits (Recommended)

To prevent unexpected costs:

1. Go to **Billing** → **Usage Limits** in OpenAI dashboard
2. Set a monthly budget cap (e.g., $50)
3. Set a hard limit to stop requests when exceeded

## Architecture

### LLM Service Layer

**File:** `backend/copilot/llm_service.py`

The `LLMService` class handles:
- OpenAI API client initialization
- Context-aware system prompt building
- Token counting and cost estimation
- Async request handling with proper error handling
- Graceful fallback mechanism

**Key Methods:**

```python
# Initialize service
llm_service = LLMService(api_key="sk-...", model="gpt-4")

# Get AI response with conversation history
response = await llm_service.get_response(
    message="Tell me about this recognition",
    user=current_user,
    context={"page": "feed"},
    conversation_history=[...],  # Previous messages
    max_tokens=500
)

# Validate API key connectivity
is_valid = llm_service.validate_api_key()

# Estimate costs for a request
cost = llm_service.estimate_cost(prompt_tokens=100, completion_tokens=50)
```

### Chat Handler with Fallback

**File:** `backend/copilot/routes.py` → `/chat` endpoint

The chat endpoint:

1. **Tries LLM first** if OpenAI is configured and API key is valid
2. **Falls back to keyword matching** if:
   - LLM service is not configured
   - OpenAI API call fails
   - API rate limit is exceeded
3. **Returns response metadata** including:
   - Model used (gpt-4, gpt-3.5-turbo, or keyword-matching)
   - Token usage (for cost tracking)
   - Timestamp

### System Prompts

The LLM service builds context-aware system prompts based on the current page:

- **Dashboard**: Recognition metrics and trends
- **Feed**: Recognition events and social interactions
- **Wallet**: Points, redemptions, and rewards
- **Budgets**: Budget allocation and spending
- **Users**: User achievements and statistics

Example system prompt:

```
You are SparkNode's AI Copilot, helping users understand their 
recognition and engagement platform. The user is currently viewing 
the Recognition Feed where they can see recent recognition events 
and user achievements.

Be helpful, concise, and specific to what they're viewing. 
Focus on insights from their data.
```

## API Endpoints

### 1. Chat Endpoint

**POST** `/api/copilot/chat`

Request:
```json
{
  "message": "Tell me about this recognition event",
  "context": {
    "page": "feed",
    "selected_item_id": "recognition_123"
  },
  "conversation_history": [
    {"role": "user", "content": "What is SparkNode?"},
    {"role": "assistant", "content": "SparkNode is a recognition platform..."}
  ]
}
```

Response:
```json
{
  "response": "This recognition event highlights...",
  "timestamp": "2024-01-15T10:30:00Z",
  "model": "gpt-4",
  "tokens": {
    "prompt": 150,
    "completion": 120,
    "total": 270
  }
}
```

### 2. Status Endpoint

**GET** `/api/copilot/status`

Check if LLM is available:

```json
{
  "status": "operational",
  "llm_available": true,
  "model": "gpt-4",
  "version": "0.5"
}
```

### 3. Validate LLM Endpoint

**POST** `/api/copilot/validate-llm`

Verify OpenAI API key is working:

```json
{
  "valid": true,
  "message": "OpenAI API key is valid",
  "model": "gpt-4"
}
```

## Cost Management

### Token Counting

The service automatically counts tokens using `tiktoken`:

```python
prompt_tokens = self.encoding.encode(prompt)
completion_tokens = self.encoding.encode(response)
total_tokens = len(prompt_tokens) + len(completion_tokens)
```

### Cost Estimation

GPT-4 pricing (as of January 2024):
- **Input:** $0.03 per 1,000 tokens
- **Output:** $0.06 per 1,000 tokens

Example: 150 prompt tokens + 120 completion tokens
```
Cost = (150 * 0.03 / 1000) + (120 * 0.06 / 1000)
     = $0.0045 + $0.0072
     = $0.0117 per request
```

Estimated monthly cost (1000 requests/day):
```
$0.0117 * 1000 * 30 = $351/month
```

**Pro Tip:** Use GPT-3.5-turbo for cost savings (10x cheaper):
```env
OPENAI_MODEL=gpt-3.5-turbo
```

### Monitoring Costs

1. Check OpenAI dashboard → **Usage** section regularly
2. Set up billing alerts
3. Log all API calls with token counts for analytics
4. Consider implementing request rate limits

## Troubleshooting

### Issue: "OPENAI_API_KEY not configured"

**Solution:** Ensure `.env` file has `OPENAI_API_KEY=sk-...`

Verify:
```bash
# In Python shell
import os
print(os.getenv("OPENAI_API_KEY"))  # Should print your key
```

### Issue: "Invalid or expired API key"

**Solution:** 
1. Check key expiration in OpenAI dashboard
2. Regenerate key if necessary
3. Update `.env` file
4. Restart backend

### Issue: Rate Limit Errors (429 responses)

**Solution:**
1. Check usage limits in OpenAI dashboard
2. Implement exponential backoff in client
3. Consider upgrading OpenAI plan
4. Implement request queuing

### Issue: High Latency on First Request

**Solution:** Model loading is slow first time. Subsequent requests are faster. Consider keeping service running.

### Issue: Fallback to Keyword Matching Not Working

**Debug Steps:**
1. Check logs: `GET /api/copilot/status`
2. Validate API key: `POST /api/copilot/validate-llm`
3. Check error in server logs (watch for `LLM request failed` messages)
4. Verify network connectivity from backend to OpenAI

## Monitoring and Logging

The copilot logs important events:

```python
# Successful LLM call
logger.info(f"LLM response generated for user {user.id} (tokens: {tokens['total']})")

# LLM failure with fallback
logger.warning(f"LLM request failed: {error}. Falling back to keyword matching.")

# Service initialization
logger.info("LLM service initialized successfully")
```

Check logs:
```bash
# Docker logs
docker-compose logs -f sparknode-backend

# Or check application logs directly
tail -f logs/sparknode.log
```

## Testing

### Manual Testing

```bash
# Test endpoint with keyword matching (no LLM)
curl -X POST http://localhost:8000/api/copilot/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "message": "Tell me about recognition",
    "context": {"page": "feed"}
  }'

# Check status
curl http://localhost:8000/api/copilot/status

# Validate LLM
curl -X POST http://localhost:8000/api/copilot/validate-llm \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Automated Testing

```bash
# Run copilot tests
cd backend
pytest tests/test_copilot.py -v

# With LLM integration
pytest tests/test_copilot_llm.py -v
```

## Production Deployment

### Environment Variables

Set these in your production environment:

```bash
# Required
OPENAI_API_KEY=sk-...

# Optional
OPENAI_MODEL=gpt-4
OPENAI_MAX_TOKENS=500
COPILOT_ENABLED=true
```

### Recommendations

1. **Use environment secrets** (Docker Secrets or K8s Secrets)
2. **Monitor costs** - Set up billing alerts
3. **Implement caching** - Cache repeated questions
4. **Rate limiting** - Limit requests per user per hour
5. **Logging** - Track all LLM calls for analytics
6. **Fallback handling** - Ensure graceful degradation

## Advanced Configuration

### Custom System Prompt

Modify `llm_service.py` → `build_system_prompt()` to customize the AI behavior:

```python
def build_system_prompt(self, context: Dict[str, Any]) -> str:
    """Build context-aware system prompt"""
    page = context.get('page', 'dashboard')
    
    # Add your custom instructions
    base_prompt = "You are SparkNode's AI assistant..."
    # Customize based on page
    return base_prompt
```

### Custom Model

```python
llm_service = LLMService(
    api_key="sk-...",
    model="gpt-4-turbo"  # Use newer model
)
```

### Async Streaming Responses

The service supports streaming for real-time responses:

```python
async with llm_service.client.chat.completions.create(
    model="gpt-4",
    messages=messages,
    stream=True
) as stream:
    async for chunk in stream:
        # Process chunk in real-time
        pass
```

## References

- [OpenAI API Documentation](https://platform.openai.com/docs)
- [OpenAI Models Overview](https://platform.openai.com/docs/models)
- [OpenAI Rate Limits](https://platform.openai.com/docs/guides/rate-limits)
- [Tiktoken Token Counting](https://github.com/openai/tiktoken)

## Support

For issues or questions:

1. Check the troubleshooting section above
2. Review server logs for error messages
3. Contact OpenAI support for API issues
4. Check SparkNode issues on GitHub
