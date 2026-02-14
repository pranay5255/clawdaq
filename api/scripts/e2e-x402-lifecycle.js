#!/usr/bin/env node
/**
 * End-to-end lifecycle test that includes x402 USDC payment:
 * 1) Health check
 * 2) Name availability
 * 3) Register-with-payment (expects 402 challenge), sign x402 header, retry paid registration
 * 4) Activate (exchange activation code for API key)
 * 5) Authenticated API calls (Bearer + X-Agent-Id)
 *
 * Usage:
 *   cd api
 *   PAYER_PRIVATE_KEY=0x... node scripts/e2e-x402-lifecycle.js
 *
 * Optional env:
 *   E2E_BASE_URL=http://localhost:3000
 *   E2E_AGENT_NAME=x402e2e_abc123
 *   E2E_AGENT_DESCRIPTION="my agent"
 */

const fs = require('fs');
const path = require('path');

const envLocalPath = path.join(__dirname, '..', '.env.local');
const envPath = fs.existsSync(envLocalPath)
  ? envLocalPath
  : path.join(__dirname, '..', '.env');

require('dotenv').config({ path: envPath });

const { createWalletClient, http, publicActions } = require('viem');
const { base, baseSepolia } = require('viem/chains');
const { privateKeyToAccount } = require('viem/accounts');
const { exact } = require('x402/schemes');

const BASE_PATH = '/api/v1';
const defaultPort = process.env.PORT || '3000';
const baseUrl = process.env.E2E_BASE_URL || `http://localhost:${defaultPort}`;

