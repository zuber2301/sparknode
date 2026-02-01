# 🚀 Deploy & Iterate: Quick Start Guide

## Phase 1: Commit & Deploy (Today - 1 hour)

### Step 1: Commit All Changes
```bash
cd /root/repos_products/sparknode
git add -A
git commit -m "feat: Add OpenAI LLM integration to copilot v0.5

- Implement LLMService with GPT-4 support
- Add /chat, /status, /validate-llm endpoints
- Include 19 comprehensive tests
- Add token counting and cost estimation
- Implement fallback to keyword matching
- Complete documentation (7 guides)

Features:
- Async response handling with conversation history
- Page-aware system prompts
- Automatic API key validation
- Comprehensive error logging
- Production-ready security

Next: Deploy to staging, then production after testing."
```

### Step 2: Push to Remote
```bash
git push origin feature/v0.4
```

### Step 3: Set Up Environment (Choose One)

**For Staging:**
```bash
# On staging server:
export OPENAI_API_KEY=sk-your-staging-key
cd /path/to/sparknode
git pull origin feature/v0.4
pip install -r backend/requirements.txt
```

**For Production:**
```bash
# On production server:
export OPENAI_API_KEY=sk-your-production-key
cd /path/to/sparknode
git pull origin feature/v0.4
pip install -r backend/requirements.txt
python backend/main.py  # or your deployment script
```

### Step 4: Verify Deployment (5 minutes)
```bash
# Test 1: Status endpoint
curl http://localhost:8000/api/copilot/status \
  -H "Authorization: Bearer YOUR_TOKEN"
# Expected: {"status": "operational", "llm_available": true, ...}

# Test 2: Validate LLM
curl -X POST http://localhost:8000/api/copilot/validate-llm \
  -H "Authorization: Bearer YOUR_TOKEN"
# Expected: {"valid": true, "message": "OpenAI API key is valid", ...}

# Test 3: Send message
curl -X POST http://localhost:8000/api/copilot/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "message": "Tell me about recognition",
    "context": {"page": "feed"}
  }'
# Expected: {"response": "...", "model": "gpt-4", "tokens": {...}, ...}
```

**Result:** ✅ Copilot is live!

---

## Phase 2: Monitor & Gather Data (Days 1-7)

### Daily Checks (5 minutes)
```bash
# 1. Check error logs
tail -n 50 logs/sparknode.log | grep -i error

# 2. Check LLM calls
tail -n 50 logs/sparknode.log | grep "LLM response"

# 3. Check fallbacks
tail -n 50 logs/sparknode.log | grep "keyword matching"

# 4. Check OpenAI dashboard for costs/usage
# https://platform.openai.com/usage/overview
```

### Track These Metrics (Spreadsheet or Slack)
```
Date | Messages | LLM Calls | Fallbacks | Errors | Cost ($) | Notes
-----|----------|-----------|-----------|--------|----------|-------
1/31 |   45     |    38     |     7     |   0    |  0.42    | Working well
2/1  |  120     |   105     |    15     |   1    |  1.21    | Error on "budget" keyword
2/2  |  200     |   185     |    15     |   2    |  2.15    | 
...
```

### Collect User Feedback (Daily)
- Which pages are using copilot most?
- What questions are users asking?
- Are responses helpful?
- Any issues or confusion?

**Methods:**
- Slack channel: #copilot-feedback
- In-app feedback button
- Support ticket analysis
- User interviews (pick 3-5 power users)

---

## Phase 3: Quick Iterations (Days 3-7)

### Day 3: First Iteration (Cost Optimization)
```bash
# Decision point: Is GPT-4 too expensive?

# Option A: Keep GPT-4 (if costs < $10/day)
# → Monitor for 2 weeks more

# Option B: Switch to GPT-3.5-turbo (if costs > $10/day)
# Edit backend/copilot/llm_service.py
# Change: model="gpt-4" → model="gpt-3.5-turbo"
# Deploy update
```

### Day 5: Second Iteration (System Prompts)
Based on collected feedback, improve system prompts:

```bash
# Edit backend/copilot/llm_service.py
# In build_system_prompt() method:

# Current:
if page == 'feed':
    return "The user is viewing recognition events..."

# Improved (based on feedback):
if page == 'feed':
    return """You are SparkNode's AI assistant helping users understand 
recognition events and team achievements. Be specific about the details 
visible to the user. Focus on insights they can act on..."""
```

### Day 7: Third Iteration (Fallback Analysis)
```bash
# Check: How often is fallback being used?
grep -c "keyword matching" logs/sparknode.log

# If > 10%: 
#   → Debug why LLM is failing
#   → Check API key validity
#   → Review error logs

# If < 5%:
#   → LLM is working great!
#   → Ready to optimize other areas
```

