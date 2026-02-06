/**
 * Transaction Verification Service
 * Verifies on-chain registration transactions.
 */

const { ethers } = require('ethers');
const config = require('../config');

const REGISTRY_ABI = [
  'event AgentRegistered(uint256 indexed tokenId, string agentId, address indexed owner, uint256 registrationFee)',
  'event AgentRegistered(uint256 indexed tokenId, string agentId, address indexed owner, address indexed payer, uint256 registrationFee)'
];

class TxVerificationService {
  constructor() {
    this.provider = null;
    this.interface = new ethers.Interface(REGISTRY_ABI);
    this.isInitialized = false;
  }

  initialize() {
    if (this.isInitialized) return;

    const rpcUrl = config.blockchain?.rpcUrl || 'https://sepolia.base.org';
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.isInitialized = true;
  }

  normalizeAddress(address) {
    if (!address) return null;
    return address.toLowerCase();
  }

  normalizeAgentId(agentId) {
    return String(agentId || '').trim().toLowerCase();
  }

  async verifyRegistrationTx({ txHash, expectedAgentId, expectedOwner, expectedPayer }) {
    if (!txHash) {
      throw new Error('txHash is required');
    }

    if (!this.isInitialized) this.initialize();

    const receipt = await this.provider.getTransactionReceipt(txHash);
    if (!receipt) {
      throw new Error('Transaction not found');
    }

    if (receipt.status !== 1 && receipt.status !== 1n) {
      throw new Error('Transaction failed');
    }

    const registryAddress = this.normalizeAddress(config.blockchain?.registryAddress);
    const receiptTo = this.normalizeAddress(receipt.to);

    if (registryAddress && receiptTo && registryAddress !== receiptTo) {
      throw new Error('Transaction is not targeting the registry contract');
    }

    const parsedEvents = receipt.logs
      .map((log) => {
        try {
          return this.interface.parseLog(log);
        } catch (error) {
          return null;
        }
      })
      .filter(Boolean);

    const event = parsedEvents.find((entry) => entry.name === 'AgentRegistered');

    if (!event) {
      throw new Error('AgentRegistered event not found');
    }

    const tokenId = event.args.tokenId?.toString();
    const agentId = event.args.agentId;
    const owner = event.args.owner;
    const payer = event.args.payer || receipt.from;

    const expectedAgent = this.normalizeAgentId(expectedAgentId);
    if (expectedAgent && this.normalizeAgentId(agentId) !== expectedAgent) {
      throw new Error('Agent ID does not match transaction');
    }

    if (expectedOwner && this.normalizeAddress(owner) !== this.normalizeAddress(expectedOwner)) {
      throw new Error('Owner address does not match transaction');
    }

    if (expectedPayer && this.normalizeAddress(payer) !== this.normalizeAddress(expectedPayer)) {
      throw new Error('Payer address does not match transaction');
    }

    return {
      tokenId,
      agentId,
      owner,
      payer,
      registrationFee: event.args.registrationFee?.toString(),
      blockNumber: receipt.blockNumber,
      txHash: receipt.hash
    };
  }
}

module.exports = new TxVerificationService();
