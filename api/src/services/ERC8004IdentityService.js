/**
 * ERC-8004 Identity Service
 * Generates registration metadata URIs and payloads for custodial registration.
 */

const config = require('../config');

function trimTrailingSlash(value) {
  if (!value || typeof value !== 'string') return null;
  return value.replace(/\/+$/, '');
}

class ERC8004IdentityService {
  resolveApiBaseUrl(req) {
    const configured = trimTrailingSlash(config.clawdaq?.apiBaseUrl);
    if (configured) return configured;

    const forwardedProto = req.headers['x-forwarded-proto'];
    const forwardedHost = req.headers['x-forwarded-host'];
    const protocol = typeof forwardedProto === 'string'
      ? forwardedProto.split(',')[0].trim()
      : (req.protocol || 'https');
    const host = typeof forwardedHost === 'string'
      ? forwardedHost.split(',')[0].trim()
      : req.get('host');

    if (host) {
      return `${protocol}://${host}`;
    }

    return trimTrailingSlash(config.clawdaq?.baseUrl) || 'https://www.clawdaq.xyz';
  }

  getLoadingRegistrationUri(req) {
    return `${this.resolveApiBaseUrl(req)}/api/v1/agents/registration-loading.json`;
  }

  getFinalRegistrationUri(req, agentId) {
    return `${this.resolveApiBaseUrl(req)}/api/v1/agents/${agentId}/registration.json`;
  }

  buildLoadingRegistrationMetadata({ agentId = null } = {}) {
    return {
      version: '1.0',
      type: 'erc8004-registration',
      status: 'loading',
      agentId: agentId === null ? null : String(agentId),
      name: 'ClawDAQ Agent (registration pending)',
      description: 'Registration is in progress. Metadata will be updated when registration completes.',
      updatedAt: new Date().toISOString()
    };
  }

  buildFinalRegistrationMetadata(agent) {
    const profileBaseUrl = trimTrailingSlash(config.clawdaq?.baseUrl) || 'https://www.clawdaq.xyz';

    return {
      version: '1.0',
      type: 'erc8004-registration',
      status: 'active',
      agentId: agent.erc8004_agent_id ? String(agent.erc8004_agent_id) : null,
      name: agent.display_name || agent.name,
      description: agent.description || '',
      walletAddress: agent.wallet_address || null,
      payerEoa: agent.payer_eoa || null,
      x402Supported: Boolean(agent.x402_supported),
      links: {
        profile: `${profileBaseUrl}/agents/${encodeURIComponent(agent.name)}`
      },
      updatedAt: new Date().toISOString()
    };
  }
}

module.exports = new ERC8004IdentityService();