---

## 📊 Iteration Cycle Template

```
┌─────────────────────────────┐
│  Monitor (Daily)             │
│  • Collect metrics           │
│  • Gather user feedback      │
│  • Check error logs          │
└──────────────┬──────────────┘
               │ (Every 2-3 days)
               ↓
┌─────────────────────────────┐
│  Analyze (30 min)            │
│  • Review data patterns      │
│  • Identify top issues       │
│  • Prioritize changes        │
└──────────────┬──────────────┘
               │
               ↓
┌─────────────────────────────┐
│  Iterate (30 min-2 hours)    │
│  • Update system prompts     │
│  • Fix bugs                  │
│  • Optimize costs            │
│  • Deploy updates            │
└──────────────┬──────────────┘
               │
               ↓
        (Repeat Daily)
```

---

## 🎯 Key Metrics to Track

### Performance
| Metric | Target | Action if Below |
|--------|--------|-----------------|
| LLM Success Rate | >90% | Debug API calls |
| Response Time | <5s | Check OpenAI latency |
| Helpful Responses | >80% | Refine prompts |

### Cost
| Metric | Target | Action if Above |
|--------|--------|-----------------|
| Daily Cost | <$15 | Switch to GPT-3.5 |
| Cost per Request | <$0.02 | Implement caching |
| Monthly Projection | <$400 | Review usage patterns |

### Usage
| Metric | Track | Insight |
|--------|-------|---------|
| Messages/Day | Trend up | Adoption rate |
| Pages Using | Which | Feature usage |
| Top Questions | List | User needs |
| Fallback Rate | % | API reliability |

---

## 🔴 If Something Goes Wrong

### LLM Returning Errors
```bash
# 1. Check API key
echo $OPENAI_API_KEY

# 2. Validate key
curl -X POST http://localhost:8000/api/copilot/validate-llm \
  -H "Authorization: Bearer TOKEN"

# 3. Check OpenAI status
# https://status.openai.com

# 4. Temporary fix: Disable LLM
# In backend/copilot/routes.py, set:
# llm_service = None
# System will use keyword matching automatically
```

### High Costs
```bash
# 1. Check usage
# https://platform.openai.com/usage/overview

# 2. Identify traffic spike
tail -n 1000 logs/sparknode.log | grep "LLM response"

# 3. Options:
#    a) Switch to GPT-3.5-turbo (10x cheaper)
#    b) Implement rate limiting (10 req/hour per user)
#    c) Add response caching
```

### User Feedback: Responses Not Helpful
```bash
# 1. Improve system prompt
# Edit backend/copilot/llm_service.py
# Make more specific to your domain

# 2. Add page context
# Ensure context includes relevant fields

# 3. Test locally
cd backend
pytest tests/test_copilot.py -v

# 4. Deploy update
git add -A
git commit -m "Improve copilot system prompts based on user feedback"
git push origin feature/v0.4
```

---

## 📋 Daily Standup Template (2 min)

```
🚀 What happened yesterday:
- X messages processed
- Y% LLM success rate
- $Z cost

📊 Key metrics:
- Adoption: 📈 (trending up/stable/down)
- Cost: $X/day (on track/over/under budget)
- Quality: 🟢 (good)/🟡 (needs work)/🔴 (broken)

🎯 Today's priority:
1. [Top iteration]
2. [Monitor metric]
3. [Collect feedback]

⚠️ Blockers:
- [Any issues]

✅ Next actions:
- [Next iteration item]
```

---

## 🎓 Learn More

- **Costs getting high?** → [COPILOT_LLM_SETUP.md](COPILOT_LLM_SETUP.md) → "Cost Management"
- **Troubleshooting issues?** → [COPILOT_LLM_SETUP.md](COPILOT_LLM_SETUP.md) → "Troubleshooting"
- **Improving prompts?** → [COPILOT_LLM_SETUP.md](COPILOT_LLM_SETUP.md) → "Advanced Configuration"
- **Full context?** → [COPILOT_LLM_QUICK_REFERENCE.md](COPILOT_LLM_QUICK_REFERENCE.md)

---

## ✅ Success Criteria for This Phase

After 1 week:
- [ ] Copilot deployed and live
- [ ] Zero critical errors
- [ ] User feedback collected
- [ ] 1-2 iterations completed
- [ ] System prompts improved
- [ ] Cost baseline established
- [ ] Monitoring in place

**Then:** Decide on next phase (persistence, analytics, advanced features)

---

**Ready? Let's go! 🚀**

Start with: `git add -A && git commit -m "..." && git push`
