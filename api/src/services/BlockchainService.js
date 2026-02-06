/**
 * Blockchain Service
 * Handles agent registration on the blockchain and integration with smart contracts
 */

const { ethers } = require('ethers');
const config = require('../config');

// Contract ABIs (Agent0CustodialRegistry - simplified for the functions we need)
const REGISTRY_ABI = [
  // View functions
  "function owner() view returns (address)",
  "function usdc() view returns (address)",
  "function REGISTRATION_FEE() view returns (uint256)",
  "function MAX_BATCH_SIZE() view returns (uint256)",
  "function treasuryBalance() view returns (uint256)",
  "function totalAgents() view returns (uint256)",
  "function agents(uint256 agentId) view returns (address payerEoa, string agentUri, uint256 registeredAt, bool isActive)",
  "function reputations(uint256 agentId) view returns (uint256 karma, uint256 questionsAsked, uint256 answersGiven, uint256 acceptedAnswers, uint256 upvotesReceived, uint256 downvotesReceived, uint256 lastUpdated, bool isActive)",
  "function activities(uint256 agentId) view returns (uint256 questionsCount, uint256 answersCount, uint256 upvotesReceived, uint256 downvotesReceived, uint256 lastUpdated)",

  // State-changing functions
  "function registerAgent(uint256 agentId, address payerEoa, string agentUri)",
  "function setAgentUri(uint256 agentId, string agentUri)",
  "function setAgentActive(uint256 agentId, bool isActive)",
  "function updateReputation(uint256 agentId, tuple(uint256 agentId, uint256 karma, uint256 questionsAsked, uint256 answersGiven, uint256 acceptedAnswers, uint256 upvotesReceived, uint256 downvotesReceived) update)",
  "function batchUpdateReputations(tuple(uint256 agentId, uint256 karma, uint256 questionsAsked, uint256 answersGiven, uint256 acceptedAnswers, uint256 upvotesReceived, uint256 downvotesReceived)[] updates)",
  "function updateAgentActivity(uint256 agentId, uint256 questionsCount, uint256 answersCount, uint256 upvotesReceived, uint256 downvotesReceived)",
  "function batchUpdateActivities(tuple(uint256 agentId, uint256 questionsCount, uint256 answersCount, uint256 upvotesReceived, uint256 downvotesReceived)[] updates)",
  "function withdrawTreasury(uint256 amount, address to)",

  // Events
  "event AgentRegistered(uint256 indexed agentId, uint256 indexed tokenId, address indexed payerEoa, string agentUri)",
  "event AgentUriUpdated(uint256 indexed agentId, string agentUri)",
  "event AgentActiveUpdated(uint256 indexed agentId, bool isActive)",
  "event ReputationUpdated(uint256 indexed agentId, uint256 karma, uint256 timestamp)",
  "event BatchReputationUpdated(uint256 count, uint256 timestamp)",
  "event ActivityUpdated(uint256 indexed agentId, uint256 questionsCount, uint256 answersCount, uint256 timestamp)",
  "event BatchActivityUpdated(uint256 count, uint256 timestamp)",
  "event TreasuryWithdrawn(uint256 amount, address indexed to)"
];

const ERC20_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)"
];

class BlockchainService {
  constructor() {
    this.provider = null;
    this.registryContract = null;
    this.usdcContract = null;
    this.isInitialized = false;
  }

  /**
   * Initialize the blockchain service
   */
  initialize() {
    if (this.isInitialized) return;

    const rpcUrl = config.blockchain?.rpcUrl || process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';
    const registryAddress = config.blockchain?.registryAddress || process.env.REGISTRY_ADDRESS;
    const usdcAddress = config.blockchain?.usdcAddress || process.env.USDC_ADDRESS;

    if (!registryAddress) {
      console.warn('[BlockchainService] REGISTRY_ADDRESS not set, blockchain features disabled');
      return;
    }

    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.registryContract = new ethers.Contract(registryAddress, REGISTRY_ABI, this.provider);
    
    if (usdcAddress) {
      this.usdcContract = new ethers.Contract(usdcAddress, ERC20_ABI, this.provider);
    }

    this.isInitialized = true;
    console.log('[BlockchainService] Initialized with registry:', registryAddress);
  }

  /**
   * Get a signer from a private key
   */
  getSigner(privateKey) {
    if (!this.isInitialized) this.initialize();
    return new ethers.Wallet(privateKey, this.provider);
  }

  normalizeAgentId(agentId) {
    if (agentId === null || agentId === undefined) {
      throw new Error('agentId is required');
    }
    if (typeof agentId === 'bigint') return agentId;
    const raw = typeof agentId === 'number' ? agentId.toString() : String(agentId).trim();
    if (!raw) throw new Error('agentId is required');
    const parsed = BigInt(raw);
    if (parsed <= 0n) throw new Error('agentId must be greater than 0');
    return parsed;
  }

