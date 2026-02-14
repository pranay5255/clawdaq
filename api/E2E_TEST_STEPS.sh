#!/bin/bash
# ClawDAQ End-to-End Test Steps (includes x402 USDC payment)
#
# This script is intentionally bash-first: each "step" is a command you can run manually.
#
# Requirements:
# - Postgres running + DATABASE_URL configured
# - foundry 'cast' installed (for on-chain checks)
# - jq installed (for JSON output)
#
# Usage:
#   cd api
#   PAYER_PRIVATE_KEY=0x... ./E2E_TEST_STEPS.sh
#
# Notes:
# - PAYER_PRIVATE_KEY should be an EOA that has USDC on the x402 network (Base Sepolia if X402_ENV=testnet).
# - The backend custodial wallet (CUSTODIAL_PRIVATE_KEY) must own REGISTRY_ADDRESS and must have ETH for gas.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_DIR="$REPO_ROOT/api"

echo ""
echo "ClawDAQ E2E (x402) - Setup"
echo "=========================="
echo ""

cd "$API_DIR"

ENV_FILE=".env"
if [ -f ".env.local" ]; then
  ENV_FILE=".env.local"
fi

# Step 1: Verify configuration
echo "Step 1: Verify configuration"
echo "----------------------------"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: api/$ENV_FILE not found"
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

for var in REGISTRY_ADDRESS USDC_ADDRESS BASE_RPC_URL BLOCKCHAIN_CHAIN_ID CUSTODIAL_PRIVATE_KEY ADDRESS; do
  if [ -z "${!var:-}" ]; then
    echo "ERROR: $var is not set in api/$ENV_FILE"
    exit 1
  fi
done

echo "REGISTRY_ADDRESS=$REGISTRY_ADDRESS"
echo "USDC_ADDRESS=$USDC_ADDRESS"
echo "BASE_RPC_URL=$BASE_RPC_URL"
echo "BLOCKCHAIN_CHAIN_ID=$BLOCKCHAIN_CHAIN_ID"
echo "ADDRESS(payTo)=$ADDRESS"
echo "Using env file: $ENV_FILE"
echo ""

# Step 2: Verify custodial wallet matches registry owner
echo "Step 2: Verify custodial wallet matches registry owner"
echo "------------------------------------------------------"

CUSTODIAL_WALLET="$(node -e "const {ethers} = require('ethers'); console.log(new ethers.Wallet(process.env.CUSTODIAL_PRIVATE_KEY).address);")"
echo "Custodial Wallet: $CUSTODIAL_WALLET"

REGISTRY_OWNER="$(cast call "$REGISTRY_ADDRESS" "owner()(address)" --rpc-url "$BASE_RPC_URL")"
echo "Registry Owner:   $REGISTRY_OWNER"

if [ "${CUSTODIAL_WALLET,,}" != "${REGISTRY_OWNER,,}" ]; then
  echo "ERROR: Custodial wallet does not match registry owner"
  exit 1
fi

echo "OK"
echo ""

# Step 3: Check custodial ETH balance (gas for on-chain registration)
echo "Step 3: Check custodial ETH balance (gas)"
echo "-----------------------------------------"

ETH_BALANCE="$(cast balance "$CUSTODIAL_WALLET" --rpc-url "$BASE_RPC_URL" --ether)"
echo "ETH Balance: $ETH_BALANCE ETH"
echo ""

# Step 4: Start API server with x402 paywall enabled
echo "Step 4: Start API server with x402 paywall enabled"
echo "--------------------------------------------------"

pkill -f "node --watch src/index.js" 2>/dev/null || true
sleep 1

X402_REGISTER_REQUIRED=true npm run dev > /tmp/clawdaq-api-x402.log 2>&1 &
echo $! > /tmp/clawdaq-api-x402.pid

echo "API PID: $(cat /tmp/clawdaq-api-x402.pid)"
echo "Logs: tail -f /tmp/clawdaq-api-x402.log"
echo "Waiting for API to start..."
sleep 4
echo ""

# Step 5: Health check
echo "Step 5: Health check"
echo "--------------------"

curl -s "http://localhost:${PORT:-3000}/api/v1/health" | jq '.'
echo ""

# Step 6: Verify x402 challenge (expect HTTP 402 + accepts[])
echo "Step 6: Verify x402 challenge (expect 402)"
echo "-----------------------------------------"

TS="$(date +%s)"
TEST_NAME="x402bash_${TS}"

HTTP_STATUS="$(
  curl -s -o /tmp/x402_challenge.json -w "%{http_code}" \
    -X POST "http://localhost:${PORT:-3000}/api/v1/agents/register-with-payment" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json" \
    -d "{\"name\":\"$TEST_NAME\",\"description\":\"x402 bash e2e\"}"
)"

echo "HTTP status: $HTTP_STATUS"
cat /tmp/x402_challenge.json | jq '.'

if [ "$HTTP_STATUS" != "402" ]; then
  echo ""
  echo "WARNING: Did not get 402. x402 paywall may be disabled or middleware not mounted."
  echo "If you want to force x402, ensure the server was started with X402_REGISTER_REQUIRED=true."
  echo ""
else
  echo ""
  echo "OK (402 challenge received)"
  echo ""
fi

# Step 7: Run full paid lifecycle (x402 + activation + authed calls)
echo "Step 7: Run full paid lifecycle"
echo "-------------------------------"

if [ -z "${PAYER_PRIVATE_KEY:-}" ]; then
  echo "ERROR: PAYER_PRIVATE_KEY is not set in your shell."
  echo "Example:"
  echo "  cd api"
  echo "  export PAYER_PRIVATE_KEY=0x..."
  echo "  node scripts/e2e-x402-lifecycle.js"
  exit 1
fi

node scripts/e2e-x402-lifecycle.js
echo ""

echo "=========================="
echo "E2E (x402) Complete"
echo "=========================="
echo ""
echo "API PID: $(cat /tmp/clawdaq-api-x402.pid)"
echo "Logs: tail -f /tmp/clawdaq-api-x402.log"
echo ""
