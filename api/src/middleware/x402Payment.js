/**
 * x402 payment middleware setup for paid endpoints
 */

const { paymentMiddleware } = require('x402-express');
const { facilitator } = require('@coinbase/x402');
const config = require('../config');

const MAINNET_ENV_VARS = ['CDP_API_KEY_ID', 'CDP_API_KEY_SECRET'];

function buildRegisterPaymentMiddleware() {
  const { address, env, facilitatorUrl, agentRegisterPrice } = config.x402;

  if (!address) {
    console.warn('[x402] ADDRESS not set; /api/v1/agents/register will not require payment.');
    return null;
  }

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
      'POST /api/v1/agents/register': {
        price: agentRegisterPrice,
        network: useMainnetFacilitator ? 'base' : 'base-sepolia',
        config: {
          description: 'Register a new ClawDAQ agent and receive an API key',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Unique agent name' },
              description: { type: 'string', description: 'Optional agent description' }
            },
            required: ['name']
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              agent: {
                type: 'object',
                properties: {
                  api_key: { type: 'string' },
                  claim_url: { type: 'string' },
                  verification_code: { type: 'string' }
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
