# 🎯 Deploy NOW Checklist (30 minutes to live)

## STEP 1: Commit Code (5 min)

```bash
cd /root/repos_products/sparknode

# Stage all changes
git add -A

# Commit with detailed message
git commit -m "feat: Deploy OpenAI LLM integration for Copilot v0.5

✨ Features:
- GPT-4 powered responses with fallback to keyword matching
- Token counting and cost estimation per request
- Conversation history support
- Page-aware system prompts
- 3 new API endpoints (/chat, /status, /validate-llm)
- 19 comprehensive test cases
- Production-ready error handling

📊 Files Added:
- backend/copilot/llm_service.py (295 lines)
- backend/tests/test_copilot.py (340 lines)
- 7 comprehensive documentation guides

🔧 Configuration:
- Add OPENAI_API_KEY to environment
- Install openai and tiktoken packages
- Run tests: pytest backend/tests/test_copilot.py -v

🚀 Next:
- Deploy to staging/production
- Monitor for 1 week
- Iterate based on feedback
- Optimize costs and prompts

See DEPLOY_AND_ITERATE.md for full deployment guide"

# Verify commit
git log --oneline -1
```

---

## STEP 2: Push to Remote (2 min)

```bash
# Push to feature branch
git push origin feature/v0.4

# Or push to main if ready for production
# git checkout main
# git pull origin main
# git merge feature/v0.4
# git push origin main
```

---

## STEP 3: Set Environment Variables (3 min)

### For Staging/Production Server:

```bash
# Get API key from https://platform.openai.com/api-keys

# Set environment variable
export OPENAI_API_KEY=sk-your-actual-key-here

# Verify it's set
echo $OPENAI_API_KEY  # Should print your key

# (Optional) Add to .env file if using Docker
echo "OPENAI_API_KEY=sk-your-actual-key-here" >> backend/.env
```

---

## STEP 4: Install Dependencies (5 min)

```bash
cd /root/repos_products/sparknode

# Install requirements
pip install -r backend/requirements.txt

# Verify openai installed
python3 -c "from openai import OpenAI; print('✅ OpenAI installed')"

# Verify tiktoken installed  
python3 -c "import tiktoken; print('✅ tiktoken installed')"
```

---

## STEP 5: Run Tests (5 min)

```bash
cd /root/repos_products/sparknode/backend

# Run all copilot tests
pytest tests/test_copilot.py -v

# Expected output:
# ✅ 19 passed in X.XXs
```

---

## STEP 6: Start Backend (2 min)

```bash
# Option A: Direct Python
cd /root/repos_products/sparknode
python backend/main.py

# Option B: Docker
docker-compose up -d sparknode-backend

# Wait for startup message:
# "INFO:     Uvicorn running on http://0.0.0.0:8000"
```

---

## STEP 7: Verify Deployment (5 min)

### Test 1: Status Endpoint
```bash
curl -s http://localhost:8000/api/copilot/status \
  -H "Authorization: Bearer test-token" | json_pp

# Expected:
# {
#   "status": "operational",
#   "llm_available": true,
#   "model": "gpt-4",
#   "version": "0.5"
# }
```

### Test 2: Validate LLM
```bash
curl -s -X POST http://localhost:8000/api/copilot/validate-llm \
  -H "Authorization: Bearer test-token" | json_pp

# Expected (if API key valid):
# {
#   "valid": true,
#   "message": "OpenAI API key is valid",
#   "model": "gpt-4"
# }

# Or (if API key not set):
# {
#   "valid": false,
#   "message": "LLM service not initialized",
#   "error": "OPENAI_API_KEY not configured"
# }
```

### Test 3: Chat Endpoint
```bash
curl -s -X POST http://localhost:8000/api/copilot/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-token" \
  -d '{
    "message": "Tell me about recognition",
    "context": {"page": "feed"}
  }' | json_pp

# Expected (with LLM):
# {
#   "response": "Recognition is...",
#   "model": "gpt-4",
#   "tokens": {
#     "prompt": 150,
#     "completion": 120,
#     "total": 270
#   },
#   "timestamp": "2026-01-31T..."
# }

# Or (without LLM/fallback):
# {
#   "response": "Recognition is...",
#   "model": "keyword-matching",
#   "tokens": null,
#   "timestamp": "2026-01-31T..."
# }
```

