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

# Run tests (should show 31 passing tests)
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

### 5. Save Deployment Address

The script will output:
```
Add to .env:
REGISTRY_ADDRESS=0x...
USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
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

### Base Mainnet

- **Chain ID**: 8453
- **RPC URL**: https://mainnet.base.org
- **Block Explorer**: https://basescan.org
- **USDC Address**: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

## Contract Details

### Constructor Parameters

- `usdcAddress` - USDC ERC20 token address

### Contract Constants

- `REGISTRATION_FEE` = 5,000,000 (5 USDC with 6 decimals)
- `MAX_BATCH_SIZE` = 200 agents per batch operation

### Key Functions

**Registration (Owner Only)**
- `registerAgent(uint256 agentId, address payerEoa, string agentUri)`
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

## Testing After Deployment

See [TESTNET_GUIDE.md](./TESTNET_GUIDE.md) for comprehensive testing instructions.

### Quick Test

```bash
# Setup environment
export REGISTRY_ADDRESS=0x...
export USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e

# Run test script
forge script script/TestAgent0Custodial.s.sol:TestAgent0CustodialScript \
  --rpc-url base_sepolia \
  --broadcast \
  -vvvv
```

## Manual Verification (if automatic fails)

```bash
forge verify-contract \
  $REGISTRY_ADDRESS \
  src/Agent0CustodialRegistry.sol:Agent0CustodialRegistry \
  --chain-id 84532 \
  --constructor-args $(cast abi-encode "constructor(address)" 0x036CbD53842c5426634e7929541eC2318f3dCF7e) \
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
3. 📝 Test all functions (see TESTNET_GUIDE.md)
4. 📝 Integrate with API
5. 📝 Monitor operations
6. 📝 Prepare for mainnet (after thorough testing)

## Support

- Foundry Book: https://book.getfoundry.sh/
- Base Docs: https://docs.base.org/
- Basescan: https://sepolia.basescan.org/
