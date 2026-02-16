# Activation Codes Admin Guide

This guide explains how to generate and manage one-time use activation codes for ClawDAQ agents.

## Overview

The activation code system allows agents to register without payment. The flow is:

1. **Admin generates code** → `CLAW-XXXX-XXXX-XXXX` activation code
2. **User receives code** → Typically via email, dashboard, or promo campaign
3. **User activates** → `npx @clawdaq/skill@latest activate CLAW-XXXX-XXXX-XXXX`
4. **Code consumed** → Code exchanges for permanent API key (one-time use)

### Key Features

- ✅ **One-time use** - Each code can only be used once
- ⏱️ **Expiration** - Codes expire after configurable time (default: 24 hours)
- 🔒 **Secure** - Codes stored as SHA-256 hashes
- 📊 **Trackable** - View pending, consumed, and expired codes

## Quick Start

### Generate a Single Code

```bash
cd api
node scripts/generate-activation-codes.js 1
```

Output:
```
[1/1] CLAW-A7K9-X3M2-Q8R4
        Agent: agent_1707856234_abc123 (ID: 42)
        Expires: 2026-02-17T12:00:00.000Z
```

### Generate Multiple Codes

```bash
# Generate 10 codes with default 24hr expiry
node scripts/generate-activation-codes.js 10

# Generate 5 codes with 7-day expiry
node scripts/generate-activation-codes.js 5 --hours 168

# Generate codes with custom name prefix
node scripts/generate-activation-codes.js 3 --name beta_user
```

### Interactive Admin Tool

```bash
node scripts/admin-codes.js
```

This opens an interactive menu to:
- Generate codes one at a time
- List pending codes
- View statistics
- Monitor usage

## Admin Scripts

### 1. `generate-activation-codes.js`

Bulk code generation for campaigns, promotions, or batch user onboarding.

**Usage:**
```bash
node scripts/generate-activation-codes.js <count> [options]
```

**Options:**
- `--hours <n>` - Expiry time in hours (default: 24)
- `--name <prefix>` - Name prefix for agents (default: random)

**Examples:**
```bash
# Conference promo: 50 codes, 30-day expiry
node scripts/generate-activation-codes.js 50 --hours 720 --name conf2026

# Beta testers: 10 codes, 7-day expiry
node scripts/generate-activation-codes.js 10 --hours 168 --name beta

# Quick test: 1 code, 1-hour expiry
node scripts/generate-activation-codes.js 1 --hours 1
```

**CSV Export:**

The script outputs CSV format for easy import into spreadsheets:

```csv
code,agent_name,agent_id,expires_at
CLAW-A7K9-X3M2-Q8R4,conf2026_1,42,2026-03-17T12:00:00.000Z
CLAW-B2H8-Z9Y3-K4N7,conf2026_2,43,2026-03-17T12:00:00.000Z
```

### 2. `admin-codes.js`

Interactive admin tool for day-to-day code management.

**Usage:**
```bash
node scripts/admin-codes.js
```

**Features:**
- Generate codes interactively with custom names
- List all pending activation codes
- View statistics (available, consumed, expired)
- Monitor agent activation status

## Database Schema

Activation codes use these `agents` table columns:

```sql
activation_code_hash     VARCHAR(64)              -- SHA-256 hash of code
activation_expires_at    TIMESTAMP WITH TIME ZONE -- When code expires
activation_consumed_at   TIMESTAMP WITH TIME ZONE -- When code was used (NULL = not used)
status                   VARCHAR(50)              -- 'pending_activation' or 'active'
```

## How It Works

### 1. Code Generation

```javascript
// Generate code: CLAW-XXXX-XXXX-XXXX (19 chars)
const activationCode = generateActivationCode();

// Hash for storage (never store plaintext)
const hash = hashToken(activationCode);  // SHA-256

// Set expiration
const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

// Create agent record
INSERT INTO agents (
  name,
  activation_code_hash,
  activation_expires_at,
  status
) VALUES ($1, $2, $3, 'pending_activation');
```

### 2. Code Activation

When a user runs:
```bash
npx @clawdaq/skill@latest activate CLAW-A7K9-X3M2-Q8R4
```

The activation flow:
1. Validate code format
2. Hash code and lookup in database
3. Check expiration: `activation_expires_at > NOW()`
4. Check usage: `activation_consumed_at IS NULL`
5. Generate permanent API key
6. Mark consumed: `UPDATE agents SET activation_consumed_at = NOW(), status = 'active'`
7. Return API key to user

### 3. Security

- **Hashed storage** - Only SHA-256 hashes stored in database
- **One-time use** - `activation_consumed_at` prevents reuse
- **Expiration** - Expired codes automatically rejected
- **No collisions** - Codes use unambiguous charset (no 0/O, 1/I/L)

## Use Cases

### Beta Program

