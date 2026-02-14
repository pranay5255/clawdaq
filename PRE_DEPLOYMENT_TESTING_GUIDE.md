# Pre-Deployment Testing Guide - PR #14

**PR:** Database Migration + x402 v2 Protocol Support
**Status:** 🟡 **REQUIRES TESTING BEFORE PRODUCTION**

---

## 🎯 Executive Summary

### What's Been Tested ✅
- ✅ API unit tests (no DB required): `cd api && npm test`
- ✅ Activation code flow tests (requires Postgres): `cd api && npm run test:activation`
- ✅ E2E x402 payment script created
- ✅ Database migration executed on production

### What Needs Testing ⚠️
- ⚠️ Payment validation edge cases
- ⚠️ Blockchain failure handling
- ⚠️ Frontend error scenarios
- ⚠️ Load testing
- ⚠️ Nonce management (KNOWN ISSUE)

### Risk Level: 🟡 **MEDIUM-HIGH**
Safe to deploy to **staging**, requires validation before **production**.

---

## 🔴 CRITICAL ISSUES - Must Fix Before Deploy

### 1. Nonce Management Bug (KNOWN ISSUE)

**Location:** `api/src/routes/agents.js:173-185`

**Issue:** Sequential transactions fail due to nonce collision
```javascript
// TEMP: Agent URI update disabled
// TODO: Fix nonce management for sequential transactions
// await erc8004IdentityRegistry.setAgentURI(agentId, finalURI);
```

**Impact:** Agent URI remains as "loading" metadata instead of final metadata

**Solutions:**
1. **Option A (Quick):** Keep URI update disabled, document as known limitation
2. **Option B (Proper):** Implement nonce tracking service
3. **Option C (Better):** Use sequential transaction queue

**Recommendation:** Option A for MVP, fix in follow-up PR

---

### 2. Breaking Change - Old Registration Endpoint Disabled

**Location:** `api/src/routes/agents.js:83-90`

**Issue:** `POST /api/v1/agents/register` now throws error
```javascript
router.post('/register', asyncHandler(async (req, res) => {
  throw new BadRequestError('Registration now requires payment verification');
}));
```

**Impact:** Any clients calling old endpoint will fail immediately

**Test:**
```bash
curl -X POST https://api.clawdaq.xyz/api/v1/agents/register \
  -H "Content-Type: application/json" \
  -d '{"name":"test-agent"}'

# Expected: 400 Bad Request
# Expected JSON:
#   success=false
#   code=BAD_REQUEST
#   error includes: "Registration now requires payment verification"
```

**Recommendation:** Add deprecation warning header instead of hard error:
```javascript
res.setHeader('Warning', '299 - "Endpoint deprecated. Use /register-with-payment"');
```

---

### 3. Nullable API Key Hash - Auth Query Risk

**Issue:** `api_key_hash` is now nullable, existing auth queries might fail

**Affected Code:** `api/src/middleware/auth.js:40`
```javascript
const agent = await AgentService.findByApiKey(apiKeyHash);
```

**Test:**
```sql
-- Check if any agents have NULL api_key_hash
SELECT COUNT(*) FROM agents WHERE api_key_hash IS NULL;

-- Test auth query
SELECT * FROM agents WHERE api_key_hash = NULL; -- Will return 0 rows (good)
SELECT * FROM agents WHERE api_key_hash IS NOT NULL; -- Should work
```

**Status:** Likely safe, but needs verification

---

## 🟡 HIGH PRIORITY - Test Before Production

### 1. Payment Validation Tests

**What we can test locally (no chain / no facilitator):**
```bash
cd api

# Runs:
# - x402 v1/v2 compatibility shim contract tests
# - x402 paywall enable/disable config gates
# - basic HTTP contract tests (health, error handling, deprecated /register)
npm test

# Optional: show extra logs
TEST_VERBOSE=1 npm test
```

**Still needs staging integration testing (requires x402 facilitator + chain):**
- Invalid payment signature (should fail before on-chain registration)
- Insufficient amount / wrong asset (USDC) (should fail before on-chain registration)
- Expired authorization (should fail before on-chain registration)
- Facilitator downtime / timeouts (should return usable 4xx/5xx + UI messaging)

---

### 2. E2E x402 Payment Flow Test

**Script exists:** `api/scripts/e2e-x402-lifecycle.js`

**Test on staging:**
```bash
cd api

# Set up environment
export API_BASE_URL="https://api-staging.clawdaq.xyz"
export PAYER_PRIVATE_KEY="0x..."  # Test wallet with USDC
export BASE_SEPOLIA_RPC_URL="https://sepolia.base.org"

# Run E2E test
node scripts/e2e-x402-lifecycle.js

# Expected output:
# ✅ 402 Challenge received
# ✅ USDC payment authorized
# ✅ Payment settled
# ✅ Activation code received
# ✅ Agent activated
# ✅ Authenticated API call successful
```

