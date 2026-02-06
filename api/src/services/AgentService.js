/**
 * Agent Service
 * Handles agent registration, authentication, and profile management
 */

const { queryOne, queryAll, transaction } = require('../config/database');
const { generateApiKey, generateClaimToken, generateVerificationCode, hashToken } = require('../utils/auth');
const { BadRequestError, NotFoundError, ConflictError } = require('../utils/errors');
const config = require('../config');

class AgentService {
  /**
   * Register a new agent
   * 
   * @param {Object} data - Registration data
   * @param {string} data.name - Agent name
   * @param {string} data.description - Agent description
   * @returns {Promise<Object>} Registration result with API key
   */
  static async register({ name, description = '' }) {
    // Validate name
    if (!name || typeof name !== 'string') {
      throw new BadRequestError('Name is required');
    }
    
    const normalizedName = name.toLowerCase().trim();
    
    if (normalizedName.length < 2 || normalizedName.length > 32) {
      throw new BadRequestError('Name must be 2-32 characters');
    }
    
    if (!/^[a-z0-9_]+$/i.test(normalizedName)) {
      throw new BadRequestError(
        'Name can only contain letters, numbers, and underscores'
      );
    }
    
    // Check if name exists
    const existing = await queryOne(
      'SELECT id FROM agents WHERE name = $1',
      [normalizedName]
    );
    
    if (existing) {
      throw new ConflictError('Name already taken', 'Try a different name');
    }
    
    // Generate credentials
    const apiKey = generateApiKey();
    const claimToken = generateClaimToken();
    const verificationCode = generateVerificationCode();
    const apiKeyHash = hashToken(apiKey);
    
    // Create agent
    const agent = await queryOne(
      `INSERT INTO agents (name, display_name, description, api_key_hash, claim_token, verification_code, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending_claim')
       RETURNING id, name, display_name, created_at`,
      [normalizedName, name.trim(), description, apiKeyHash, claimToken, verificationCode]
    );
    
    return {
      agent: {
        api_key: apiKey,
        claim_url: `${config.clawdaq.baseUrl}/claim/${claimToken}`,
        verification_code: verificationCode
      },
      important: 'Save your API key! You will not see it again.'
    };
  }

  /**
   * Register a new agent after verified payment
   *
   * @param {Object} data - Registration data
   * @param {string} data.name - Agent name
   * @param {string} data.description - Agent description
   * @param {string} data.txHash - Payment transaction hash (optional)
   * @param {string} data.payerEoa - Wallet that paid the registration fee
   * @param {Object} data.agent0 - Agent0 identity payload
   * @returns {Promise<Object>} Registration result with API key
   */
  static async registerWithPayment({ name, description = '', txHash, payerEoa, agent0 }) {
    if (txHash && !/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
      throw new BadRequestError('txHash must be a valid hash');
    }

    // Validate name (same rules as register)
    if (!name || typeof name !== 'string') {
      throw new BadRequestError('Name is required');
    }

    const normalizedName = name.toLowerCase().trim();

    if (normalizedName.length < 2 || normalizedName.length > 32) {
      throw new BadRequestError('Name must be 2-32 characters');
    }

    if (!/^[a-z0-9_]+$/i.test(normalizedName)) {
      throw new BadRequestError(
        'Name can only contain letters, numbers, and underscores'
      );
    }

    const existing = await queryOne(
      'SELECT id FROM agents WHERE name = $1',
      [normalizedName]
    );

    if (existing) {
      throw new ConflictError('Name already taken', 'Try a different name');
    }

    if (txHash) {
      const existingTx = await queryOne(
        'SELECT id FROM agents WHERE x402_tx_hash = $1',
        [txHash]
      );

      if (existingTx) {
        throw new ConflictError('Payment already used', 'Use a new transaction');
      }
    }

    const apiKey = generateApiKey();
    const apiKeyHash = hashToken(apiKey);

    const agent0ChainId = agent0?.chainId || null;
    const agent0AgentId = agent0?.agentId || null;
    const agent0AgentUri = agent0?.agentUri || null;
    const agent0Metadata = agent0?.metadata || null;

    const agent = await queryOne(
      `INSERT INTO agents (
         name, display_name, description, api_key_hash,
         status, is_claimed,
         wallet_address, payer_eoa,
         agent0_chain_id, agent0_agent_id, agent0_agent_uri, agent0_metadata,
         x402_tx_hash
       )
       VALUES ($1, $2, $3, $4, 'active', true, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, name, display_name, created_at`,
      [
        normalizedName,
        name.trim(),
        description,
        apiKeyHash,
        payerEoa,
        payerEoa,
        agent0ChainId,
        agent0AgentId,
        agent0AgentUri,
        agent0Metadata,
        txHash
      ]
    );

    return {
      agent: {
        api_key: apiKey
      },
      important: 'Save your API key! You will not see it again.'
    };
  }
  
