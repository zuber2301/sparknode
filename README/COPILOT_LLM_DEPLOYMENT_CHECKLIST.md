# SparkNode Copilot v0.5: Deployment Checklist

## Pre-Deployment Phase

### Code Review
- [ ] Review `backend/copilot/llm_service.py` for security
- [ ] Review `backend/copilot/routes.py` endpoint authentication
- [ ] Verify all imports are correct
- [ ] Check for any hardcoded API keys or secrets
- [ ] Review error handling and fallback logic
- [ ] Validate test coverage (19 tests total)

### Environment Setup
- [ ] Create `.env` file from `.env.example`
- [ ] Obtain OpenAI API key from https://platform.openai.com/api-keys
- [ ] Set `OPENAI_API_KEY` environment variable
- [ ] Verify `.env` is in `.gitignore`
- [ ] Test with `OPENAI_API_KEY` not set (should fall back gracefully)

### Dependency Management
- [ ] Run `pip install -r requirements.txt`
- [ ] Verify `openai>=1.3.9` is installed
- [ ] Verify `tiktoken>=0.5.1` is installed
- [ ] Test import: `python -c "from openai import OpenAI; print('OK')"`
- [ ] Test tiktoken: `python -c "import tiktoken; print('OK')"`

## Testing Phase

### Unit Tests
```bash
cd backend
pytest tests/test_copilot.py -v
```
- [ ] All tests pass (19 tests)
- [ ] No import errors
- [ ] No deprecation warnings
- [ ] Coverage report reviewed

### Integration Tests
```bash
# Start backend
python main.py &
BACKEND_PID=$!

# Test status endpoint
curl http://localhost:8000/api/copilot/status \
  -H "Authorization: Bearer TEST_TOKEN"
# Expected: { "status": "operational", "llm_available": true/false, ... }

kill $BACKEND_PID
```
- [ ] Status endpoint returns correct format
- [ ] Status shows correct LLM availability
- [ ] No authentication bypasses

### LLM Connectivity Test
```bash
# With valid API key
curl -X POST http://localhost:8000/api/copilot/validate-llm \
  -H "Authorization: Bearer TEST_TOKEN"
# Expected: { "valid": true, "message": "...", "model": "gpt-4" }

# With invalid API key
export OPENAI_API_KEY="invalid"
curl -X POST http://localhost:8000/api/copilot/validate-llm \
  -H "Authorization: Bearer TEST_TOKEN"
# Expected: { "valid": false, ... }
```
- [ ] Validation passes with correct key
- [ ] Validation fails with incorrect key
- [ ] Error messages are helpful
- [ ] No API key exposure in logs

### Chat Endpoint Test
```bash
# Test with LLM available
curl -X POST http://localhost:8000/api/copilot/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TEST_TOKEN" \
  -d '{
    "message": "Tell me about recognition",
    "context": {"page": "feed"}
  }'
# Expected: { "response": "...", "model": "gpt-4", "tokens": {...}, ... }

# Test with LLM unavailable (unset OPENAI_API_KEY)
curl -X POST http://localhost:8000/api/copilot/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TEST_TOKEN" \
  -d '{
    "message": "Hello",
    "context": {"page": "dashboard"}
  }'
# Expected: { "response": "...", "model": "keyword-matching", "tokens": null, ... }
```
- [ ] LLM response works correctly
- [ ] Fallback works when API key missing
- [ ] Fallback works when API call fails
- [ ] Token counting is accurate
- [ ] Response timestamp is valid

### Conversation History Test
```bash
curl -X POST http://localhost:8000/api/copilot/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TEST_TOKEN" \
  -d '{
    "message": "Follow up",
    "conversation_history": [
      {"role": "user", "content": "First question"},
      {"role": "assistant", "content": "First answer"}
    ]
  }'
```
- [ ] Conversation history is accepted
- [ ] Response considers history
- [ ] No errors with empty history
- [ ] No errors with null history

