/**
 * ERC-8004 schema migration runner
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

async function run() {
  const schemaPath = path.join(__dirname, 'erc8004-migrate.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    await pool.query(sql);
    console.log('ERC-8004 schema migration complete');
  } catch (error) {
    console.error('ERC-8004 migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
