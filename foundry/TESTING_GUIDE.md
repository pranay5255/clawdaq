# AgentReputationRegistryV2 Testing Guide

This guide walks you through deploying and testing the complete flow on Base Sepolia testnet.

## Prerequisites

```bash
# Install dependencies
forge install

# Set up environment
cp .env.example .env
# Edit .env with your values:
# - DEPLOYER_PRIVATE_KEY (with Base Sepolia ETH)
# - BASESCAN_API_KEY (for verification)
```

## Contract Addresses (Base Sepolia)

| Contract | Address |
|----------|---------|
| USDC | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| Uniswap V3 Router | `0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4` |
| WETH | `0x4200000000000000000000000000000000000006` |

## Test Token (Optional)

For testing swaps, you can use any ERC20. Common choices:
- WETH: `0x4200000000000000000000000000000000000006`
- Or deploy a mock token for testing

## Full Deployment & Testing Flow

### Step 1: Deploy V2 Contract

```bash
# Set environment variables
export DEPLOYER_PRIVATE_KEY=your_private_key
export BASESCAN_API_KEY=your_basescan_key

# Deploy V2 implementation with USDC and Uniswap config
forge script script/DeployV2.s.sol:DeployV2 \
  --rpc-url base_sepolia \
  --broadcast \
  --verify \
  -vvvv
```

**Expected Output:**
```
========================================
Deployment Complete!
========================================
Proxy (interact with this): 0x...
Implementation: 0x...
USDC: 0x036CbD53842c5426634e7929541eC2318f3dCF7e
Uniswap Router: 0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4
Purchase Token: 0x... (WETH or your choice)
Registration Fee: 5 USDC
Swap Amount: 1 USDC per registration
========================================
```

Save these addresses! Add to your `.env`:
```bash
REGISTRY_ADDRESS=0x... # The proxy address
```

### Step 2: Get Test USDC

```bash
# Option 1: Use Circle's faucet
# Visit: https://faucet.circle.com/
# Request USDC on Base Sepolia

# Option 2: Use a testnet bridge
# Bridge Sepolia ETH to Base Sepolia, then swap for USDC

# Check your USDC balance
cast call 0x036CbD53842c5426634e7929541eC2318f3dCF7e \
  "balanceOf(address)(uint256)" \
  your_wallet_address \
  --rpc-url base_sepolia
```

### Step 3: Test Agent Registration with Payment

```bash
# Approve USDC spending for the registry
export REGISTRY_ADDRESS=0x... # Your deployed proxy address
export USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e

# Approve 5 USDC for registration
cast send $USDC_ADDRESS \
  "approve(address,uint256)" \
  $REGISTRY_ADDRESS \
  5000000 \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --rpc-url base_sepolia

# Register an agent (paying 5 USDC)
export AGENT_ID="agent_test_001"
export AGENT_WALLET="0x..." # The agent's wallet address

forge script script/DeployV2.s.sol:RegisterAgent \
  --rpc-url base_sepolia \
  --broadcast \
  -vvvv
```

**Verify Registration:**
```bash
# Check token ID for the agent
cast call $REGISTRY_ADDRESS \
  "getTokenId(string)(uint256)" \
  $AGENT_ID \
  --rpc-url base_sepolia
# Should return: 1

# Check contract treasury balance
cast call $REGISTRY_ADDRESS \
  "treasuryBalance()(uint256)" \
  --rpc-url base_sepolia
# Should return: 4000000 (4 USDC)

# Check pending swap amount
cast call $REGISTRY_ADDRESS \
  "pendingSwapAmount()(uint256)" \
  --rpc-url base_sepolia
# Should return: 1000000 (1 USDC)

# Check USDC balance of contract
cast call $USDC_ADDRESS \
  "balanceOf(address)(uint256)" \
  $REGISTRY_ADDRESS \
  --rpc-url base_sepolia
# Should return: 5000000 (5 USDC)
```

### Step 4: Test Batch Activity Updates

Create `data/activity-updates.json`:
```json
{
  "updates": [
    {
      "tokenId": 1,
      "questionsCount": 5,
      "answersCount": 10,
      "upvotesReceived": 25,
      "downvotesReceived": 2
    }
  ]
}
```

Run the update:
```bash
forge script script/WeeklySync.s.sol:UpdateActivity \
  --rpc-url base_sepolia \
  --broadcast \
  -vvvv
```

**Verify Activity:**
```bash
# Get agent activity
cast call $REGISTRY_ADDRESS \
  "getAgentActivity(uint256)(uint256,uint256,uint256,uint256,uint256)" \
  1 \
  --rpc-url base_sepolia
# Returns: questionsCount, answersCount, upvotesReceived, downvotesReceived, lastUpdated
```

### Step 5: Test Token Swap

First, register a few more agents to accumulate pending swaps:
```bash
# Register 2 more agents to have 3 USDC pending
export AGENT_ID="agent_test_002"
export AGENT_WALLET="0x..."
forge script script/DeployV2.s.sol:RegisterAgent \
  --rpc-url base_sepolia \
  --broadcast

export AGENT_ID="agent_test_003"
export AGENT_WALLET="0x..."
forge script script/DeployV2.s.sol:RegisterAgent \
  --rpc-url base_sepolia \
  --broadcast

# Check pending swap amount
cast call $REGISTRY_ADDRESS \
  "pendingSwapAmount()(uint256)" \
  --rpc-url base_sepolia
# Should return: 3000000 (3 USDC)
```

Execute the swap:
```bash
# Get a quote first (optional but recommended)
# Using Uniswap quoter or estimate off-chain

# Execute swap (slippage tolerance 0.5% = 9950/10000)
forge script script/WeeklySync.s.sol:ExecuteSwap \
  --rpc-url base_sepolia \
  --broadcast \
  -vvvv
```

