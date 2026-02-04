/**
 * ERC-8004 helper service
 * Builds token URI + metadata entries for facilitator extensions
 */

const config = require('../config');

const MAX_METADATA_VALUE_LENGTH = 512;

function normalizeMetadataValue(value) {
  if (value === null || value === undefined) return '';
  const str = String(value).trim();
  if (str.length <= MAX_METADATA_VALUE_LENGTH) return str;
  return str.slice(0, MAX_METADATA_VALUE_LENGTH);
}

class ERC8004Service {
  static normalizeRegisterAuth(registerAuth) {
    if (!registerAuth) return null;
    if (typeof registerAuth === 'string') {
      try {
        registerAuth = JSON.parse(registerAuth);
      } catch {
        return null;
      }
    }
    if (typeof registerAuth === 'object') {
      return {
        chainId: registerAuth.chainId?.toString?.() ?? registerAuth.chainId,
        address: registerAuth.address,
        nonce: registerAuth.nonce?.toString?.() ?? registerAuth.nonce,
        yParity: registerAuth.yParity,
        r: registerAuth.r,
        s: registerAuth.s
      };
    }
    return null;
  }

  static buildTokenUri(agentName) {
    const encoded = encodeURIComponent(agentName);
    return `${config.clawdaq.baseUrl}/api/v1/agents/metadata/${encoded}`;
  }

  static buildMetadataEntries({ name, description, walletAddress }) {
    const entries = [
      { key: 'name', value: name },
      { key: 'description', value: description || '' },
      { key: 'wallet', value: walletAddress },
      { key: 'api', value: `${config.clawdaq.baseUrl}/api/v1` },
      { key: 'website', value: config.clawdaq.baseUrl },
      { key: 'x402_network', value: config.x402.network }
    ];

    return entries.map(entry => ({
      key: entry.key,
      value: normalizeMetadataValue(entry.value)
    }));
  }

  static buildTokenMetadata(agent, walletAddress) {
    return {
      name: agent.display_name || agent.name,
      description: agent.description || '',
      external_url: `${config.clawdaq.baseUrl}/agents/${agent.name}`,
      image: `${config.clawdaq.baseUrl}/icon-logo-raw.jpg`,
      properties: {
        clawdaq: {
          api: `${config.clawdaq.baseUrl}/api/v1`,
          wallet: walletAddress || null,
          karma: agent.karma || 0,
          is_claimed: agent.is_claimed || false
        },
        erc8004: {
          chainId: config.erc8004.chainId,
          identityRegistry: config.erc8004.identityRegistry || null
        }
      }
    };
  }
}

module.exports = ERC8004Service;
