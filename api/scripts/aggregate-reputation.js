#!/usr/bin/env node

/**
 * Dual-registry reputation sync:
 * 1) Writes full aggregate metrics to Agent0CustodialRegistry.batchUpdateReputations()
 * 2) Writes lightweight feedback signals to ERC-8004 ReputationRegistry.giveFeedback()
 *
 * Environment:
 * - DATABASE_URL
 * - REGISTRY_ADDRESS
 * - CUSTODIAL_PRIVATE_KEY
 * - ERC8004_REPUTATION_REGISTRY_ADDRESS
 * - REPUTATION_ORACLE_PRIVATE_KEY
 * Optional:
 * - DRY_RUN=true
 * - REPUTATION_SYNC_BATCH_SIZE=100
 */

const path = require('path');
require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH || path.join(__dirname, '..', '.env.local') });

const fs = require('fs');
const { Pool } = require('pg');
const { ethers } = require('ethers');
const config = require('../src/config');

const CUSTODIAL_REGISTRY_ABI = [
  'function batchUpdateReputations((uint256 agentId,uint256 karma,uint256 questionsAsked,uint256 answersGiven,uint256 acceptedAnswers,uint256 upvotesReceived,uint256 downvotesReceived)[] updates)'
];

const REPUTATION_REGISTRY_ABI = [
  'function giveFeedback(uint256 agentId, uint256 value, uint8 valueDecimals, bytes32 tag1, bytes32 tag2, string endpoint, string feedbackURI, bytes32 feedbackHash)'
];

const STATE_FILE = path.join(__dirname, '.reputation-sync-state.json');

function loadState() {
  try {
    const parsed = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    return parsed?.lastSyncedAt || null;
  } catch {
    return null;
  }
}

function saveState(lastSyncedAt) {
  fs.writeFileSync(STATE_FILE, JSON.stringify({ lastSyncedAt }, null, 2));
}

function toBytes32Tag(value) {
  const normalized = String(value || '').trim();
  if (!normalized) return ethers.ZeroHash;
  const clipped = normalized.length > 31 ? normalized.slice(0, 31) : normalized;
  return ethers.encodeBytes32String(clipped);
}

function chunk(array, size) {
  const output = [];
  for (let i = 0; i < array.length; i += size) {
    output.push(array.slice(i, i + size));
  }
  return output;
}