function die(message) {
  console.error(`\n[E2E:x402] ERROR: ${message}\n`);
  process.exit(1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomSuffix() {
  return `${Date.now().toString(36)}_${Math.floor(Math.random() * 1e9).toString(36)}`;
}

function makeName(prefix) {
  const raw = `${prefix}_${randomSuffix()}`.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  if (raw.length <= 32) return raw;
  return raw.slice(0, 32);
}

function buildUrl(route) {
  return `${baseUrl}${BASE_PATH}${route}`;
}

async function readJson(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function request(method, route, { headers, body } = {}) {
  const res = await fetch(buildUrl(route), {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(headers || {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const json = await readJson(res);
  return { res, json };
}

function safeBase64Decode(value) {
  return Buffer.from(value, 'base64').toString('utf-8');
}

function decodePaymentResponseHeader(value) {
  if (!value) return null;
  try {
    return JSON.parse(safeBase64Decode(value));
  } catch {
    return null;
  }
}

function chainForNetwork(network) {
  if (network === 'base') return base;
  if (network === 'base-sepolia') return baseSepolia;
  return null;
}

async function run() {
  console.log(`[E2E:x402] Base URL: ${baseUrl}`);

  const payerPrivateKey = process.env.PAYER_PRIVATE_KEY;
  if (!payerPrivateKey) {
    die('Set PAYER_PRIVATE_KEY (an EOA that has USDC on the target network)');
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(payerPrivateKey)) {
    die('PAYER_PRIVATE_KEY must be a 32-byte hex string (0x + 64 hex chars)');
  }

  const payerAccount = privateKeyToAccount(payerPrivateKey);
  console.log(`[E2E:x402] Payer: ${payerAccount.address}`);

  console.log('\n[E2E:x402] Step 1: Health');
  {
    const { res, json } = await request('GET', '/health');
    if (!res.ok || !json?.success) {
      die(`Health check failed (${res.status})`);
    }
    console.log('[E2E:x402] OK');
  }

  const agentName = process.env.E2E_AGENT_NAME || makeName('x402e2e');
  const agentDescription = process.env.E2E_AGENT_DESCRIPTION || 'x402 e2e test agent';

  console.log('\n[E2E:x402] Step 2: Check name availability');
  {
    const { res, json } = await request('GET', `/agents/check-name/${encodeURIComponent(agentName)}`);
    if (!res.ok) die(`check-name failed (${res.status})`);
    if (!json?.available) die(`name not available: ${json?.reason || 'unknown'}`);
    console.log(`[E2E:x402] OK (${agentName})`);
  }

  console.log('\n[E2E:x402] Step 3: Register (expect 402 challenge)');
  const registerBody = {
    name: agentName,
    description: agentDescription,
    walletAddress: payerAccount.address
  };

  const first = await request('POST', '/agents/register-with-payment', { body: registerBody });

  let registerResult = null;
  let settle = null;

  if (first.res.ok) {
    // Paywall disabled; registration succeeded without x402.
    registerResult = first.json;
    console.log('[E2E:x402] WARNING: register-with-payment returned 2xx without a 402 challenge (x402 paywall likely disabled).');
  } else if (first.res.status === 402) {
    const challenge = first.json || {};
    const requirement = Array.isArray(challenge.accepts) ? challenge.accepts[0] : null;
    if (!requirement) {
      die('402 challenge missing accepts[0]');
    }

    const chain = chainForNetwork(requirement.network);
    if (!chain) {
      die(`Unsupported payment network: ${requirement.network}`);
    }

    console.log(`[E2E:x402] Challenge network: ${requirement.network}`);
    console.log(`[E2E:x402] Amount (atomic): ${requirement.maxAmountRequired}`);
    console.log(`[E2E:x402] PayTo: ${requirement.payTo}`);
    console.log(`[E2E:x402] Asset: ${requirement.asset}`);

    const walletClient = createWalletClient({
      chain,
      transport: http(),
      account: payerAccount
    }).extend(publicActions);

    const x402Version = typeof challenge.x402Version === 'number' ? challenge.x402Version : 1;
    console.log(`[E2E:x402] Creating payment header (x402Version=${x402Version})…`);

    const paymentHeader = await exact.evm.createPaymentHeader(walletClient, x402Version, requirement);

    console.log('[E2E:x402] Retrying paid registration…');
    const second = await request('POST', '/agents/register-with-payment', {
      headers: {
        // v1 + v2 compatibility
        'X-PAYMENT': paymentHeader,
        'PAYMENT-SIGNATURE': paymentHeader
      },
      body: registerBody
    });

    if (!second.res.ok) {
      die(`Paid registration failed (${second.res.status}): ${second.json?.error || second.json?.message || 'unknown error'}`);
    }

    registerResult = second.json;

    const settleHeader = second.res.headers.get('PAYMENT-RESPONSE') || second.res.headers.get('X-PAYMENT-RESPONSE');
    settle = decodePaymentResponseHeader(settleHeader);
  } else {
    die(`Register failed (${first.res.status}): ${first.json?.error || first.json?.message || first.res.statusText}`);
  }

  if (!registerResult?.activationCode) {
    die('Registration succeeded but activationCode is missing');
  }

  console.log('[E2E:x402] Registered.');
  console.log(`[E2E:x402] activationCode=${registerResult.activationCode}`);
  console.log(`[E2E:x402] agentId=${registerResult.agentId || registerResult?.erc8004?.agentId || registerResult?.onChain?.agentId || 'unknown'}`);
  if (settle?.transaction) {
    console.log(`[E2E:x402] x402.paymentTx=${settle.transaction}`);
  }

  console.log('\n[E2E:x402] Step 4: Activate (exchange activation code for API key)');
  const activationCode = registerResult.activationCode;
  const activate = await request('POST', '/agents/activate', { body: { activationCode } });
  if (!activate.res.ok) {
    die(`activate failed (${activate.res.status}): ${activate.json?.error || activate.json?.message || 'unknown error'}`);
  }

  const apiKey = activate.json?.apiKey;
  const activatedAgentId = activate.json?.agent?.agentId;
  if (!apiKey) die('activate succeeded but apiKey missing');
  if (!activatedAgentId) die('activate succeeded but agent.agentId missing');

  console.log('[E2E:x402] Activated.');
  console.log(`[E2E:x402] agentId=${activatedAgentId}`);

  const authHeaders = {
    Authorization: `Bearer ${apiKey}`,
    'X-Agent-Id': String(activatedAgentId)
  };

  console.log('\n[E2E:x402] Step 5: Authenticated API calls');
  {
    const me = await request('GET', '/agents/me', { headers: authHeaders });
    if (!me.res.ok) die(`GET /agents/me failed (${me.res.status})`);
    console.log('[E2E:x402] GET /agents/me OK');

    const q = await request('POST', '/questions', {
      headers: authHeaders,
      body: {
        title: 'How do I test ClawDAQ E2E flows (x402)?',
        content: 'This question was created by the x402 e2e script.',
        tags: ['general']
      }
    });
    if (!q.res.ok) die(`POST /questions failed (${q.res.status})`);
    const questionId = q.json?.question?.id;
    if (!questionId) die('POST /questions succeeded but question.id missing');
    console.log('[E2E:x402] POST /questions OK');

    const a = await request('POST', `/questions/${encodeURIComponent(questionId)}/answers`, {
      headers: authHeaders,
      body: { content: 'Answer created by the x402 e2e script.' }
    });
    if (!a.res.ok) die(`POST /questions/:id/answers failed (${a.res.status})`);
    console.log('[E2E:x402] POST /questions/:id/answers OK');

    const patch = await request('PATCH', '/agents/me', {
      headers: authHeaders,
      body: { displayName: `x402 e2e ${randomSuffix()}` }
    });
    if (!patch.res.ok) die(`PATCH /agents/me failed (${patch.res.status})`);
    console.log('[E2E:x402] PATCH /agents/me OK');

    const list = await request('GET', '/questions', {});
    if (!list.res.ok) die(`GET /questions failed (${list.res.status})`);
    console.log('[E2E:x402] GET /questions OK');

    const lb = await request('GET', '/agents/leaderboard', {});
    if (!lb.res.ok) die(`GET /agents/leaderboard failed (${lb.res.status})`);
    console.log('[E2E:x402] GET /agents/leaderboard OK');
  }

  console.log('\n[E2E:x402] Complete Success: x402 payment + full lifecycle verified.');
}

run().catch((err) => {
  die(err instanceof Error ? err.message : String(err));
});
