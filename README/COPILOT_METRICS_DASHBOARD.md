# Copilot v0.5 Deployment Metrics Dashboard

## Daily Tracking (Update Daily at 5pm)

### Week 1: January 31 - February 6, 2026

```
DATE | MESSAGES | LLM CALLS | SUCCESS% | FALLBACK% | ERRORS | COST ($) | AVG RESPONSE (s) | NOTES
-----|----------|-----------|----------|-----------|--------|----------|------------------|--------
1/31 |    -     |     -     |    -     |     -     |   -    |    -     |       -          | Deployment day
2/1  |          |           |          |           |        |          |                  |
2/2  |          |           |          |           |        |          |                  |
2/3  |          |           |          |           |        |          |                  |
2/4  |          |           |          |           |        |          |                  |
2/5  |          |           |          |           |        |          |                  |
2/6  |          |           |          |           |        |          |                  |
-----|----------|-----------|----------|-----------|--------|----------|------------------|--------
WEEK | TOTAL    | TOTAL     | AVG      | AVG       | TOTAL  | TOTAL    | AVG              | 
```

### How to Get Daily Numbers

**Messages & LLM Calls:**
```bash
# Count POST requests to /chat
grep "POST /api/copilot/chat" logs/sparknode.log | wc -l

# Count successful LLM responses
grep "LLM response generated" logs/sparknode.log | wc -l

# Count fallbacks
grep "keyword matching" logs/sparknode.log | wc -l
```

**Cost:**
- Check OpenAI dashboard: https://platform.openai.com/usage/overview
- Copy total cost for the day

**Response Time:**
```bash
# Average LLM response time
grep "LLM response" logs/sparknode.log | \
  grep -oP 'time: \K[0-9.]+' | \
  awk '{sum+=$1; count++} END {print sum/count}'
```

---

## Key Insights to Capture

### Daily (5 min review)
- [ ] Any new errors? → Document and prioritize
- [ ] Cost on track? → Yes/No
- [ ] LLM success rate > 90%? → Yes/No
- [ ] User complaints? → Document feedback

### Every 2-3 Days (20 min review)
- [ ] Which pages use copilot most?
- [ ] What are top 5 user questions?
- [ ] Which system prompts need improvement?
- [ ] Any patterns in failures?

### Weekly (1 hour review)
- [ ] Trending metrics (up/stable/down)
- [ ] Cost vs budget
- [ ] Feature adoption
- [ ] Top improvement opportunity
- [ ] What to iterate on next?

---

## Iteration Decisions

### Decision 1: Cost Optimization (By Day 3)
**Question:** Is the cost acceptable?

| Daily Cost | Decision | Action |
|-----------|----------|--------|
| < $5 | ✅ Keep GPT-4 | Continue monitoring |
| $5-15 | ⚠️ Monitor | Decide by day 7 |
| > $15 | ❌ Switch | Use GPT-3.5-turbo |

**How to switch to GPT-3.5-turbo:**
```bash
# Edit backend/copilot/llm_service.py
# Line 23: Change model="gpt-4" to model="gpt-3.5-turbo"
# Save and deploy
```

### Decision 2: Quality Improvement (By Day 5)
**Question:** Are users finding responses helpful?

| Feedback | Issue | Solution |
|----------|-------|----------|
| "Too generic" | Prompts not specific | Refine system prompts |
| "Wrong context" | Missing page context | Add page-specific details |
| "Doesn't answer" | LLM hallucinating | Improve prompt clarity |
| "Slow" | Response latency | Check OpenAI status |

**How to improve prompts:**
```bash
# Edit backend/copilot/llm_service.py
# In build_system_prompt() method
# Make instructions more specific to your domain
# Deploy update
```

### Decision 3: Scaling (By Day 7)
**Question:** Is adoption growing? Do we need to scale?