  /**
   * Check if an agent is registered on the blockchain
   */
  async isAgentRegistered(agentId) {
    if (!this.isInitialized) this.initialize();
    if (!this.registryContract) return null;

    try {
      const normalizedId = this.normalizeAgentId(agentId);
      const record = await this.registryContract.agents(normalizedId);
      const registeredAt = record?.registeredAt ?? record?.[2];
      return registeredAt ? BigInt(registeredAt) > 0n : false;
    } catch (error) {
      console.error('[BlockchainService] Error checking registration:', error);
      return null;
    }
  }

  /**
   * Get agent's token ID on the blockchain
   */
  async getTokenId(agentId) {
    if (!this.isInitialized) this.initialize();
    if (!this.registryContract) return null;

    try {
      const normalizedId = this.normalizeAgentId(agentId);
      const registered = await this.isAgentRegistered(normalizedId);
      return registered ? normalizedId.toString() : null;
    } catch (error) {
      console.error('[BlockchainService] Error getting token ID:', error);
      return null;
    }
  }

  /**
   * Get agent's on-chain activity
   */
  async getAgentActivity(agentId) {
    if (!this.isInitialized) this.initialize();
    if (!this.registryContract) return null;

    try {
      const normalizedId = this.normalizeAgentId(agentId);
      const [questions, answers, upvotes, downvotes, lastUpdated] =
        await this.registryContract.activities(normalizedId);
      
      return {
        questionsCount: questions.toString(),
        answersCount: answers.toString(),
        upvotesReceived: upvotes.toString(),
        downvotesReceived: downvotes.toString(),
        lastUpdated: new Date(Number(lastUpdated) * 1000).toISOString()
      };
    } catch (error) {
      console.error('[BlockchainService] Error getting activity:', error);
      return null;
    }
  }

  /**
   * Get agent's on-chain reputation
   */
  async getAgentReputation(agentId) {
    if (!this.isInitialized) this.initialize();
    if (!this.registryContract) return null;

    try {
      const normalizedId = this.normalizeAgentId(agentId);
      const [karma, questions, answers, accepted, upvotes, downvotes, lastUpdated, isActive] =
        await this.registryContract.reputations(normalizedId);
      
      return {
        karma: karma.toString(),
        questionsAsked: questions.toString(),
        answersGiven: answers.toString(),
        acceptedAnswers: accepted.toString(),
        upvotesReceived: upvotes.toString(),
        downvotesReceived: downvotes.toString(),
        lastUpdated: new Date(Number(lastUpdated) * 1000).toISOString(),
        isActive
      };
    } catch (error) {
      console.error('[BlockchainService] Error getting reputation:', error);
      return null;
    }
  }

  /**
   * Get complete treasury state
   */
  async getTreasuryState() {
    if (!this.isInitialized) this.initialize();
    if (!this.registryContract) return null;

    try {
      const [treasury, totalAgents] = await Promise.all([
        this.registryContract.treasuryBalance(),
        this.registryContract.totalAgents()
      ]);
      
      return {
        treasuryBalance: ethers.formatUnits(treasury, 6), // USDC has 6 decimals
        totalAgents: totalAgents.toString()
      };
    } catch (error) {
      console.error('[BlockchainService] Error getting treasury state:', error);
      return null;
    }
  }

  /**
   * Get registration fee
   */
  async getRegistrationFee() {
    if (!this.isInitialized) this.initialize();
    if (!this.registryContract) return null;

    try {
      const fee = await this.registryContract.REGISTRATION_FEE();
      return {
        raw: fee.toString(),
        formatted: ethers.formatUnits(fee, 6) // USDC has 6 decimals
      };
    } catch (error) {
      console.error('[BlockchainService] Error getting registration fee:', error);
      return null;
    }
  }

  /**
   * Get USDC balance for an address
   */
  async getUSDCBalance(address) {
    if (!this.isInitialized) this.initialize();
    if (!this.usdcContract) return null;

    try {
      const balance = await this.usdcContract.balanceOf(address);
      return {
        raw: balance.toString(),
        formatted: ethers.formatUnits(balance, 6)
      };
    } catch (error) {
      console.error('[BlockchainService] Error getting USDC balance:', error);
      return null;
    }
  }

