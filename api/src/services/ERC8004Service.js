/**
 * ERC-8004 Service
 * Handles on-chain verification for ERC-8004 agent identities.
 */

const { ethers } = require('ethers');
const config = require('../config');

const ERC8004_ABI = [
  // ERC-721 standard
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',

  // ERC-8004 extensions (optional)
  'function getAgentWallet(uint256 agentId) view returns (address)',
  'function agentURI(uint256 agentId) view returns (string)',
  'function getMetadata(uint256 agentId) view returns (bytes)'
];

class ERC8004Service {
  constructor() {
    this.provider = null;
    this.registryContract = null;
    this.isInitialized = false;
  }

  initialize() {
    if (this.isInitialized) return;

    const registryAddress = config.erc8004?.registryAddress || process.env.ERC8004_REGISTRY_ADDRESS;

    if (!registryAddress) {
      console.warn('[ERC8004Service] ERC8004_REGISTRY_ADDRESS not set; ERC-8004 verification disabled.');
      return;
    }

    const rpcUrl = config.erc8004?.rpcUrl || process.env.ERC8004_RPC_URL || 'https://sepolia.base.org';
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.registryContract = new ethers.Contract(registryAddress, ERC8004_ABI, this.provider);
    this.isInitialized = true;
    console.log('[ERC8004Service] Initialized with registry:', registryAddress);
  }

  normalizeAgentId(agentId) {
    if (agentId === null || agentId === undefined) {
      throw new Error('agentId is required');
    }
    if (typeof agentId === 'bigint') return agentId;

    const raw = typeof agentId === 'number' ? agentId.toString() : String(agentId).trim();
    if (!raw) throw new Error('agentId is required');

    try {
      return BigInt(raw);
    } catch (error) {
      throw new Error('agentId must be a valid uint256 value');
    }
  }

  async resolveAgentWallet(agentId) {
    if (!this.isInitialized) this.initialize();
    if (!this.registryContract) return null;

    const normalizedId = this.normalizeAgentId(agentId);

    // Try ERC-8004 agent wallet (if implemented)
    try {
      const wallet = await this.registryContract.getAgentWallet(normalizedId);
      if (wallet && wallet !== ethers.ZeroAddress) {
        return wallet;
      }
    } catch (error) {
      // ignore if contract doesn't implement getAgentWallet
    }

    // Fallback to ERC-721 owner
    try {
      return await this.registryContract.ownerOf(normalizedId);
    } catch (error) {
      return null;
    }
  }

  async getAgentUri(agentId) {
    if (!this.isInitialized) this.initialize();
    if (!this.registryContract) return null;

    const normalizedId = this.normalizeAgentId(agentId);

    // Try ERC-8004 agentURI
    try {
      if (typeof this.registryContract.agentURI === 'function') {
        const uri = await this.registryContract.agentURI(normalizedId);
        if (uri) return uri;
      }
    } catch (error) {
      // ignore if not implemented
    }

    // Fallback to tokenURI
    try {
      if (typeof this.registryContract.tokenURI === 'function') {
        const uri = await this.registryContract.tokenURI(normalizedId);
        if (uri) return uri;
      }
    } catch (error) {
      // ignore if not implemented
    }

    return null;
  }
}

module.exports = new ERC8004Service();