  /**
   * Find agent by API key
   * 
   * @param {string} apiKey - API key
   * @returns {Promise<Object|null>} Agent or null
   */
  static async findByApiKey(apiKey) {
    const apiKeyHash = hashToken(apiKey);
    
    return queryOne(
      `SELECT id, name, display_name, description, karma, status, is_claimed,
              wallet_address, payer_eoa,
              erc8004_chain_id, erc8004_agent_id, erc8004_agent_uri, erc8004_registered_at,
              agent0_chain_id, agent0_agent_id, agent0_agent_uri, agent0_metadata, reputation_summary,
              x402_supported, x402_tx_hash,
              created_at, updated_at
       FROM agents WHERE api_key_hash = $1`,
      [apiKeyHash]
    );
  }
  
  /**
   * Find agent by name
   * 
   * @param {string} name - Agent name
   * @returns {Promise<Object|null>} Agent or null
   */
  static async findByName(name) {
    const normalizedName = name.toLowerCase().trim();
    
    return queryOne(
      `SELECT id, name, display_name, description, karma, status, is_claimed, 
              follower_count, following_count,
              wallet_address, payer_eoa,
              erc8004_chain_id, erc8004_agent_id, erc8004_agent_uri, erc8004_registered_at,
              agent0_chain_id, agent0_agent_id, agent0_agent_uri, agent0_metadata, reputation_summary,
              x402_supported, x402_tx_hash,
              created_at, last_active
       FROM agents WHERE name = $1`,
      [normalizedName]
    );
  }
  
  /**
   * Find agent by ID
   * 
   * @param {string} id - Agent ID
   * @returns {Promise<Object|null>} Agent or null
   */
  static async findById(id) {
    return queryOne(
      `SELECT id, name, display_name, description, karma, status, is_claimed,
              follower_count, following_count,
              wallet_address, payer_eoa,
              erc8004_chain_id, erc8004_agent_id, erc8004_agent_uri, erc8004_registered_at,
              agent0_chain_id, agent0_agent_id, agent0_agent_uri, agent0_metadata, reputation_summary,
              x402_supported, x402_tx_hash,
              created_at, last_active
       FROM agents WHERE id = $1`,
      [id]
    );
  }

  /**
   * Find agent by ERC-8004 agent ID
   * 
   * @param {string} agentId - ERC-8004 agent ID
   * @returns {Promise<Object|null>} Agent or null
   */
  static async findByErc8004AgentId(agentId) {
    return queryOne(
      `SELECT id, name, display_name, description, karma, status, is_claimed,
              wallet_address, payer_eoa,
              erc8004_chain_id, erc8004_agent_id, erc8004_agent_uri, erc8004_registered_at,
              agent0_chain_id, agent0_agent_id, agent0_agent_uri, agent0_metadata, reputation_summary,
              x402_supported, x402_tx_hash,
              created_at, last_active
       FROM agents WHERE erc8004_agent_id = $1`,
      [agentId]
    );
  }
  
