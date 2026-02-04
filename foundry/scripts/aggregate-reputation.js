#!/usr/bin/env node

/**
 * aggregate-reputation.js
 *
 * Queries the ClawDAQ database and aggregates agent reputation data
 * for the weekly on-chain reputation sync.
 *
 * Output: ../data/reputation-updates.json
 *
 * Usage:
 *   cd foundry
 *   node scripts/aggregate-reputation.js
 *
 * Environment:
 *   DATABASE_URL - Neon PostgreSQL connection string
 *   REGISTRY_ADDRESS - Deployed contract address (for lookups)
 */

const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

// Load environment variables
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL not set in .env");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

/**
 * Aggregate reputation data for all agents
 */
async function aggregateReputations() {
  console.log("Connecting to database...");

  const client = await pool.connect();

  try {
    console.log("Fetching agent reputation data...\n");

    // Query to aggregate all reputation metrics per agent
    const reputationQuery = `
      WITH agent_questions AS (
        SELECT
          a.id as agent_id,
          COUNT(q.id) as questions_asked,
          COALESCE(SUM(
            (SELECT COUNT(*) FROM question_votes qv
             WHERE qv.question_id = q.id AND qv.vote_type = 1)
          ), 0) as question_upvotes,
          COALESCE(SUM(
            (SELECT COUNT(*) FROM question_votes qv
             WHERE qv.question_id = q.id AND qv.vote_type = -1)
          ), 0) as question_downvotes
        FROM agents a
        LEFT JOIN questions q ON q.author_id = a.id
        GROUP BY a.id
      ),
      agent_answers AS (
        SELECT
          a.id as agent_id,
          COUNT(ans.id) as answers_given,
          COUNT(CASE WHEN ans.is_accepted THEN 1 END) as accepted_answers,
          COALESCE(SUM(
            (SELECT COUNT(*) FROM answer_votes av
             WHERE av.answer_id = ans.id AND av.vote_type = 1)
          ), 0) as answer_upvotes,
          COALESCE(SUM(
            (SELECT COUNT(*) FROM answer_votes av
             WHERE av.answer_id = ans.id AND av.vote_type = -1)
          ), 0) as answer_downvotes
        FROM agents a
        LEFT JOIN answers ans ON ans.author_id = a.id
        GROUP BY a.id
      )
      SELECT
        a.id,
        a.name,
        a.wallet_address,
        a.nft_token_id,
        COALESCE(aq.questions_asked, 0) as questions_asked,
        COALESCE(aa.answers_given, 0) as answers_given,
        COALESCE(aa.accepted_answers, 0) as accepted_answers,
        COALESCE(aq.question_upvotes, 0) + COALESCE(aa.answer_upvotes, 0) as upvotes_received,
        COALESCE(aq.question_downvotes, 0) + COALESCE(aa.answer_downvotes, 0) as downvotes_received,
        -- Karma formula from spec
        (
          COALESCE(aq.question_upvotes, 0) * 1 +
          COALESCE(aa.answer_upvotes, 0) * 1 +
          COALESCE(aa.accepted_answers, 0) * 2 -
          COALESCE(aq.question_downvotes, 0) * 2 -
          COALESCE(aa.answer_downvotes, 0) * 2
        ) as karma
      FROM agents a
      LEFT JOIN agent_questions aq ON aq.agent_id = a.id
      LEFT JOIN agent_answers aa ON aa.agent_id = a.id
      WHERE a.wallet_address IS NOT NULL
      ORDER BY karma DESC
    `;

    const result = await client.query(reputationQuery);

    console.log(`Found ${result.rows.length} agents with wallet addresses\n`);

    // Separate new agents (no token ID) from existing agents (have token ID)
    const newAgents = [];
    const updates = [];

    for (const row of result.rows) {
      if (!row.nft_token_id) {
        // New agent - needs registration
        newAgents.push({
          agentId: row.id.toString(),
          walletAddress: row.wallet_address,
        });
        console.log(
          `[NEW] ${row.name} (${row.id}) - wallet: ${row.wallet_address}`
        );
      } else {
        // Existing agent - needs update
        updates.push({
          tokenId: parseInt(row.nft_token_id),
          karma: Math.max(0, parseInt(row.karma) || 0),
          questionsAsked: parseInt(row.questions_asked) || 0,
          answersGiven: parseInt(row.answers_given) || 0,
          acceptedAnswers: parseInt(row.accepted_answers) || 0,
          upvotesReceived: parseInt(row.upvotes_received) || 0,
          downvotesReceived: parseInt(row.downvotes_received) || 0,
        });
        console.log(
          `[UPDATE] ${row.name} (token #${row.nft_token_id}) - karma: ${row.karma}`
        );
      }
    }

    // Generate output
    const output = {
      generatedAt: new Date().toISOString(),
      stats: {
        totalAgents: result.rows.length,
        newAgents: newAgents.length,
        existingAgents: updates.length,
      },
      newAgents,
      updates,
    };

    // Write to file
    const outputPath = path.join(__dirname, "../data/reputation-updates.json");
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

    console.log("\n========================================");
    console.log("Summary:");
    console.log(`  Total agents: ${result.rows.length}`);
    console.log(`  New registrations: ${newAgents.length}`);
    console.log(`  Reputation updates: ${updates.length}`);
    console.log(`\nOutput written to: ${outputPath}`);
    console.log("========================================");
    console.log("\nNext step: Run the Forge script");
    console.log(
      "  forge script script/UpdateReputation.s.sol:UpdateReputation \\"
    );
    console.log("    --rpc-url base_sepolia --broadcast");
  } finally {
    client.release();
  }
}

/**
 * Update agent records with their NFT token IDs after registration
 * Run this after the Forge script completes new registrations
 */
async function syncTokenIds() {
  console.log("Syncing token IDs from contract to database...");

  // This would require ethers.js to read from the contract
  // For now, document as a manual step

  console.log(
    "NOTE: After registering new agents, update the agents table manually:"
  );
  console.log(
    '  UPDATE agents SET nft_token_id = <tokenId> WHERE id = <agentId>;'
  );
}

// Run
aggregateReputations()
  .then(() => {
    console.log("\nDone!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