**Result:** ✅ Copilot is live!

---

## STEP 8: Set Up Monitoring (5 min)

### Set Billing Alert
```bash
# Go to: https://platform.openai.com/account/billing/overview
# Click "Billing limits"
# Set monthly budget to: $50 (adjust as needed)
# Set hard limit to: $60 (to prevent overages)
```

### Set Log Monitoring
```bash
# Monitor LLM calls
tail -f logs/sparknode.log | grep "LLM response"

# Monitor errors
tail -f logs/sparknode.log | grep ERROR

# Monitor fallbacks
tail -f logs/sparknode.log | grep "keyword matching"
```

### Create Alert Channel (Slack/Discord)
```
Post hourly updates:
- Messages processed
- LLM calls
- Fallback rate
- Cost so far
- Any errors
```

---

## 🎉 YOU'RE LIVE! 

Your copilot is now deployed and running. Here's what happens next:

### Day 1: Monitor
- Watch logs for errors
- Check OpenAI API status
- Monitor cost
- Collect initial user feedback

### Day 3: First Iteration
- Review metrics
- Decide on cost optimization (GPT-4 vs GPT-3.5-turbo)
- Start improving system prompts based on feedback

### Day 7: Weekly Review
- Full metrics analysis
- Plan next improvements
- Consider next phase (persistence, analytics, etc.)

---

## 📋 Quick Troubleshooting

### "API key not configured"
```bash
# Check it's set
echo $OPENAI_API_KEY

# If empty, set it:
export OPENAI_API_KEY=sk-your-key-here

# If using .env file:
cat backend/.env | grep OPENAI_API_KEY
```

### "Tests failing"
```bash
# Reinstall dependencies
pip install --upgrade -r backend/requirements.txt

# Run tests again
pytest backend/tests/test_copilot.py -v
```

### "Copilot returning errors"
```bash
# Check logs
tail -f logs/sparknode.log | grep ERROR

# Validate API key
curl -X POST http://localhost:8000/api/copilot/validate-llm \
  -H "Authorization: Bearer test-token"

# Check OpenAI status
# https://status.openai.com
```

### "Too many requests / Rate limiting"
```bash
# Check OpenAI usage
# https://platform.openai.com/usage/overview

# Reduce request rate or upgrade plan
# Consider switching to GPT-3.5-turbo (cheaper + faster)
```

---

## 📚 Next Reading

After deployment:

1. **[DEPLOY_AND_ITERATE.md](DEPLOY_AND_ITERATE.md)** - Daily/weekly iteration guide
2. **[COPILOT_METRICS_DASHBOARD.md](COPILOT_METRICS_DASHBOARD.md)** - Track metrics
3. **[COPILOT_LLM_SETUP.md](COPILOT_LLM_SETUP.md)** - Deep dive reference

---

## ✅ Success Criteria

You're done when you see:

- ✅ Tests passing (19/19)
- ✅ Status endpoint returns operational
- ✅ LLM validation returns valid
- ✅ Chat endpoint returns responses
- ✅ Logs show LLM calls or fallbacks (no errors)
- ✅ OpenAI dashboard shows usage
- ✅ Billing alerts set
- ✅ Monitoring logs flowing

**That's it! You're deployed. Now monitor and iterate.** 🚀

---

## 🚀 Command Summary

```bash
# The complete deploy command:
cd /root/repos_products/sparknode && \
git add -A && \
git commit -m "Deploy Copilot v0.5 with OpenAI LLM" && \
git push origin feature/v0.4 && \
pip install -r backend/requirements.txt && \
pytest backend/tests/test_copilot.py -v && \
python backend/main.py

# Then test (in another terminal):
curl -X POST http://localhost:8000/api/copilot/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-token" \
  -d '{"message":"Hello"}'
```

**Go! Deploy now! ⚡**