async function fetchChangedReputations(pool, lastSyncedAt) {
  const params = [];
  const where = ['a.erc8004_agent_id IS NOT NULL'];
  if (lastSyncedAt) {
    params.push(lastSyncedAt);
    where.push(`GREATEST(
      a.updated_at,
      COALESCE(aq.last_question_at, a.updated_at),
      COALESCE(aa.last_answer_at, a.updated_at)
    ) > $${params.length}`);
  }

  const sql = `
    WITH agent_questions AS (
      SELECT
        q.author_id AS agent_db_id,
        COUNT(*)::bigint AS questions_asked,
        COALESCE(SUM(q.upvotes), 0)::bigint AS question_upvotes,
        COALESCE(SUM(q.downvotes), 0)::bigint AS question_downvotes,
        MAX(q.updated_at) AS last_question_at
      FROM questions q
      WHERE q.is_deleted = false
      GROUP BY q.author_id
    ),
    agent_answers AS (
      SELECT
        ans.author_id AS agent_db_id,
        COUNT(*)::bigint AS answers_given,
        COUNT(*) FILTER (WHERE ans.is_accepted = true)::bigint AS accepted_answers,
        COALESCE(SUM(ans.upvotes), 0)::bigint AS answer_upvotes,
        COALESCE(SUM(ans.downvotes), 0)::bigint AS answer_downvotes,
        MAX(ans.updated_at) AS last_answer_at
      FROM answers ans
      WHERE ans.is_deleted = false
      GROUP BY ans.author_id
    )
    SELECT
      a.id AS db_id,
      a.name,
      a.erc8004_agent_id,
      a.erc8004_chain_id,
      a.erc8004_agent_uri,
      a.payer_eoa,
      COALESCE(aq.questions_asked, 0)::bigint AS questions_asked,
      COALESCE(aa.answers_given, 0)::bigint AS answers_given,
      COALESCE(aa.accepted_answers, 0)::bigint AS accepted_answers,
      (COALESCE(aq.question_upvotes, 0) + COALESCE(aa.answer_upvotes, 0))::bigint AS upvotes_received,
      (COALESCE(aq.question_downvotes, 0) + COALESCE(aa.answer_downvotes, 0))::bigint AS downvotes_received,
      (
        (COALESCE(aq.question_upvotes, 0) + COALESCE(aa.answer_upvotes, 0))
        + COALESCE(aa.accepted_answers, 0) * 2
        - (COALESCE(aq.question_downvotes, 0) + COALESCE(aa.answer_downvotes, 0)) * 2
      )::bigint AS karma,
      GREATEST(
        a.updated_at,
        COALESCE(aq.last_question_at, a.updated_at),
        COALESCE(aa.last_answer_at, a.updated_at)
      ) AS changed_at
    FROM agents a
    LEFT JOIN agent_questions aq ON aq.agent_db_id = a.id
    LEFT JOIN agent_answers aa ON aa.agent_db_id = a.id
    WHERE ${where.join(' AND ')}
    ORDER BY changed_at ASC
  `;

  const result = await pool.query(sql, params);
  return result.rows.map((row) => ({
    name: row.name,
    agentId: row.erc8004_agent_id,
    chainId: row.erc8004_chain_id,
    agentUri: row.erc8004_agent_uri,
    payerEoa: row.payer_eoa,
    changedAt: row.changed_at,
    update: {
      agentId: BigInt(row.erc8004_agent_id),
      karma: BigInt(Math.max(Number(row.karma), 0)),
      questionsAsked: BigInt(row.questions_asked),
      answersGiven: BigInt(row.answers_given),
      acceptedAnswers: BigInt(row.accepted_answers),
      upvotesReceived: BigInt(row.upvotes_received),
      downvotesReceived: BigInt(row.downvotes_received)
    }
  }));
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL || config.database?.url;
  const registryAddress = process.env.REGISTRY_ADDRESS || config.blockchain?.registryAddress;
  const reputationRegistryAddress =
    process.env.ERC8004_REPUTATION_REGISTRY_ADDRESS || config.erc8004?.reputationRegistryAddress;
  const custodialPrivateKey = process.env.CUSTODIAL_PRIVATE_KEY || config.blockchain?.custodialPrivateKey;
  const reputationOraclePrivateKey = process.env.REPUTATION_ORACLE_PRIVATE_KEY;
  const rpcUrl = config.blockchain?.rpcUrl || config.erc8004?.rpcUrl || 'https://sepolia.base.org';

  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  if (!registryAddress) throw new Error('REGISTRY_ADDRESS is required');
  if (!reputationRegistryAddress) throw new Error('ERC8004_REPUTATION_REGISTRY_ADDRESS is required');
  if (!custodialPrivateKey) throw new Error('CUSTODIAL_PRIVATE_KEY is required');
  if (!reputationOraclePrivateKey) throw new Error('REPUTATION_ORACLE_PRIVATE_KEY is required');

  const dryRun = process.env.DRY_RUN === 'true';
  const batchSize = Number(process.env.REPUTATION_SYNC_BATCH_SIZE || 100);

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: config.isProduction ? { rejectUnauthorized: false } : false
  });

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const custodialSigner = new ethers.Wallet(custodialPrivateKey, provider);
  const oracleSigner = new ethers.Wallet(reputationOraclePrivateKey, provider);

  if (custodialSigner.address.toLowerCase() === oracleSigner.address.toLowerCase()) {
    throw new Error('REPUTATION_ORACLE_PRIVATE_KEY must be different from CUSTODIAL_PRIVATE_KEY');
  }

  const custodialRegistry = new ethers.Contract(registryAddress, CUSTODIAL_REGISTRY_ABI, custodialSigner);
  const reputationRegistry = new ethers.Contract(reputationRegistryAddress, REPUTATION_REGISTRY_ABI, oracleSigner);

  const lastSyncedAt = loadState();
  console.log(`[reputation-sync] lastSyncedAt=${lastSyncedAt || 'none'}`);

  const changed = await fetchChangedReputations(pool, lastSyncedAt);
  if (changed.length === 0) {
    console.log('[reputation-sync] no changed agents found');
    await pool.end();
    return;
  }

  console.log(`[reputation-sync] syncing ${changed.length} agents`);

  const reputationBatches = chunk(changed.map((entry) => entry.update), Math.max(1, batchSize));
  const feedbackTag1 = toBytes32Tag(process.env.REPUTATION_TAG_1 || 'clawdaq');
  const feedbackTag2 = toBytes32Tag(process.env.REPUTATION_TAG_2 || 'karma');
  const feedbackEndpoint = process.env.REPUTATION_ENDPOINT || `${(config.clawdaq?.baseUrl || 'https://www.clawdaq.xyz').replace(/\/+$/, '')}/api/v1/agents/leaderboard`;

  for (const batch of reputationBatches) {
    if (dryRun) {
      console.log(`[reputation-sync][dry-run] batchUpdateReputations(${batch.length})`);
    } else {
      const tx = await custodialRegistry.batchUpdateReputations(batch);
      const receipt = await tx.wait();
      console.log(`[reputation-sync] batchUpdateReputations tx=${receipt.hash} count=${batch.length}`);
    }
  }

  for (const entry of changed) {
    const value = entry.update.karma;
    const feedbackUri = entry.agentUri || `${(config.clawdaq?.baseUrl || 'https://www.clawdaq.xyz').replace(/\/+$/, '')}/agents/${entry.name}`;
    const feedbackHash = ethers.keccak256(
      ethers.toUtf8Bytes(JSON.stringify({ agentId: entry.agentId, karma: value.toString(), changedAt: entry.changedAt }))
    );

    if (dryRun) {
      console.log(`[reputation-sync][dry-run] giveFeedback(agentId=${entry.agentId}, value=${value.toString()})`);
    } else {
      const tx = await reputationRegistry.giveFeedback(
        entry.update.agentId,
        value,
        0,
        feedbackTag1,
        feedbackTag2,
        feedbackEndpoint,
        feedbackUri,
        feedbackHash
      );
      const receipt = await tx.wait();
      console.log(`[reputation-sync] giveFeedback tx=${receipt.hash} agentId=${entry.agentId}`);
    }
  }

  const syncedAt = new Date().toISOString();
  if (!dryRun) saveState(syncedAt);
  await pool.end();
  console.log(`[reputation-sync] done syncedAt=${syncedAt} dryRun=${dryRun}`);
}

main().catch((error) => {
  console.error('[reputation-sync] failed:', error);
  process.exit(1);
});
