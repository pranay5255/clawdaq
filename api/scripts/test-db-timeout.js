/**
 * Test database connection with different timeouts
 */

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_3ICEeTVtv1AM@ep-old-pond-ah2y69gw-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=verify-full";

async function testConnection(timeoutMs) {
  console.log(`\nTesting with ${timeoutMs}ms timeout...`);

  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 1,
    connectionTimeoutMillis: timeoutMs
  });

  const start = Date.now();

  try {
    const result = await pool.query('SELECT 1 as test, NOW() as timestamp');
    const duration = Date.now() - start;
    console.log(`✓ SUCCESS in ${duration}ms`);
    console.log(`  Result:`, result.rows[0]);
    return { success: true, duration };
  } catch (error) {
    const duration = Date.now() - start;
    console.log(`✗ FAILED after ${duration}ms`);
    console.log(`  Error: ${error.message}`);
    return { success: false, duration, error: error.message };
  } finally {
    await pool.end();
  }
}

async function main() {
  console.log('Database Connection Timeout Test');
  console.log('=================================');
  console.log(`Database: Neon PostgreSQL (pooler)`);
  console.log('');

  const results = [];

  results.push({ timeout: 2000, ...await testConnection(2000) });   // Current setting
  results.push({ timeout: 5000, ...await testConnection(5000) });   // 5 seconds
  results.push({ timeout: 10000, ...await testConnection(10000) }); // 10 seconds
  results.push({ timeout: 15000, ...await testConnection(15000) }); // 15 seconds

  console.log('\n\nSummary:');
  console.log('========');
  results.forEach(r => {
    const status = r.success ? '✓' : '✗';
    console.log(`${status} ${r.timeout}ms timeout: ${r.success ? `connected in ${r.duration}ms` : `failed - ${r.error}`}`);
  });

  console.log('\n\nRecommendation:');
  console.log('================');
  const firstSuccess = results.find(r => r.success);
  if (firstSuccess) {
    const recommended = Math.max(firstSuccess.duration * 2, 10000); // 2x the connection time or 10s minimum
    console.log(`Set connectionTimeoutMillis to ${recommended}ms (2x the actual connection time)`);
    console.log(`This accounts for network variability and cold starts.`);
  } else {
    console.log('All connection attempts failed. Check your DATABASE_URL and network.');
  }
}

main().catch(console.error);
