/**
 * Generate a static gas balance message for agent registration wallet.
 *
 * Usage:
 *   REGISTER_WALLET_ADDRESS=0x... BASE_RPC_URL=https://mainnet.base.org node scripts/generate-register-gas-message.js
 *
 * Defaults:
 *   - REGISTER_WALLET_ADDRESS falls back to ADDRESS
 *   - BASE_RPC_URL is derived from X402_ENV (mainnet -> https://mainnet.base.org, else https://sepolia.base.org)
 */

const fs = require('fs');
const path = require('path');

function requireEnv(name, value) {
  if (!value) {
    console.error(`Missing required ${name} env var`);
    process.exit(1);
  }
}

function formatEther(wei, decimals = 6) {
  const base = 10n ** 18n;
  const whole = wei / base;
  const fraction = wei % base;
  if (decimals === 0) {
    return whole.toString();
  }
  const fractionStr = fraction.toString().padStart(18, '0').slice(0, decimals);
  const trimmed = fractionStr.replace(/0+$/, '');
  return trimmed.length > 0 ? `${whole}.${trimmed}` : whole.toString();
}

async function main() {
  const address = process.env.REGISTER_WALLET_ADDRESS || process.env.ADDRESS;
  requireEnv('REGISTER_WALLET_ADDRESS (or ADDRESS)', address);

  const isMainnet = (process.env.X402_ENV || '').toLowerCase() === 'mainnet';
  const network = isMainnet ? 'base' : 'base-sepolia';
  const rpcUrl = process.env.BASE_RPC_URL || (isMainnet ? 'https://mainnet.base.org' : 'https://sepolia.base.org');
  requireEnv('BASE_RPC_URL', rpcUrl);

  const payload = {
    jsonrpc: '2.0',
    id: 1,
    method: 'eth_getBalance',
    params: [address, 'latest']
  };

  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    console.error(`RPC request failed (${response.status}): ${await response.text()}`);
    process.exit(1);
  }

  const data = await response.json();
  if (!data || !data.result) {
    console.error('Invalid RPC response:', data);
    process.exit(1);
  }

  const balanceWei = BigInt(data.result);
  const balanceEth = formatEther(balanceWei, 6);

  const message = `Gas left: ${balanceEth} ETH on ${network}. Need ETH at: ${address}.`;

  const output = {
    generatedAt: new Date().toISOString(),
    network,
    address,
    balanceWei: balanceWei.toString(),
    balanceEth,
    message
  };

  const outputDir = path.join(__dirname, '..', 'src', 'generated');
  const outputPath = path.join(outputDir, 'register-gas.json');
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

  console.log(`Wrote ${outputPath}`);
}

main().catch((error) => {
  console.error('Failed to generate gas message:', error);
  process.exit(1);
});
