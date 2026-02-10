/**
 * Database connection and query helpers
 */

const { Pool } = require('pg');
const config = require('./index');
const { ServiceUnavailableError } = require('../utils/errors');

let pool = null;
let dbDisabled = false;
let warnedNoDb = false;
let warnedReadOnly = false;

const NO_DB_HINT = 'Set DATABASE_URL to enable database access';

/**
 * Initialize database connection pool
 */
function initializePool() {
  if (pool) return pool;

  if (dbDisabled) return null;

  if (!config.database.url) {
    if (!warnedNoDb) {
      console.warn('DATABASE_URL not set, using mock database');
      warnedNoDb = true;
    }
    dbDisabled = true;
    return null;
  }
  
  pool = new Pool({
    connectionString: config.database.url,
    ssl: config.database.ssl,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000  // Increased for Neon DB cold starts
  });
  
  pool.on('error', (err) => {
    console.error('Unexpected database error:', err);
  });
  
  return pool;
}

function isReadQuery(text) {
  if (!text || typeof text !== 'string') return false;
  const firstToken = text.trim().split(/\s+/)[0];
  if (!firstToken) return false;
  const verb = firstToken.toUpperCase();
  return verb === 'SELECT' || verb === 'WITH' || verb === 'SHOW';
}

/**
 * Execute a query
 * 
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
async function query(text, params) {
  const db = initializePool();
  
  if (!db) {
    if (isReadQuery(text)) {
      if (!warnedReadOnly) {
        console.warn('Database not configured; returning empty results for read-only queries');
        warnedReadOnly = true;
      }
      return { rows: [], rowCount: 0 };
    }

    throw new ServiceUnavailableError('Database not configured', NO_DB_HINT);
  }
  
  const start = Date.now();
  const result = await db.query(text, params);
  const duration = Date.now() - start;
  
  if (config.nodeEnv === 'development') {
    console.log('Query executed', { text: text.substring(0, 50), duration, rows: result.rowCount });
  }
  
  return result;
}

/**
 * Execute a query and return first row
 * 
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Object|null>} First row or null
 */
async function queryOne(text, params) {
  const result = await query(text, params);
  return result.rows[0] || null;
}

/**
 * Execute a query and return all rows
 * 
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Array>} All rows
 */
async function queryAll(text, params) {
  const result = await query(text, params);
  return result.rows;
}

/**
 * Execute multiple queries in a transaction
 * 
 * @param {Function} callback - Function receiving client
 * @returns {Promise<any>} Transaction result
 */
async function transaction(callback) {
  const db = initializePool();
  
  if (!db) {
    throw new ServiceUnavailableError('Database not configured', NO_DB_HINT);
  }
  
  const client = await db.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Check database connection
 * 
 * @returns {Promise<boolean>}
 */
async function healthCheck() {
  try {
    const db = initializePool();
    if (!db) return false;
    
    await db.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

/**
 * Close database connections
 */
async function close() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  initializePool,
  query,
  queryOne,
  queryAll,
  transaction,
  healthCheck,
  close,
  getPool: () => pool
};