| Metric | Action |
|--------|--------|
| Messages/day < 100 | Monitor |
| Messages/day 100-500 | Scale up if needed |
| Messages/day > 500 | Implement caching/batching |

---

## User Feedback Log

### Top Questions Asked
```
Page: feed
1. "What is this recognition about?" - Freq: 8 - Response: Good
2. "Who gave this award?" - Freq: 5 - Response: Good
3. "How do I give recognition?" - Freq: 3 - Response: Needs work

Page: dashboard
1. "What do these numbers mean?" - Freq: 6 - Response: Good
2. "How is this calculated?" - Freq: 4 - Response: Confusing

Page: wallet
1. "How do I redeem points?" - Freq: 7 - Response: Good
2. "Can I transfer points?" - Freq: 2 - Response: Wrong

...
```

### User Sentiment
```
✅ Positive: "This is so helpful!"
⚠️ Neutral: "It's okay"
❌ Negative: "Not what I asked"

Track these weekly to assess quality
```

---

## Action Items by Week

### Week 1 (Days 1-7)
- [ ] Deploy to production
- [ ] Verify all endpoints working
- [ ] Set billing alerts
- [ ] Collect baseline metrics
- [ ] Get initial user feedback
- [ ] Make 1-2 quick improvements

### Week 2 (Days 8-14)
- [ ] Analyze trend data
- [ ] Decide on cost optimization
- [ ] Refine system prompts based on feedback
- [ ] Implement top requested improvement
- [ ] Document lessons learned

### Week 3-4 (Days 15-28)
- [ ] Measure impact of improvements
- [ ] Plan next phase (persistence, analytics, advanced features)
- [ ] Present data to stakeholders
- [ ] Prioritize roadmap

---

## Quick Reference

### Emergency: High Costs
```bash
# Disable LLM temporarily (use keyword matching)
# Edit backend/copilot/routes.py
# Comment out: llm_service = LLMService()
# Redeploy
# This stops costs immediately while you investigate
```

### Emergency: Broken LLM
```bash
# Check API key
echo $OPENAI_API_KEY

# Validate endpoint
curl -X POST http://localhost:8000/api/copilot/validate-llm

# Check logs
tail -f logs/sparknode.log | grep -i error

# If needed, disable: set llm_service = None in routes.py
```

### Quick Win: Improve Response Time
```bash
# If responses slow, check:
1. OpenAI status page
2. API rate limits
3. Network latency
4. Consider GPT-3.5-turbo (slightly faster)
```

---

## Success Looks Like...

✅ **End of Week 1:**
- Copilot live and stable
- Zero critical errors
- User feedback collected
- Cost baseline established
- First iteration complete

✅ **End of Week 2:**
- System prompts improved
- Cost decision made (GPT-4 or GPT-3.5)
- 2-3 optimizations deployed
- Adoption metrics positive
- Roadmap for next phase ready

---

## Share Results

### Daily Slack Update (Template)
```
🚀 Copilot Daily Update - [DATE]

📊 Metrics:
• Messages: X
• LLM Success: X%
• Cost: $X (Budget: $Y)
• Fallback Rate: X%

🎯 Highlights:
• [Good thing that happened]
• [User feedback received]

⚠️ Issues:
• [If any]

📝 Next:
• [Iteration planned]
```

### Weekly Report (Template)
```
Copilot v0.5 - Week 1 Results

📈 Growth:
• Daily messages: 0 → X (trending 📈/📉/→)
• User adoption: X% of org
• Feedback score: X/10

💰 Cost:
• Total spend: $X
• Per-request: $X
• Projected/month: $X

✅ Wins:
• [Improvement 1]
• [User feedback positive]

🔄 Iterations:
• [Change 1] → Result: [Impact]
• [Change 2] → Result: [Impact]

🎯 Next Phase:
• [Planned improvement]
• [Planned feature]
```

---

**Update this dashboard daily for 2 weeks, then weekly. Share with team in standup!**