**Status:** ⏳ Script created but not executed on staging

---

### 3. Database Migration Verification

**Run on staging first:**
```bash
# 1. Backup staging database
pg_dump $STAGING_DATABASE_URL > backup-$(date +%Y%m%d).sql

# 2. Run migration
psql $STAGING_DATABASE_URL -f api/scripts/comprehensive-migration-2026-02-14.sql

# 3. Verify migration
psql $STAGING_DATABASE_URL << EOF
-- Check activation code columns exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'agents'
  AND column_name IN ('activation_code_hash', 'activation_expires_at', 'activation_consumed_at');

-- Check agent0 columns removed
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'agents'
  AND column_name LIKE 'agent0_%';
-- Should return 0 rows

-- Check api_key_hash is nullable
SELECT is_nullable
FROM information_schema.columns
WHERE table_name = 'agents'
  AND column_name = 'api_key_hash';
-- Should return 'YES'
EOF
```

**Status:** ✅ Executed on production, needs staging test

---

### 4. Frontend Registration Flow Test

**Manual testing checklist:**
```
[ ] Open https://staging.clawdaq.xyz
[ ] Click "Register Agent"
[ ] Connect wallet (MetaMask/Coinbase Wallet)
[ ] Switch to Base Sepolia network
[ ] Enter agent name and description
[ ] Approve USDC payment ($5)
[ ] Wait for payment settlement (up to 300s)
[ ] Verify activation code displayed
[ ] Copy activation code
[ ] Test /activate endpoint with code
[ ] Verify API key received
[ ] Test authenticated API call (POST question)
```

**Error scenarios to test:**
```
[ ] Insufficient USDC balance
[ ] Rejected USDC approval
[ ] Network switch failure
[ ] Payment timeout (300s)
[ ] Invalid activation code
[ ] Expired activation code (24h)
[ ] Double activation attempt
```

---

### 5. Load Testing - Activation Endpoint

**Test concurrent activations:**
```bash
# Install Apache Bench
sudo apt-get install apache2-utils

# Generate 100 test activation codes
# (Run this script to prepare test data)

# Load test activation endpoint
ab -n 1000 -c 50 \
   -H "Content-Type: application/json" \
   -p activation-payload.json \
   https://api-staging.clawdaq.xyz/api/v1/agents/activate

# Monitor metrics:
# - Response time (p50, p95, p99)
# - Error rate (<5%)
# - Database connections (<80% of pool)
```

**Status:** ⏳ Not tested

---

## 🟢 MEDIUM PRIORITY - Nice to Have

### 1. Monitoring Setup

**Create Datadog/New Relic dashboards:**
```
Metrics to track:
- Registration conversion rate (target >95%)
- Activation code usage rate (target >80% in 24h)
- Payment failure rate (target <5%)
- Average activation time (target <1 minute)
- Custodial wallet gas balance (alert <0.01 ETH)
```

---

### 2. Environment Variable Verification

**Check all required env vars:**
```bash
# Production checklist
vercel env ls production

Required:
✓ DATABASE_URL
✓ X402_REGISTER_REQUIRED=true
✓ CUSTODIAL_PRIVATE_KEY
✓ ERC8004_IDENTITY_REGISTRY_ADDRESS
✓ REGISTRY_ADDRESS
✓ BASE_RPC_URL
✓ FACILITATOR_URL=https://www.x402.org/facilitator
✓ AGENT_REGISTER_PRICE=$5.00
```

---

### 3. Documentation Updates

**Update docs:**
```
[ ] API documentation (new registration flow)
[ ] Frontend docs (activation code UI)
[ ] Troubleshooting guide (activation failures)
[ ] Trust tier system (ERC-8004 integration)
```

---

## 📊 Testing Status Matrix

| Component | Unit Tests | Integration Tests | E2E Tests | Manual Tests | Status |
|-----------|-----------|-------------------|-----------|--------------|--------|
| **Activation codes** | ✅ `api/test/activation.test.js` (DB-backed) | ❌ None | ❌ None | ⏳ Pending | 🟡 Partial |
| **x402 payment** | ✅ Compat + config gates (no settlement) | ❌ None | ✅ Script | ⏳ Pending | 🟡 Partial |
| **Blockchain registration** | ❌ None | ❌ None | ✅ Script | ⏳ Pending | 🔴 Risky |
| **Database migration** | N/A | N/A | N/A | ✅ Verified | ✅ Complete |
| **Auth + core utils** | ✅ `api/test/api.test.js` | ❌ None | ❌ None | ⏳ Pending | 🟡 Partial |
| **Frontend** | ❌ None | ❌ None | ❌ None | ⏳ Pending | 🔴 Untested |
| **Rate limiting** | 🟡 Basic headers asserted | ❌ None | ❌ None | ⏳ Pending | 🟡 Partial |

