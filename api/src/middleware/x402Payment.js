/**
 * x402 payment middleware setup for paid endpoints
 */

const config = require('../config');

const MAINNET_ENV_VARS = ['CDP_API_KEY_ID', 'CDP_API_KEY_SECRET'];

function buildRegisterPaymentMiddleware() {
  const { address, env, facilitatorUrl, agentRegisterPrice } = config.x402;
  const registrationEnabled = process.env.X402_REGISTER_REQUIRED === 'true';

  if (!address) {
    console.warn('[x402] ADDRESS not set; x402 payment middleware disabled.');
    return null;
  }

  if (!registrationEnabled) {
    console.warn('[x402] X402_REGISTER_REQUIRED is not true; registration is not paywalled by x402.');
    return null;
  }

  // Lazy-load heavy x402 packages only when payment is actually enabled
  const { paymentMiddleware } = require('x402-express');
  const { facilitator } = require('@coinbase/x402');

  const useMainnetFacilitator = env === 'mainnet';

  if (useMainnetFacilitator) {
    const missing = MAINNET_ENV_VARS.filter((key) => !process.env[key]);
    if (missing.length > 0) {
      throw new Error(`X402_ENV=mainnet requires ${missing.join(', ')}`);
    }
  }

  const facilitatorConfig = useMainnetFacilitator
    ? facilitator
    : { url: facilitatorUrl };

  console.info('[x402] payment config', {
    payTo: `${address.slice(0, 6)}...${address.slice(-4)}`,
    network: useMainnetFacilitator ? 'base' : 'base-sepolia',
    facilitator: useMainnetFacilitator ? 'coinbase-hosted' : facilitatorUrl
  });

  return paymentMiddleware(
    address,
    {
      'POST /api/v1/agents/register-with-payment': {
        price: agentRegisterPrice,
        network: useMainnetFacilitator ? 'base' : 'base-sepolia',
        config: {
          description: 'Register a new ClawDAQ agent and receive an API key',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Unique agent name' },
              description: { type: 'string', description: 'Optional agent description' },
              payerEoa: { type: 'string', description: 'Wallet that paid the registration fee' },
              walletAddress: { type: 'string', description: 'Alias for payerEoa' },
              agentId: { type: 'string', description: 'Existing Agent0 token ID (optional)' },
              agentUri: { type: 'string', description: 'Existing Agent0 metadata URI (optional)' },
              txHash: { type: 'string', description: 'Payment transaction hash (optional)' }
            },
            required: ['name', 'payerEoa']
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              agent: {
                type: 'object',
                properties: {
                  api_key: { type: 'string' }
                }
              },
              important: { type: 'string' }
            }
          },
          maxTimeoutSeconds: 30
        }
      }
    },
    facilitatorConfig
  );
}

module.exports = {
  buildRegisterPaymentMiddleware
};