### Error Handling Tests
- [ ] Empty message rejected (400 status)
- [ ] Unauthenticated request rejected (403 status)
- [ ] Invalid JSON rejected (422 status)
- [ ] Server errors logged but don't crash (500 status with message)
- [ ] Rate limit errors handled gracefully
- [ ] Timeout errors handled gracefully

### Frontend Integration Tests
- [ ] RightSideCopilot component displays
- [ ] Messages send to correct endpoint
- [ ] Responses display correctly
- [ ] Loading state shows during request
- [ ] Errors are handled gracefully
- [ ] Context is passed correctly from page

## Pre-Production Phase

### Security Review
- [ ] No hardcoded API keys in code
- [ ] API key validation before use
- [ ] All endpoints require authentication
- [ ] Rate limiting configured (if needed)
- [ ] CORS configured correctly
- [ ] SQL injection protection verified
- [ ] XSS protection verified

### Performance Testing
```bash
# Load test with 10 concurrent requests
ab -n 100 -c 10 http://localhost:8000/api/copilot/chat

# Monitor:
# - Response times (should be <5s for LLM, <100ms for fallback)
# - Memory usage (should not grow unbounded)
# - Token usage (should be reasonable)
```
- [ ] Latency acceptable (<5s)
- [ ] No memory leaks
- [ ] Concurrent requests handled
- [ ] No race conditions

### Cost Estimation
```python
# Calculate projected costs
requests_per_day = 1000
avg_tokens_per_request = 270
days_per_month = 30

gpt4_cost_per_1k_tokens_prompt = 0.03
gpt4_cost_per_1k_tokens_completion = 0.06

# Estimate
monthly_cost = (requests_per_day * days_per_month * 270 / 1000) * 
               ((150 * gpt4_cost_per_1k_tokens_prompt + 
                 120 * gpt4_cost_per_1k_tokens_completion) / 270)
# Expected: ~$351/month for GPT-4, ~$35/month for GPT-3.5-turbo
```
- [ ] Monthly cost projection calculated
- [ ] Budget approved by team
- [ ] Cost monitoring plan in place
- [ ] Billing alerts set to trigger at 80% of budget

### Documentation Review
- [ ] README updated with copilot info
- [ ] COPILOT_LLM_SETUP.md is complete
- [ ] COPILOT_LLM_QUICK_REFERENCE.md is complete
- [ ] API documentation is accurate
- [ ] Troubleshooting guide is comprehensive
- [ ] Team has read and understands docs

### Logging and Monitoring
- [ ] Logging configured for all LLM calls
- [ ] Error logging captures exceptions
- [ ] Cost tracking logged per request
- [ ] Fallback events logged
- [ ] API failures logged
- [ ] Response times logged

## Production Deployment

### Environment Configuration
- [ ] Production `.env` created with real API key
- [ ] Environment variables verified in deployment system
- [ ] No `.env` file committed to repo
- [ ] Secrets managed securely (Docker Secrets / K8s Secrets)
- [ ] Backup API key created and stored securely

### Database (if conversation persistence added)
- [ ] Database migrations reviewed
- [ ] New tables created successfully
- [ ] Indexes created for performance
- [ ] Backup taken before deployment

### Deployment Steps
1. [ ] Code merged to main branch
2. [ ] All tests pass in CI/CD
3. [ ] Docker image built successfully
4. [ ] Environment variables set in production
5. [ ] Application deployed to production
6. [ ] Health check endpoint returns 200
7. [ ] LLM validation endpoint returns valid
8. [ ] Monitor logs for errors (first hour)

### Post-Deployment Verification
```bash
# Production validation
curl https://api.sparknode.com/api/copilot/status \
  -H "Authorization: Bearer PROD_TOKEN"
# Expected: 200 OK with operational status

curl -X POST https://api.sparknode.com/api/copilot/validate-llm \
  -H "Authorization: Bearer PROD_TOKEN"
# Expected: 200 OK with valid API key message

curl -X POST https://api.sparknode.com/api/copilot/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer PROD_TOKEN" \
  -d '{"message":"Test message"}'
# Expected: 200 OK with response
```
- [ ] Status endpoint working
- [ ] LLM validation working
- [ ] Chat endpoint working
- [ ] Logs show successful requests
- [ ] No error messages in production logs