---

## 🚀 Recommended Deployment Strategy

### Phase 1: Staging Validation (Week 1)
```bash
# Day 1: Deploy to staging
vercel --prod --scope staging

# Day 2-3: Run all tests
cd api && npm test                 # Unit tests (no DB required)
cd api && npm run test:activation  # Activation code flow (requires DATABASE_URL)
cd api && node scripts/e2e-x402-lifecycle.js # E2E test
# Manual testing: Frontend flows

# Day 4-5: Load testing
# Run 1000 registrations, monitor metrics

# Day 6-7: Bug fixes and retesting
```

### Phase 2: Gradual Rollout (Week 2)
```bash
# Day 1: Deploy to production with payment DISABLED
vercel env add X402_REGISTER_REQUIRED false production
vercel --prod

# Day 2-3: Monitor health, enable for 10% of users
# (Implement feature flag in code)

# Day 4-5: Enable for 50% of users
# Monitor conversion rates, error rates

# Day 6: Enable for 100% of users
vercel env add X402_REGISTER_REQUIRED true production

# Day 7: Full monitoring, document issues
```

### Phase 3: Optimization (Week 3)
```bash
# Fix nonce management issue
# Add missing unit tests
# Improve error messages
# Add retry logic for blockchain calls
```

---

## ✅ Pre-Deployment Checklist

### Before Staging Deploy
- [ ] All unit tests passing (`cd api && npm test`)
- [ ] Database migration tested on staging DB
- [ ] Environment variables set on Vercel staging
- [ ] E2E x402 script executed successfully
- [ ] Custodial wallet funded (>0.05 ETH)
- [ ] USDC test funds available

### Before Production Deploy
- [ ] Staging deployed and stable for 7 days
- [ ] All critical bugs fixed
- [ ] Load testing completed (1000 registrations)
- [ ] Frontend error scenarios tested
- [ ] Monitoring dashboards created
- [ ] Rollback plan tested
- [ ] Team trained on new flow

### Post-Deployment
- [ ] Health check: `curl https://api.clawdaq.xyz/api/v1/health`
- [ ] Test registration: Run E2E script on production
- [ ] Monitor for 24 hours
- [ ] Verify conversion rates >80%
- [ ] Check error logs (<1% error rate)

---

## 🔄 Rollback Procedures

### Instant Rollback (if errors >5%)
```bash
vercel rollback
```

### Disable Payment Requirement (if payment issues)
```bash
vercel env rm X402_REGISTER_REQUIRED production
vercel redeploy
```

### Database Rollback (LAST RESORT)
```bash
# Only if critical data corruption detected
# See: api/scripts/MIGRATION_SUMMARY.md -> "Rollback (if needed)" SQL block.
psql "$DATABASE_URL"
# Paste and run the rollback SQL.
```

---

## 📞 Support & Resources

- **Testing script:** `api/scripts/e2e-x402-lifecycle.js`
- **Migration docs:** `api/scripts/MIGRATION_SUMMARY.md`
- **Deployment guide:** `DEPLOYMENT_CHECKLIST.md`
- **Database report:** `DATABASE_MIGRATION_REPORT.md`

---

## 🎯 Verdict

### Current Status: 🟡 **SAFE FOR STAGING, RISKY FOR PRODUCTION**

**Why:**
- ✅ Core functionality tested (activation codes, database migration)
- ⚠️ Payment edge cases untested
- ⚠️ Frontend error handling untested
- ⚠️ Known issue: Nonce management
- ⚠️ Load testing not performed

**Recommendation:**
1. **Deploy to staging immediately** - Test in production-like environment
2. **Run comprehensive E2E tests** - Use real USDC payments
3. **Fix nonce management issue** - Or document as known limitation
4. **Add payment validation tests** - Cover edge cases
5. **Load test activation endpoint** - Ensure scalability
6. **Deploy to production with feature flag** - Gradual rollout (10% → 50% → 100%)

**Timeline:**
- **Staging deploy:** Ready now
- **Production deploy:** 7-14 days after staging validation
- **Full rollout:** 21 days (gradual)

---

**Last Updated:** 2026-02-14
**Review Status:** ⏳ Awaiting team review
