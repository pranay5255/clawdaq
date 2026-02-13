#!/bin/bash
# ClawDAQ End-to-End Testing Steps
# Run after redeploying contracts and updating .env

set -e  # Exit on error

echo "🚀 ClawDAQ End-to-End Testing Setup"
echo "======================================"
echo ""

# Step 1: Verify Configuration
echo "📋 Step 1: Verify Configuration"
echo "--------------------------------"

cd /home/pranay5255/Documents/clawdaq/api
source .env

if [ -z "$REGISTRY_ADDRESS" ]; then
    echo "❌ ERROR: REGISTRY_ADDRESS not set in api/.env"
    exit 1
fi

if [ -z "$CUSTODIAL_PRIVATE_KEY" ]; then
    echo "❌ ERROR: CUSTODIAL_PRIVATE_KEY not set in api/.env"
    exit 1
fi

echo "✅ REGISTRY_ADDRESS: $REGISTRY_ADDRESS"
echo "✅ ERC8004_REGISTRY_ADDRESS: $ERC8004_REGISTRY_ADDRESS"
echo ""

# Step 2: Verify Custodial Wallet
echo "📋 Step 2: Verify Custodial Wallet Matches Registry Owner"
echo "----------------------------------------------------------"

CUSTODIAL_WALLET=$(node -e "const {ethers} = require('ethers'); const w = new ethers.Wallet('$CUSTODIAL_PRIVATE_KEY'); console.log(w.address);")
echo "Custodial Wallet: $CUSTODIAL_WALLET"