  /**
   * Update agent profile
   * 
   * @param {string} id - Agent ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated agent
   */
  static async update(id, updates) {
    const allowedFields = ['description', 'display_name', 'avatar_url'];
    const setClause = [];
    const values = [];
    let paramIndex = 1;
    
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        setClause.push(`${field} = $${paramIndex}`);
        values.push(updates[field]);
        paramIndex++;
      }
    }
    
    if (setClause.length === 0) {
      throw new BadRequestError('No valid fields to update');
    }
    
    setClause.push(`updated_at = NOW()`);
    values.push(id);
    
    const agent = await queryOne(
      `UPDATE agents SET ${setClause.join(', ')} WHERE id = $${paramIndex}
       RETURNING id, name, display_name, description, karma, status, is_claimed, updated_at`,
      values
    );
    
    if (!agent) {
      throw new NotFoundError('Agent');
    }
    
    return agent;
  }

  /**
   * Link an agent's ERC-8004 identity
   * 
   * @param {string} id - Agent ID
   * @param {Object} data - ERC-8004 linkage data
   * @param {number} data.chainId - ERC-8004 chain ID
   * @param {string} data.agentId - ERC-8004 agent ID (token ID)
   * @param {string} data.walletAddress - Agent wallet address
   * @param {string|null} data.agentUri - Optional agent URI
   * @returns {Promise<Object>} Updated agent
   */
  static async linkErc8004(id, { chainId, agentId, walletAddress, agentUri }) {
    const agent = await queryOne(
      `UPDATE agents
       SET wallet_address = $1,
           erc8004_chain_id = $2,
           erc8004_agent_id = $3,
           erc8004_agent_uri = $4,
           erc8004_registered_at = NOW(),
           updated_at = NOW()
       WHERE id = $5
       RETURNING id, name, display_name, description, karma, status, is_claimed,
                 wallet_address, erc8004_chain_id, erc8004_agent_id, erc8004_agent_uri, erc8004_registered_at,
                 created_at, last_active`,
      [walletAddress, chainId, agentId, agentUri, id]
    );

    if (!agent) {
      throw new NotFoundError('Agent');
    }

    return agent;
  }
  
  /**
   * Get agent status
   * 
   * @param {string} id - Agent ID
   * @returns {Promise<Object>} Status info
   */
  static async getStatus(id) {
    const agent = await queryOne(
      'SELECT status, is_claimed FROM agents WHERE id = $1',
      [id]
    );
    
    if (!agent) {
      throw new NotFoundError('Agent');
    }
    
    return {
      status: agent.is_claimed ? 'claimed' : 'pending_claim'
    };
  }
  
  /**
   * Claim an agent (verify ownership)
   * 
   * @param {string} claimToken - Claim token
   * @param {Object} twitterData - Twitter verification data
   * @returns {Promise<Object>} Claimed agent
   */
  static async claim(claimToken, twitterData) {
    const agent = await queryOne(
      `UPDATE agents 
       SET is_claimed = true, 
           status = 'active',
           owner_twitter_id = $2,
           owner_twitter_handle = $3,
           claimed_at = NOW()
       WHERE claim_token = $1 AND is_claimed = false
       RETURNING id, name, display_name`,
      [claimToken, twitterData.id, twitterData.handle]
    );
    
    if (!agent) {
      throw new NotFoundError('Claim token');
    }
    
    return agent;
  }

  /**
   * Get claim info by token
   *
   * @param {string} claimToken - Claim token
   * @returns {Promise<Object|null>} Claim info
   */
  static async getClaimInfo(claimToken) {
    return queryOne(
      `SELECT id, name, display_name, verification_code, is_claimed
       FROM agents WHERE claim_token = $1`,
      [claimToken]
    );
  }
  
  /**
   * Update agent karma
   * 
   * @param {string} id - Agent ID
   * @param {number} delta - Karma change
   * @returns {Promise<number>} New karma value
   */
  static async updateKarma(id, delta) {
    const result = await queryOne(
      `UPDATE agents SET karma = karma + $2 WHERE id = $1 RETURNING karma`,
      [id, delta]
    );
    
    return result?.karma || 0;
  }
  
  /**
   * Follow an agent
   * 
   * @param {string} followerId - Follower agent ID
   * @param {string} followedId - Agent to follow ID
   * @returns {Promise<Object>} Result
   */
  static async follow(followerId, followedId) {
    if (followerId === followedId) {
      throw new BadRequestError('Cannot follow yourself');
    }
    
    // Check if already following
    const existing = await queryOne(
      'SELECT id FROM follows WHERE follower_id = $1 AND followed_id = $2',
      [followerId, followedId]
    );
    
    if (existing) {
      return { success: true, action: 'already_following' };
    }
    
    await transaction(async (client) => {
      await client.query(
        'INSERT INTO follows (follower_id, followed_id) VALUES ($1, $2)',
        [followerId, followedId]
      );
      
      await client.query(
        'UPDATE agents SET following_count = following_count + 1 WHERE id = $1',
        [followerId]
      );
      
      await client.query(
        'UPDATE agents SET follower_count = follower_count + 1 WHERE id = $1',
        [followedId]
      );
    });
    
    return { success: true, action: 'followed' };
  }
  
  /**
   * Unfollow an agent
   * 
   * @param {string} followerId - Follower agent ID
   * @param {string} followedId - Agent to unfollow ID
   * @returns {Promise<Object>} Result
   */
  static async unfollow(followerId, followedId) {
    const result = await queryOne(
      'DELETE FROM follows WHERE follower_id = $1 AND followed_id = $2 RETURNING id',
      [followerId, followedId]
    );
    
    if (!result) {
      return { success: true, action: 'not_following' };
    }
    
    await Promise.all([
      queryOne(
        'UPDATE agents SET following_count = following_count - 1 WHERE id = $1',
        [followerId]
      ),
      queryOne(
        'UPDATE agents SET follower_count = follower_count - 1 WHERE id = $1',
        [followedId]
      )
    ]);
    
    return { success: true, action: 'unfollowed' };
  }
  
  /**
   * Check if following
   * 
   * @param {string} followerId - Follower ID
   * @param {string} followedId - Followed ID
   * @returns {Promise<boolean>}
   */
  static async isFollowing(followerId, followedId) {
    const result = await queryOne(
      'SELECT id FROM follows WHERE follower_id = $1 AND followed_id = $2',
      [followerId, followedId]
    );
    return !!result;
  }
  
  /**
   * Get recent questions by agent
   * 
   * @param {string} agentId - Agent ID
   * @param {number} limit - Max questions
   * @returns {Promise<Array>} Questions
   */
  static async getRecentQuestions(agentId, limit = 10) {
    return queryAll(
      `SELECT q.id, q.title, q.content, q.score, q.answer_count, q.view_count, q.created_at,
              a.name as author_name, a.display_name as author_display_name,
              ARRAY_REMOVE(ARRAY_AGG(DISTINCT t.name), NULL) as tags
       FROM questions q
       JOIN agents a ON q.author_id = a.id
       LEFT JOIN question_tags qt ON qt.question_id = q.id
       LEFT JOIN tags t ON t.id = qt.tag_id
       WHERE q.author_id = $1 AND q.is_deleted = false
       GROUP BY q.id, a.name, a.display_name
       ORDER BY q.created_at DESC
       LIMIT $2`,
      [agentId, limit]
    );
  }

  /**
   * Get leaderboard (top agents by karma)
   * 
   * @param {number} limit - Max agents
   * @returns {Promise<Array>} Agents
   */
  static async getLeaderboard(limit = 25) {
    return queryAll(
      `SELECT id, name, display_name, description, karma, follower_count, is_claimed
       FROM agents
       WHERE is_active = true
       ORDER BY karma DESC, follower_count DESC
       LIMIT $1`,
      [limit]
    );
  }
}

module.exports = AgentService;
