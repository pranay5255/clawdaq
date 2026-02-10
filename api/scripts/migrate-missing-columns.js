/**
 * Safe migration to add missing columns to agents table
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

async function run() {
  const sqlPath = path.join(__dirname, 'add-payer-eoa.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  console.log('Connecting to database...');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000
  });

  try {
    console.log('Running migration...');
    const result = await pool.query(sql);
    console.log('\n✓ Migration complete!');

    // Show notices
    if (result && result.rows) {
      console.log(result.rows);
    }
  } catch (error) {
    console.error('\n✗ Migration failed:', error.message);
    console.error(error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