REGISTRY_OWNER=$(cast call $REGISTRY_ADDRESS "owner()" --rpc-url https://sepolia.base.org)
REGISTRY_OWNER_ADDR="0x${REGISTRY_OWNER:26}"
echo "Registry Owner:   $REGISTRY_OWNER_ADDR"

if [ "${CUSTODIAL_WALLET,,}" = "${REGISTRY_OWNER_ADDR,,}" ]; then
    echo "✅ Wallet matches registry owner"
else
    echo "❌ ERROR: Custodial wallet does not match registry owner!"
    exit 1
fi
echo ""

# Step 3: Check Balances
echo "📋 Step 3: Check Custodial Wallet Balances"
echo "-------------------------------------------"

ETH_BALANCE=$(cast balance $CUSTODIAL_WALLET --rpc-url https://sepolia.base.org --ether)
echo "ETH Balance: $ETH_BALANCE ETH"

USDC_BALANCE=$(cast call 0x036CbD53842c5426634e7929541eC2318f3dCF7e "balanceOf(address)(uint256)" $CUSTODIAL_WALLET --rpc-url https://sepolia.base.org)
USDC_FORMATTED=$(node -e "console.log((BigInt('$USDC_BALANCE') / BigInt(1000000)).toString())")
echo "USDC Balance: $USDC_FORMATTED USDC"

if (( $(echo "$ETH_BALANCE < 0.01" | bc -l) )); then
    echo "⚠️  WARNING: Low ETH balance (need ~0.05 for testing)"
fi

REG_FEE=$(cast call $REGISTRY_ADDRESS "REGISTRATION_FEE()" --rpc-url https://sepolia.base.org)
REG_FEE_FORMATTED=$(node -e "console.log((BigInt('$REG_FEE') / BigInt(1000000)).toString())")
echo "Registration Fee: $REG_FEE_FORMATTED USDC"
echo ""

# Step 4: Check and Set USDC Allowance
echo "📋 Step 4: Check/Set USDC Allowance"
echo "------------------------------------"

ALLOWANCE=$(cast call 0x036CbD53842c5426634e7929541eC2318f3dCF7e "allowance(address,address)(uint256)" $CUSTODIAL_WALLET $REGISTRY_ADDRESS --rpc-url https://sepolia.base.org)
ALLOWANCE_FORMATTED=$(node -e "console.log((BigInt('$ALLOWANCE') / BigInt(1000000)).toString())")
echo "Current Allowance: $ALLOWANCE_FORMATTED USDC"

if [ "$ALLOWANCE" = "0" ]; then
    echo "⚠️  No allowance set. Setting allowance to 100 USDC..."

    cd /home/pranay5255/Documents/clawdaq/foundry
    source .env

    cast send 0x036CbD53842c5426634e7929541eC2318f3dCF7e \
        "approve(address,uint256)" \
        $REGISTRY_ADDRESS \
        100000000 \
        --rpc-url base_sepolia \
        --private-key $DEPLOYER_PRIVATE_KEY

    echo "✅ Allowance set to 100 USDC"
else
    echo "✅ Allowance already set"
fi
echo ""

# Step 5: Restart API Server
echo "📋 Step 5: Restart API Server"
echo "------------------------------"

cd /home/pranay5255/Documents/clawdaq/api

# Kill existing server
pkill -f "node --watch src/index.js" 2>/dev/null || true
sleep 2

# Start server in background
npm run dev > /tmp/clawdaq-api-full.log 2>&1 &
echo $! > /tmp/clawdaq-api.pid
echo "API Server PID: $(cat /tmp/clawdaq-api.pid)"

# Wait for server to start
echo "Waiting for API to start..."
sleep 5

# Check health
HEALTH=$(curl -s http://localhost:3000/api/v1/health)
if echo "$HEALTH" | grep -q "healthy"; then
    echo "✅ API server is healthy"
else
    echo "❌ API server not responding correctly"
    echo "Response: $HEALTH"
    exit 1
fi
echo ""

# Step 6: Run Debug Registration Test
echo "📋 Step 6: Test Registration (Debug Script)"
echo "--------------------------------------------"

node debug-registration.js
echo ""

# Step 7: Run Quick Registration Test
echo "📋 Step 7: Quick Registration Test"
echo "-----------------------------------"

TIMESTAMP=$(date +%s)
TEST_NAME="e2etest${TIMESTAMP}"

echo "Testing registration with agent name: $TEST_NAME"

RESULT=$(curl -s -X POST http://localhost:3000/api/v1/agents/register-with-payment \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"$TEST_NAME\",\"description\":\"E2E test agent\",\"payerEoa\":\"$CUSTODIAL_WALLET\"}")

echo "$RESULT" | jq '.'

if echo "$RESULT" | jq -e '.activationCode' > /dev/null; then
    echo "✅ Registration successful!"
    ACTIVATION_CODE=$(echo "$RESULT" | jq -r '.activationCode')
    AGENT_ID=$(echo "$RESULT" | jq -r '.erc8004.agentId // .agentId')
    echo ""
    echo "Activation Code: $ACTIVATION_CODE"
    echo "Agent ID: $AGENT_ID"

    # Save for full test
    echo "$ACTIVATION_CODE" > /tmp/test_activation_code.txt
    echo "$TEST_NAME" > /tmp/test_agent_name.txt
else
    echo "❌ Registration failed!"
    echo "Check logs: tail -50 /tmp/clawdaq-api-full.log"
    exit 1
fi
echo ""

# Step 8: Run Full Lifecycle Tests
echo "📋 Step 8: Run Full Lifecycle Tests"
echo "------------------------------------"

echo "Running comprehensive test suite..."
echo ""

node test-agent-lifecycle.js

echo ""
echo "======================================"
echo "🎉 All E2E Tests Complete!"
echo "======================================"
echo ""
echo "Summary:"
echo "  ✅ Configuration verified"
echo "  ✅ Wallet and balances checked"
echo "  ✅ USDC allowance set"
echo "  ✅ API server running"
echo "  ✅ Registration working"
echo "  ✅ Full lifecycle tests passed"
echo ""
echo "API Server Logs: tail -f /tmp/clawdaq-api-full.log"
echo "API Server PID: $(cat /tmp/clawdaq-api.pid)"
echo ""