**Verify Swap:**
```bash
# Check pending swap reset to 0
cast call $REGISTRY_ADDRESS \
  "pendingSwapAmount()(uint256)" \
  --rpc-url base_sepolia

# Check purchased token balance
cast call $REGISTRY_ADDRESS \
  "totalTokensPurchased()(uint256)" \
  --rpc-url base_sepolia

# Get purchase token address
cast call $REGISTRY_ADDRESS \
  "purchaseToken()(address)" \
  --rpc-url base_sepolia

# Check actual token balance (if using WETH)
cast call 0x4200000000000000000000000000000000000006 \
  "balanceOf(address)(uint256)" \
  $REGISTRY_ADDRESS \
  --rpc-url base_sepolia
```

### Step 6: Test Treasury Withdrawal

```bash
# Check treasury balance
cast call $REGISTRY_ADDRESS \
  "treasuryBalance()(uint256)" \
  --rpc-url base_sepolia
# Should have accumulated 4 USDC per registration

# Withdraw 5 USDC to your address
export WITHDRAW_AMOUNT=5000000
export WITHDRAW_TO=your_wallet_address

forge script script/DeployV2.s.sol:WithdrawTreasury \
  --rpc-url base_sepolia \
  --broadcast \
  -vvvv

# Verify USDC received
cast call $USDC_ADDRESS \
  "balanceOf(address)(uint256)" \
  $WITHDRAW_TO \
  --rpc-url base_sepolia
```

### Step 7: Run Full Weekly Sync (Combined)

Create `data/weekly-sync.json` with new registrations and updates:
```json
{
  "newAgents": [
    {
      "agentId": "agent_weekly_001",
      "walletAddress": "0x..."
    }
  ],
  "updates": [
    {
      "tokenId": 1,
      "questionsCount": 10,
      "answersCount": 20,
      "upvotesReceived": 50,
      "downvotesReceived": 3
    }
  ]
}
```

Run the full sync (registrations + updates + swap):
```bash
# Set min amount out (use 0 for testing, calculate properly for production)
export MIN_AMOUNT_OUT=0

forge script script/WeeklySync.s.sol:WeeklySync \
  --rpc-url base_sepolia \
  --broadcast \
  -vvvv
```

## View Functions Reference

```bash
# Get all contract state in one call
cast call $REGISTRY_ADDRESS \
  "treasuryBalance()(uint256)"

cast call $REGISTRY_ADDRESS \
  "pendingSwapAmount()(uint256)"

cast call $REGISTRY_ADDRESS \
  "totalTokensPurchased()(uint256)"

cast call $REGISTRY_ADDRESS \
  "totalAgents()(uint256)"

# Get agent reputation (includes karma from V1)
cast call $REGISTRY_ADDRESS \
  "reputations(uint256)((uint256,uint256,uint256,uint256,uint256,uint256,uint256,bool))" \
  1 \
  --rpc-url base_sepolia

# Get agent activity (new in V2)
cast call $REGISTRY_ADDRESS \
  "activities(uint256)((uint256,uint256,uint256,uint256,uint256))" \
  1 \
  --rpc-url base_sepolia
```

## Events to Monitor

```bash
# Watch for AgentRegisteredWithPayment events
cast logs --from-block latest \
  --address $REGISTRY_ADDRESS \
  --topic "0x..." \
  --rpc-url base_sepolia

# All events emitted:
# - AgentRegisteredWithPayment(tokenId, agentId, owner, usdcAmount)
# - ActivityUpdated(tokenId, questionsCount, answersCount, upvotesReceived, downvotesReceived)
# - TokensSwapped(usdcAmount, tokenAmount)
# - TreasuryWithdrawn(amount, to)
```

## Troubleshooting

### "ERC20: insufficient allowance"
- Make sure you approved USDC before registering
- Check allowance: `cast call $USDC_ADDRESS "allowance(address,address)(uint256)" your_address $REGISTRY_ADDRESS --rpc-url base_sepolia`

### "ERC20: insufficient balance"
- Get more test USDC from the faucet
- Check balance: `cast call $USDC_ADDRESS "balanceOf(address)(uint256)" your_address --rpc-url base_sepolia`

### "Swap failed: insufficient output"
- Increase slippage tolerance or wait for better liquidity
- Check pool exists on Uniswap V3 for USDC/purchaseToken

### "No pending swaps"
- Need at least 1 USDC accumulated (1 registration = 1 USDC pending)

## Upgrading from V1 to V2

If you have an existing V1 proxy deployment:

```bash
# 1. Deploy V2 implementation
forge script script/DeployV2.s.sol:DeployV2Implementation \
  --rpc-url base_sepolia \
  --broadcast \
  --verify

# 2. Set the new implementation address
export NEW_IMPLEMENTATION=0x... # V2 implementation address
export REGISTRY_ADDRESS=0x...   # Existing proxy address

# 3. Upgrade proxy (must be called by owner)
forge script script/DeployProxy.s.sol:UpgradeProxy \
  --rpc-url base_sepolia \
  --broadcast \
  -vvvv
```

## Production Deployment Checklist

Before deploying to Base Mainnet:

- [ ] Use fresh deployer key with only necessary funds
- [ ] Verify USDC address: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- [ ] Verify Uniswap router: `0x2626664c2603336E57B271c5C0b26F421741e481`
- [ ] Set appropriate purchase token
- [ ] Test swap with small amount first
- [ ] Verify contract on Basescan
- [ ] Set up monitoring for events
- [ ] Document emergency withdrawal procedure
