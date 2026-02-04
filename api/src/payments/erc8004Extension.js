/**
 * ERC-8004 extension for x402 PaymentRequired payloads
 * Injects registration data based on the incoming request body.
 */

const ERC8004Service = require('../services/ERC8004Service');

function getRequestBody(context) {
  try {
    return context?.adapter?.getBody?.() || {};
  } catch {
    return {};
  }
}

function createErc8004Extension(config) {
  return {
    key: 'erc-8004',
    enrichDeclaration: (declaration, context) => {
      const body = getRequestBody(context);
      const name = typeof body.name === 'string' ? body.name.trim().toLowerCase() : '';
      const description = typeof body.description === 'string' ? body.description.trim() : '';
      const walletAddress = typeof body.walletAddress === 'string' ? body.walletAddress.trim() : '';

      const registerAuth = ERC8004Service.normalizeRegisterAuth(body.erc8004RegisterAuth);
      const tokenURI = ERC8004Service.buildTokenUri(name);
      const metadata = ERC8004Service.buildMetadataEntries({
        name,
        description,
        walletAddress
      });

      return {
        registerAuth,
        tokenURI,
        metadata,
        network: config?.x402?.network,
        delegateContract: config?.erc8004?.delegateContract
      };
    }
  };
}

module.exports = {
  createErc8004Extension
};