### Monitoring Setup
- [ ] Logs being collected (CloudWatch, ELK, etc.)
- [ ] Alerts configured for:
  - [ ] High error rate (>5%)
  - [ ] High response time (>5s)
  - [ ] API failures
  - [ ] Billing alerts (80% budget)
- [ ] Dashboard created for copilot metrics
- [ ] Performance metrics being tracked

### OpenAI Account Setup
- [ ] API key rotated (old key deleted)
- [ ] Billing payment method verified
- [ ] Billing alerts set
- [ ] Usage dashboard bookmarked
- [ ] Monthly budget set ($XXX)
- [ ] Hard limit set ($XXX + buffer)

## Rollback Plan

### If Issues Occur
1. [ ] Disable LLM feature flag (set `COPILOT_ENABLED=false`)
2. [ ] Fallback to keyword matching (automatic)
3. [ ] Collect error logs
4. [ ] Identify root cause
5. [ ] Fix issue in dev environment
6. [ ] Run full test suite
7. [ ] Deploy fix to production

### Immediate Actions if Critical Issue
1. [ ] Unset `OPENAI_API_KEY` in production
2. [ ] System will use keyword fallback automatically
3. [ ] Users still get helpful responses
4. [ ] No data loss
5. [ ] Time to fix without time pressure

## Post-Deployment Phase (Week 1)

### Daily Monitoring
- [ ] Check copilot error rate (<1% is good)
- [ ] Check response times (should be stable)
- [ ] Check token usage (for cost tracking)
- [ ] Check logs for warnings
- [ ] Verify no security issues

### Weekly Review (First Week)
- [ ] Review OpenAI usage and costs
- [ ] Gather user feedback on copilot
- [ ] Check error logs for patterns
- [ ] Review conversation data (if persisted)
- [ ] Adjust system prompts if needed

### Performance Tuning (First Month)
- [ ] Optimize system prompts based on feedback
- [ ] Consider GPT-3.5-turbo if costs too high
- [ ] Implement conversation caching if needed
- [ ] Add rate limiting if abuse detected
- [ ] Document common issues found

## Long-term Maintenance

### Monthly Tasks
- [ ] Review OpenAI costs vs. budget
- [ ] Analyze copilot usage patterns
- [ ] Review error logs for anomalies
- [ ] Check API health and uptime
- [ ] Update documentation as needed

### Quarterly Tasks
- [ ] Review model performance
- [ ] Evaluate newer models (GPT-4 Turbo, etc.)
- [ ] Analyze user satisfaction metrics
- [ ] Plan feature enhancements
- [ ] Security audit

### Annual Tasks
- [ ] Full security review
- [ ] Load testing for next year
- [ ] ROI analysis of copilot feature
- [ ] Plan for scaling (if needed)
- [ ] Review and update documentation

## Success Criteria

✅ All criteria met = Safe to deploy

- [ ] All 19 tests pass
- [ ] No security vulnerabilities found
- [ ] Error rate <1% in production
- [ ] Response time <5s (LLM), <100ms (fallback)
- [ ] Cost within budget
- [ ] User satisfaction >4/5
- [ ] No data loss or corruption
- [ ] Fallback works when LLM unavailable
- [ ] Logs capture all important events
- [ ] Team trained on troubleshooting

## Sign-off

- [ ] Development Team Lead: __________ Date: __________
- [ ] QA Lead: __________ Date: __________
- [ ] DevOps Lead: __________ Date: __________
- [ ] Product Manager: __________ Date: __________
- [ ] Security Lead: __________ Date: __________

## Notes

Document any issues, workarounds, or special considerations below:

```
[Space for deployment notes]
```

---

**Deployment Completed:** __________  
**Deployment By:** __________  
**Verified By:** __________  
**Issues Reported:** __________  
**Resolution Time:** __________  
