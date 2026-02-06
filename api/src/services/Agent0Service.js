/**
 * Agent0 Service
 * Wraps Agent0 SDK for identity registration and retrieval.
 */

const config = require('../config');

class Agent0Service {
  constructor() {
    this.sdk = null;
    this.initialized = false;
  }

  initialize() {
    if (this.initialized) return;

    const { chainId, rpcUrl, identityContract, ipfsProvider, pinataJwt, filecoinToken, subgraphUrl } = config.agent0 || {};
    const privateKey = config.blockchain?.custodialPrivateKey;

    if (!chainId || !rpcUrl || !identityContract || !privateKey) {
      throw new Error('Agent0 configuration is incomplete (AGENT0_CHAIN_ID, AGENT0_RPC_URL, AGENT0_IDENTITY_CONTRACT, CUSTODIAL_PRIVATE_KEY)');
    }

    let SDK;
    try {
      ({ SDK } = require('agent0-sdk'));
    } catch (error) {
      throw new Error('Agent0 SDK not installed. Add the agent0-sdk dependency to the API project.');
    }

    this.sdk = new SDK({
      chainId,
      rpcUrl,
      privateKey,
      identityContract,
      ipfs: {
        provider: ipfsProvider,
        pinataJwt,
        filecoinToken
      },
      subgraphUrl
    });

    this.initialized = true;
  }

  ensureInitialized() {
    if (!this.initialized) this.initialize();
  }

  async registerAgent({
    name,
    description = '',
    image = null,
    walletAddress,
    mcpEndpoint,
    a2aEndpoint,
    skills = [],
    domains = [],
    trustModels = [],
    metadata = {}
  }) {
    this.ensureInitialized();

    if (!name) {
      throw new Error('Agent name is required');
    }

    let agent = null;
    if (typeof this.sdk.createAgent === 'function') {
      agent = this.sdk.createAgent.length <= 1
        ? this.sdk.createAgent({ name, description, image })
        : this.sdk.createAgent(name, description, image);
    }

    if (!agent) {
      throw new Error('Agent0 SDK did not return an agent instance');
    }

    if (walletAddress) {
      if (typeof agent.setAgentWallet === 'function') {
        agent.setAgentWallet(walletAddress);
      } else if (typeof agent.setWallet === 'function') {
        agent.setWallet(walletAddress);
      } else {
        agent.walletAddress = walletAddress;
      }
    }

    if (mcpEndpoint && typeof agent.setMCP === 'function') {
      agent.setMCP(mcpEndpoint);
    }

    if (a2aEndpoint && typeof agent.setA2A === 'function') {
      agent.setA2A(a2aEndpoint);
    }

    if (Array.isArray(skills) && typeof agent.addSkill === 'function') {
      skills.forEach((skill) => agent.addSkill(skill));
    }

    if (Array.isArray(domains) && typeof agent.addDomain === 'function') {
      domains.forEach((domain) => agent.addDomain(domain));
    }

    if (Array.isArray(trustModels) && typeof agent.setTrust === 'function') {
      trustModels.forEach((model) => agent.setTrust(model));
    }

    if (metadata && typeof agent.setMetadata === 'function') {
      agent.setMetadata(metadata);
    }

    if (typeof agent.registerIPFS !== 'function') {
      throw new Error('Agent0 SDK does not expose registerIPFS()');
    }

    const registration = await agent.registerIPFS();

    return {
      agentId: registration?.agentId || registration?.tokenId || agent.agentId || null,
      agentUri: registration?.agentUri || registration?.agentURI || agent.agentUri || agent.agentURI || null,
      metadata
    };
  }

  async getAgent(agentId) {
    this.ensureInitialized();
    if (!agentId || typeof this.sdk.getAgent !== 'function') return null;
    return this.sdk.getAgent(agentId);
  }
}

module.exports = new Agent0Service();