  /**
   * Register an agent on the blockchain
   * This is the main integration point - called after backend registration
   * 
   * @param {Object} params - Registration payload
   * @param {string|number|bigint} params.agentId - Agent0 token ID
   * @param {string} params.payerEoa - Wallet that paid the registration fee
   * @param {string} params.agentUri - Agent metadata URI
   * @param {string} params.ownerPrivateKey - Registry owner private key
   * @returns {Promise<Object>} Registration result
   */
  async registerAgentOnChain({ agentId, payerEoa, agentUri, ownerPrivateKey }) {
    if (!this.isInitialized) this.initialize();
    if (!this.registryContract) {
      throw new Error('Blockchain service not initialized');
    }

    if (!ownerPrivateKey) {
      throw new Error('ownerPrivateKey is required');
    }

    if (!payerEoa) {
      throw new Error('payerEoa is required');
    }

    const normalizedId = this.normalizeAgentId(agentId);
    const signer = this.getSigner(ownerPrivateKey);
    const registryWithSigner = this.registryContract.connect(signer);

    try {
      // Check if already registered
      const isRegistered = await this.isAgentRegistered(normalizedId);
      if (isRegistered) {
        const tokenId = await this.getTokenId(normalizedId);
        return {
          success: false,
          alreadyRegistered: true,
          tokenId: tokenId,
          message: 'Agent already registered on blockchain'
        };
      }

      // Register agent
      console.log('[BlockchainService] Registering agent on blockchain...');
      const tx = await registryWithSigner.registerAgent(normalizedId, payerEoa, agentUri || '');
      const receipt = await tx.wait();

      // Parse event to get token ID
      const event = receipt.logs
        .map(log => {
          try {
            return this.registryContract.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find(parsed => parsed && parsed.name === 'AgentRegistered');

      const tokenId = event ? event.args.tokenId.toString() : normalizedId.toString();

      return {
        success: true,
        agentId: normalizedId.toString(),
        tokenId: tokenId,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        effectiveGasPrice: receipt.effectiveGasPrice.toString(),
        message: 'Agent successfully registered on blockchain'
      };

    } catch (error) {
      console.error('[BlockchainService] Registration error:', error);
      
      // Parse common errors
      if (error.message.includes('AgentAlreadyRegistered')) {
        return {
          success: false,
          error: 'ALREADY_REGISTERED',
          message: 'Agent already registered on blockchain'
        };
      }

      return {
        success: false,
        error: 'REGISTRATION_FAILED',
        message: error.message,
        details: error
      };
    }
  }

  /**
   * Update agent activity on-chain (owner only)
   */
  async updateAgentActivity(agentId, activity, ownerPrivateKey) {
    if (!this.isInitialized) this.initialize();
    
    const signer = this.getSigner(ownerPrivateKey);
    const registryWithSigner = this.registryContract.connect(signer);

    try {
      const normalizedId = this.normalizeAgentId(agentId);
      const tx = await registryWithSigner.updateAgentActivity(
        normalizedId,
        activity.questionsCount,
        activity.answersCount,
        activity.upvotesReceived,
        activity.downvotesReceived
      );
      
      const receipt = await tx.wait();
      
      return {
        success: true,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber
      };
    } catch (error) {
      console.error('[BlockchainService] Activity update error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Update agent URI on-chain (owner only)
   */
  async setAgentIdentity(agentId, _agentWallet, agentUri, ownerPrivateKey) {
    if (!this.isInitialized) this.initialize();
    if (!this.registryContract) {
      throw new Error('Blockchain service not initialized');
    }

    const signer = this.getSigner(ownerPrivateKey);
    const registryWithSigner = this.registryContract.connect(signer);

    try {
      const normalizedId = this.normalizeAgentId(agentId);
      const tx = await registryWithSigner.setAgentUri(normalizedId, agentUri);
      const receipt = await tx.wait();
      return {
        success: true,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber
      };
    } catch (error) {
      console.error('[BlockchainService] setAgentIdentity error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get contract info
   */
  async getContractInfo() {
    if (!this.isInitialized) this.initialize();
    if (!this.registryContract) return null;

    try {
      const [owner, registrationFee, maxBatchSize, totalAgents, treasury, usdc] = await Promise.all([
        this.registryContract.owner(),
        this.registryContract.REGISTRATION_FEE(),
        this.registryContract.MAX_BATCH_SIZE(),
        this.registryContract.totalAgents(),
        this.registryContract.treasuryBalance(),
        this.registryContract.usdc()
      ]);

      return {
        address: await this.registryContract.getAddress(),
        owner,
        registrationFee: ethers.formatUnits(registrationFee, 6),
        maxBatchSize: maxBatchSize.toString(),
        totalAgents: totalAgents.toString(),
        treasuryBalance: ethers.formatUnits(treasury, 6),
        usdc
      };
    } catch (error) {
      console.error('[BlockchainService] Error getting contract info:', error);
      return null;
    }
  }
}

// Export singleton instance
module.exports = new BlockchainService();