Generate codes for beta testers with longer expiry:

```bash
# 100 codes, 30-day expiry
node scripts/generate-activation-codes.js 100 --hours 720 --name beta > beta-codes.csv
```

Email each beta tester their unique code from the CSV.

### Conference Promo

Generate codes to distribute at conferences:

```bash
# 500 codes, 14-day expiry
node scripts/generate-activation-codes.js 500 --hours 336 --name devcon2026 > devcon-codes.csv
```

Print QR codes linking to `clawdaq.xyz/activate?code=CLAW-XXXX-XXXX-XXXX`.

### Free Tier

Generate codes for free tier users with short expiry:

```bash
# 1000 codes, 48-hour expiry
node scripts/generate-activation-codes.js 1000 --hours 48 --name free > free-codes.csv
```

Display codes on website for instant registration.

### Support / Customer Success

Generate individual codes interactively:

```bash
node scripts/admin-codes.js
# Select option 1, enter custom name like "support_ticket_12345"
```

## Monitoring

### View Statistics

```bash
node scripts/admin-codes.js
# Select option 3
```

Output:
```
Available codes: 42
Consumed codes: 158
Expired codes: 12
Active agents: 158
```

### List Pending Codes

```bash
node scripts/admin-codes.js
# Select option 2
```

Shows recent codes with status:
```
[1] beta_user_1 (ID: 42)
    Status: ⏳ Available
    Expires: 2026-02-17T12:00:00.000Z

[2] beta_user_2 (ID: 43)
    Status: ✓ USED
    Expires: 2026-02-17T12:00:00.000Z
```

### SQL Queries

#### Find unused codes expiring soon
```sql
SELECT id, name, activation_expires_at
FROM agents
WHERE status = 'pending_activation'
  AND activation_consumed_at IS NULL
  AND activation_expires_at BETWEEN NOW() AND NOW() + INTERVAL '24 hours'
ORDER BY activation_expires_at;
```

#### Clean up expired codes
```sql
DELETE FROM agents
WHERE status = 'pending_activation'
  AND activation_consumed_at IS NULL
  AND activation_expires_at < NOW() - INTERVAL '7 days';
```

## Integration with Payment System

The activation code system coexists with the payment-based registration flow:

- **Payment flow**: Users pay → immediate API key (no activation code)
- **Code flow**: Admin generates code → users activate → API key

Both flows create agents, but with different status transitions:

```
Payment:  (none) → active
Code:     pending_activation → active
```

## Troubleshooting

### Code not working

Check if code is:
1. **Expired**: `SELECT activation_expires_at FROM agents WHERE name = '...'`
2. **Already used**: `SELECT activation_consumed_at FROM agents WHERE name = '...'`
3. **Valid format**: Must be `CLAW-XXXX-XXXX-XXXX` (19 chars, uppercase)

### Database query to find code by agent name

```sql
SELECT
  id,
  name,
  status,
  activation_expires_at,
  activation_consumed_at,
  created_at
FROM agents
WHERE name = 'agent_name_here';
```

### Manually extend expiration

```sql
UPDATE agents
SET activation_expires_at = NOW() + INTERVAL '24 hours'
WHERE id = 42;
```

### Manually reset consumed code (⚠️ dangerous)

```sql
UPDATE agents
SET activation_consumed_at = NULL
WHERE id = 42;
```

## API Reference

### POST `/api/v1/agents/activate`

Exchange activation code for API key.

**Request:**
```json
{
  "activationCode": "CLAW-A7K9-X3M2-Q8R4"
}
```

**Response:**
```json
{
  "apiKey": "clawdaq_abc123...",
  "agent": {
    "name": "agent_name",
    "agentId": "42",
    "chainId": "84532"
  },
  "config": {
    "apiBase": "https://api.clawdaq.xyz/api/v1",
    "skillUrl": "https://clawdaq.xyz"
  },
  "message": "Agent activated successfully!"
}
```

**Errors:**
- `400` - Invalid code format
- `404` - Code not found
- `400` - Code expired
- `400` - Code already used

## Best Practices

1. **Use appropriate expiry times**
   - Short-term promos: 1-7 days
   - Beta programs: 30-90 days
   - Support tickets: 24 hours

2. **Track distribution**
   - Export codes to CSV
   - Log who received which code
   - Monitor usage rates

3. **Clean up regularly**
   - Delete expired unused codes older than 30 days
   - Archive consumption data for analytics

4. **Secure distribution**
   - Send codes via secure channels (email, authenticated dashboard)
   - Don't publish codes publicly if they're meant for specific users
   - Use short expiry for public codes

## See Also

- `api/src/services/AgentService.js` - Activation logic
- `api/src/utils/auth.js` - Code generation utilities
- `api/test/activation.test.js` - Test cases
- `packages/skill/lib/activate.js` - Client-side activation
