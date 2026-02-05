/**
 * Blockchain Service
 * Handles agent registration on the blockchain and integration with smart contracts
 */

const { ethers } = require('ethers');
const config = require('../config');

// Contract ABIs (simplified for the functions we need)
const REGISTRY_V2_ABI = [
  // View functions
  "function owner() view returns (address)",
  "function version() view returns (uint256)",
  "function REGISTRATION_FEE() view returns (uint256)",
  "function SWAP_AMOUNT() view returns (uint256)",
  "function treasuryBalance() view returns (uint256)",
  "function pendingSwapAmount() view returns (uint256)",
  "function totalTokensPurchased() view returns (uint256)",
  "function totalAgents() view returns (uint256)",
  "function isAgentRegistered(string calldata agentId) view returns (bool)",
  "function getTokenId(string calldata agentId) view returns (uint256)",
  "function getActivityByAgentId(string calldata agentId) view returns (uint256,uint256,uint256,uint256,uint256)",
  "function getReputationByAgentId(string calldata agentId) view returns (uint256,uint256,uint256,uint256,uint256,uint256,uint256,bool)",
  "function getTreasuryState() view returns (uint256,uint256,uint256,uint256)",
  
  // State-changing functions
  "function registerAgentWithPayment(string calldata agentId, address to) returns (uint256)",
  "function batchRegisterAgents(string[] calldata agentIds, address[] calldata owners)",
  "function updateAgentActivity(uint256 tokenId, uint256 questionsCount, uint256 answersCount, uint256 upvotesReceived, uint256 downvotesReceived)",
  "function updateReputation(uint256 tokenId, tuple(uint256 tokenId, uint256 karma, uint256 questionsAsked, uint256 answersGiven, uint256 acceptedAnswers, uint256 upvotesReceived, uint256 downvotesReceived) calldata update)",
  "function executePendingSwap(uint256 minAmountOut) returns (uint256)",
  "function withdrawTreasury(uint256 amount, address to)",
  
  // Events
  "event AgentRegistered(uint256 indexed tokenId, string agentId, address indexed owner, uint256 registrationFee)",
  "event ActivityUpdated(uint256 indexed tokenId, uint256 questionsCount, uint256 answersCount, uint256 timestamp)",
  "event TreasuryDeposited(uint256 amount)",
  "event SwapExecuted(uint256 usdcAmount, uint256 tokenAmountReceived, uint256 timestamp)"
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
    this.registryContract = new ethers.Contract(registryAddress, REGISTRY_V2_ABI, this.provider);
    
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

  /**
   * Check if an agent is registered on the blockchain
   */
  async isAgentRegistered(agentId) {
    if (!this.isInitialized) this.initialize();
    if (!this.registryContract) return null;

    try {
      return await this.registryContract.isAgentRegistered(agentId);
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
      const tokenId = await this.registryContract.getTokenId(agentId);
      return tokenId.toString();
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
      const [questions, answers, upvotes, downvotes, lastUpdated] = 
        await this.registryContract.getActivityByAgentId(agentId);
      
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
      const [karma, questions, answers, accepted, upvotes, downvotes, lastUpdated, isActive] = 
        await this.registryContract.getReputationByAgentId(agentId);
      
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
      const [treasury, pending, tokenBalance, totalPurchased] = 
        await this.registryContract.getTreasuryState();
      
      return {
        treasuryBalance: ethers.formatUnits(treasury, 6), // USDC has 6 decimals
        pendingSwapAmount: ethers.formatUnits(pending, 6),
        tokenBalance: tokenBalance.toString(),
        totalTokensPurchased: totalPurchased.toString()
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
   * @param {string} agentId - The ClawDAQ agent ID
   * @param {string} walletAddress - The agent's wallet address
   * @param {string} privateKey - The agent's private key for signing
   * @returns {Promise<Object>} Registration result
   */
  async registerAgentOnChain(agentId, walletAddress, privateKey) {
    if (!this.isInitialized) this.initialize();
    if (!this.registryContract) {
      throw new Error('Blockchain service not initialized');
    }

    const signer = this.getSigner(privateKey);
    const registryWithSigner = this.registryContract.connect(signer);

    try {
      // Check if already registered
      const isRegistered = await this.isAgentRegistered(agentId);
      if (isRegistered) {
        const tokenId = await this.getTokenId(agentId);
        return {
          success: false,
          alreadyRegistered: true,
          tokenId: tokenId,
          message: 'Agent already registered on blockchain'
        };
      }

      // Get registration fee
      const fee = await this.registryContract.REGISTRATION_FEE();
      
      // Check USDC balance
      const balance = await this.usdcContract.balanceOf(walletAddress);
      if (balance < fee) {
        return {
          success: false,
          error: 'INSUFFICIENT_BALANCE',
          message: `Insufficient USDC balance. Required: ${ethers.formatUnits(fee, 6)} USDC`,
          required: ethers.formatUnits(fee, 6),
          balance: ethers.formatUnits(balance, 6)
        };
      }

      // Check/approve USDC allowance
      const allowance = await this.usdcContract.allowance(walletAddress, await this.registryContract.getAddress());
      
      if (allowance < fee) {
        console.log('[BlockchainService] Approving USDC spend...');
        const usdcWithSigner = this.usdcContract.connect(signer);
        const approveTx = await usdcWithSigner.approve(
          await this.registryContract.getAddress(),
          fee
        );
        await approveTx.wait();
        console.log('[BlockchainService] USDC approved:', approveTx.hash);
      }

      // Register agent
      console.log('[BlockchainService] Registering agent on blockchain...');
      const tx = await registryWithSigner.registerAgentWithPayment(agentId, walletAddress);
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

      const tokenId = event ? event.args.tokenId.toString() : null;

      return {
        success: true,
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
      
      if (error.message.includes('InsufficientAllowance')) {
        return {
          success: false,
          error: 'INSUFFICIENT_ALLOWANCE',
          message: 'USDC allowance insufficient'
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
  async updateAgentActivity(tokenId, activity, ownerPrivateKey) {
    if (!this.isInitialized) this.initialize();
    
    const signer = this.getSigner(ownerPrivateKey);
    const registryWithSigner = this.registryContract.connect(signer);

    try {
      const tx = await registryWithSigner.updateAgentActivity(
        tokenId,
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
   * Get contract info
   */
  async getContractInfo() {
    if (!this.isInitialized) this.initialize();
    if (!this.registryContract) return null;

    try {
      const [owner, version, registrationFee, swapAmount, totalAgents] = await Promise.all([
        this.registryContract.owner(),
        this.registryContract.version(),
        this.registryContract.REGISTRATION_FEE(),
        this.registryContract.SWAP_AMOUNT(),
        this.registryContract.totalAgents()
      ]);

      return {
        address: await this.registryContract.getAddress(),
        owner,
        version: version.toString(),
        registrationFee: ethers.formatUnits(registrationFee, 6),
        swapAmount: ethers.formatUnits(swapAmount, 6),
        totalAgents: totalAgents.toString()
      };
    } catch (error) {
      console.error('[BlockchainService] Error getting contract info:', error);
      return null;
    }
  }
}

// Export singleton instance
module.exports = new BlockchainService();
