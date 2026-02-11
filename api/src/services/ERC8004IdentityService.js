/**
 * ERC-8004 Identity Service
 * Read-only utilities for the canonical IdentityRegistry + URI generation.
 */

const { ethers } = require('ethers');
const config = require('../config');

const IDENTITY_ABI = [
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function getAgentWallet(uint256 agentId) view returns (address)'
];

function resolvePublicApiBaseUrl() {
  const baseUrl = process.env.API_PUBLIC_BASE_URL
    || process.env.API_BASE_URL
    || 'https://api.clawdaq.xyz';
  return baseUrl.replace(/\/+$/, '');
}

class ERC8004IdentityService {
  constructor() {
    this.provider = null;
    this.identityRegistry = null;
    this.isInitialized = false;
    this.publicApiBaseUrl = resolvePublicApiBaseUrl();
  }

  initialize() {
    if (this.isInitialized) return;

    const identityRegistryAddress = config.erc8004?.identityRegistryAddress;
    if (!identityRegistryAddress) {
      throw new Error('ERC8004 identity registry is not configured');
    }

    const rpcUrl = config.erc8004?.rpcUrl || config.blockchain?.rpcUrl || 'https://sepolia.base.org';
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.identityRegistry = new ethers.Contract(identityRegistryAddress, IDENTITY_ABI, this.provider);
    this.isInitialized = true;
  }

  ensureInitialized() {
    if (!this.isInitialized) this.initialize();
  }

  normalizeAgentId(agentId) {
    if (agentId === null || agentId === undefined) {
      throw new Error('agentId is required');
    }
    const raw = typeof agentId === 'number' ? agentId.toString() : String(agentId).trim();
    if (!raw) throw new Error('agentId is required');
    const parsed = BigInt(raw);
    if (parsed < 0n) throw new Error('agentId must be greater than or equal to 0');
    return parsed;
  }

  /**
   * DG-1: start with a loading URI, then update to ID-based URI after registration.
   */
  generatePendingAgentUri() {
    return `${this.publicApiBaseUrl}/api/v1/agents/registration-loading.json`;
  }

  generateFinalAgentUri(agentId) {
    const normalizedId = this.normalizeAgentId(agentId);
    return `${this.publicApiBaseUrl}/api/v1/agents/${normalizedId.toString()}/registration.json`;
  }

  async getAgentWallet(agentId) {
    this.ensureInitialized();
    const normalizedId = this.normalizeAgentId(agentId);
    return this.identityRegistry.getAgentWallet(normalizedId);
  }

  async getAgent(agentId) {
    this.ensureInitialized();
    const normalizedId = this.normalizeAgentId(agentId);
    const [owner, agentWallet, uri] = await Promise.all([
      this.identityRegistry.ownerOf(normalizedId),
      this.identityRegistry.getAgentWallet(normalizedId),
      this.identityRegistry.tokenURI(normalizedId)
    ]);

    return {
      agentId: normalizedId.toString(),
      tokenId: normalizedId.toString(),
      owner,
      wallet: agentWallet,
      agentUri: uri
    };
  }
}

module.exports = new ERC8004IdentityService();
