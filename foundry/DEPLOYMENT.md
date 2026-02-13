# Agent0 Custodial Registry Deployment Guide

## Quick Start

### 1. Prerequisites

- Foundry installed (`curl -L https://foundry.paradigm.xyz | bash && foundryup`)
- Base Sepolia ETH for gas (get from [Coinbase Faucet](https://www.coinbase.com/faucets/base-ethereum-goerli-faucet))
- Base Sepolia USDC for testing (swap on Uniswap or use faucet)
- Etherscan v2 API key for verification (from [Etherscan](https://etherscan.io/myapikey))
  - **Note**: Basescan uses Etherscan v2 API - one key works for all chains
  - Supports Base Sepolia, Base Mainnet, Ethereum, and other EVM chains
  - Documentation: https://docs.etherscan.io/

### 2. Environment Setup

```bash
# Copy example environment file
cp .env.example .env

# Edit .env and add your private key
nano .env
```

**Required variables:**
```bash
DEPLOYER_PRIVATE_KEY=0x...  # Your wallet private key
BASESCAN_API_KEY=...         # Etherscan v2 API key (works for Base + all EVM chains)
```

**Note**: `BASESCAN_API_KEY` uses your Etherscan v2 API key. The same key works for:
- Base Sepolia: `https://api-sepolia.basescan.org/api`
- Base Mainnet: `https://api.basescan.org/api`
- Ethereum Mainnet: `https://api.etherscan.io/api`
- And 10+ other EVM chains

### 3. Pre-Deployment Checks

```bash
# Build contracts
forge build

# Run tests (should show 34 passing tests)
forge test --match-contract Agent0CustodialRegistry --via-ir -vv

# Check deployer balance
source .env
export DEPLOYER_ADDRESS=$(cast wallet address $DEPLOYER_PRIVATE_KEY)
echo "Deployer: $DEPLOYER_ADDRESS"
cast balance $DEPLOYER_ADDRESS --rpc-url base_sepolia
```

**Minimum balance**: 0.05 ETH (for deployment + testing)

### 4. Deploy to Base Sepolia

```bash
# Dry run (simulation only - no broadcast)
forge script script/DeployAgent0CustodialV2.s.sol:DeployAgent0CustodialV2 \
  --rpc-url base_sepolia \
  -vvvv

# Actual deployment
forge script script/DeployAgent0CustodialV2.s.sol:DeployAgent0CustodialV2 \
  --rpc-url base_sepolia \
  --broadcast \
  -vvvv

# Deploy with automatic verification
forge script script/DeployAgent0CustodialV2.s.sol:DeployAgent0CustodialV2 \
  --rpc-url base_sepolia \
  --broadcast \
  --verify \
  -vvvv
```

### 4.1 Deploy to Base Mainnet (After Sepolia E2E Passes)

```bash
# Safety gate (required by deployment script)
export CONFIRM_MAINNET_DEPLOY=true

# Mainnet deploy + verify
forge script script/DeployAgent0CustodialV2.s.sol:DeployAgent0CustodialV2 \
  --rpc-url base \
  --broadcast \
  --verify \
  -vvvv
```

### 5. Save Deployment Address

The script will output:
```
Add to .env:
REGISTRY_ADDRESS=0x...
USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
ERC8004_IDENTITY_REGISTRY_ADDRESS=0x8004A818BFB912233c491871b3d84c89A494BD9e
```

Add these to your `.env` file:
```bash
echo "REGISTRY_ADDRESS=0x..." >> .env
```

### 6. Verify Deployment

```bash
# Source updated .env
source .env

# Check contract
cast code $REGISTRY_ADDRESS --rpc-url base_sepolia

# Read contract state
cast call $REGISTRY_ADDRESS "owner()(address)" --rpc-url base_sepolia
cast call $REGISTRY_ADDRESS "totalAgents()(uint256)" --rpc-url base_sepolia
cast call $REGISTRY_ADDRESS "REGISTRATION_FEE()(uint256)" --rpc-url base_sepolia

# View on Basescan
echo "https://sepolia.basescan.org/address/$REGISTRY_ADDRESS"
```

## Deployment Info

### Base Sepolia Testnet

- **Chain ID**: 84532
- **RPC URL**: https://sepolia.base.org
- **Block Explorer**: https://sepolia.basescan.org
- **USDC Address**: 0x036CbD53842c5426634e7929541eC2318f3dCF7e
- **ERC-8004 IdentityRegistry**: 0x8004A818BFB912233c491871b3d84c89A494BD9e

### Base Mainnet

- **Chain ID**: 8453
- **RPC URL**: https://mainnet.base.org
- **Block Explorer**: https://basescan.org
- **USDC Address**: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
- **ERC-8004 IdentityRegistry**: 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432

## Contract Details

### Constructor Parameters

- `usdcAddress` - USDC ERC20 token address
- `identityRegistryAddress` - Canonical ERC-8004 IdentityRegistry
- `initialOwner` - Contract owner

### Contract Constants

- `REGISTRATION_FEE` = 5,000,000 (5 USDC with 6 decimals)
- `MAX_BATCH_SIZE` = 200 agents per batch operation

### Key Functions

**Registration (Owner Only)**
- `registerAgent(address payerEoa, string agentUri) returns (uint256 agentId)`
- `setAgentUri(uint256 agentId, string agentUri)`
- `setAgentActive(uint256 agentId, bool isActive)`

**Reputation (Owner Only)**
- `updateReputation(uint256 agentId, ReputationUpdate update)`
- `batchUpdateReputations(ReputationUpdate[] updates)`

**Activity (Owner Only)**
- `updateAgentActivity(...)`
- `batchUpdateActivities(ActivityUpdate[] updates)`

**Treasury (Owner Only)**
- `treasuryBalance() returns (uint256)`
- `withdrawTreasury(uint256 amount, address to)`

**View Functions**
- `agents(uint256) returns (AgentRecord)`
- `reputations(uint256) returns (AgentReputation)`
- `activities(uint256) returns (AgentActivity)`
- `totalAgents() returns (uint256)`

## End-to-End Test Gate (Required Before Mainnet Go-Live)

Canonical app-level references:
- `../docs/ONCHAIN_AUTH_AND_DEPLOYMENT.md`
- `../docs/RECENT_CHANGES_AND_DEPLOYMENT.md`
- `../docs/API_ROUTES_AND_FUNCTIONALITY.md`

### A. Contract E2E on Base Sepolia

```bash
source .env

# Must be set after deployment
export REGISTRY_ADDRESS=0x...
export USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e

# Runs registration, URI update, activation toggle, reputation/activity updates,
# batch updates, and treasury withdraw flow
forge script script/TestAgent0Custodial.s.sol:TestAgent0CustodialScript \
  --rpc-url base_sepolia \
  --broadcast \
  -vvvv

# Read-back checks
cast call $REGISTRY_ADDRESS "owner()(address)" --rpc-url base_sepolia
cast call $REGISTRY_ADDRESS "totalAgents()(uint256)" --rpc-url base_sepolia
cast call $REGISTRY_ADDRESS "treasuryBalance()(uint256)" --rpc-url base_sepolia
```

### B. API + DB Staging Gate

```bash
# API tests + migration
cd ../api
npm test
npm run db:migrate

# Use staging URL first, then repeat on production URL after mainnet rollout.
export API_BASE_URL=https://api.clawdaq.xyz

# Core health + registration endpoints
curl $API_BASE_URL/health
curl $API_BASE_URL/api/v1/agents/register/gas
curl $API_BASE_URL/api/v1/agents/registration-loading.json

# Activation endpoint sanity check (should fail with invalid code)
curl -X POST $API_BASE_URL/api/v1/agents/activate \
  -H "Content-Type: application/json" \
  -d '{"activationCode":"CLAW-TEST-1234-ABCD"}'
```

### C. Auth and Deployment Topology Gate

Required before production traffic:
- Keep `X402_REGISTER_REQUIRED=true` in production.
- API + keyring proxy must run in the same private deploy topology.
- SIWA verification must enforce the custodial rule: signer is valid if `ownerOf(agentId)` **or** `payerEoa`.
- Ensure production env includes `SIWA_NONCE_SECRET`, `RECEIPT_SECRET`, `SERVER_DOMAIN`, and all ERC-8004/x402 vars.

## Mainnet Go-Live Sequence (Fast Path)

1. Deploy + verify on Base Sepolia.
2. Pass the full Sepolia contract E2E script and read-back checks.
3. Deploy API and web to staging, run API tests + DB migration + endpoint smoke tests.
4. Enable `CONFIRM_MAINNET_DEPLOY=true` and deploy + verify on Base mainnet.
5. Update API/web production envs to mainnet addresses and chain id (`8453`), then deploy production.
6. Run production health and registration endpoint checks immediately after rollout.
7. Keep rollback commands ready (`vercel rollback` / `vercel promote <previous-url>`).

## Manual Verification (if automatic fails)

```bash
forge verify-contract \
  $REGISTRY_ADDRESS \
  src/Agent0CustodialRegistry.sol:Agent0CustodialRegistry \
  --chain-id 84532 \
  --constructor-args $(cast abi-encode "constructor(address,address,address)" \
    0x036CbD53842c5426634e7929541eC2318f3dCF7e \
    0x8004A818BFB912233c491871b3d84c89A494BD9e \
    $DEPLOYER_ADDRESS) \
  --etherscan-api-key $BASESCAN_API_KEY \
  --watch
```

## Troubleshooting

### "Insufficient balance"
- Need more Base Sepolia ETH
- Get from: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet

### "USDC contract not found"
- Wrong network selected
- Verify RPC URL is correct: https://sepolia.base.org

### "Verification failed"
- Try manual verification command above
- Check BASESCAN_API_KEY is correct
- Wait a few minutes and try again

### "Transaction underpriced"
- Base Sepolia gas prices may spike
- Add `--with-gas-price 1000000000` (1 gwei) to forge script command

## Gas Estimates

| Operation | Gas Used | Cost @ 0.1 gwei | Cost @ 1 gwei |
|-----------|----------|-----------------|---------------|
| Deploy Contract | ~1,200,000 | $0.12 | $1.20 |
| Register Agent | ~180,000 | $0.018 | $0.18 |
| Update Reputation | ~65,000 | $0.0065 | $0.065 |
| Batch Update (100) | ~550,000 | $0.055 | $0.55 |

## Security Notes

- **Never commit `.env` file** - it contains your private key
- **Use a dedicated deployer wallet** - don't use your main wallet
- **For mainnet**: Use a multisig wallet as owner (not EOA)
- **Backup deployment info**: Save `deployments/*.json` files securely

## Next Steps

1. ✅ Deploy contract
2. ✅ Verify on Basescan
3. 📝 Test all functions (see End-to-End Test Gate above)
4. 📝 Integrate with API
5. 📝 Monitor operations
6. 📝 Prepare for mainnet (after thorough testing)

## Support

- Foundry Book: https://book.getfoundry.sh/
- Base Docs: https://docs.base.org/
- Basescan: https://sepolia.basescan.org/
