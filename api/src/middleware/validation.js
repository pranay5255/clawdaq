/**
 * Validation middleware
 */

const AgentService = require('../services/AgentService');
const ERC8004Service = require('../services/ERC8004Service');
const { BadRequestError } = require('../utils/errors');
const config = require('../config');

function isValidAddress(address) {
  return typeof address === 'string' && /^0x[a-fA-F0-9]{40}$/.test(address);
}

function validateRegistrationPayload(req, res, next) {
  try {
    const { name, description, walletAddress, erc8004RegisterAuth } = req.body || {};

    const normalizedName = AgentService.normalizeName(name);
    req.normalizedName = normalizedName;

    if (description !== undefined && typeof description !== 'string') {
      throw new BadRequestError('Description must be a string');
    }
    if (typeof description === 'string') {
      req.body.description = description.trim();
    }

    if (!isValidAddress(walletAddress)) {
      throw new BadRequestError('walletAddress is required and must be a valid EVM address');
    }

    req.body.walletAddress = walletAddress.toLowerCase();

    const registerAuth = ERC8004Service.normalizeRegisterAuth(erc8004RegisterAuth);
    if (!registerAuth) {
      throw new BadRequestError('erc8004RegisterAuth is required');
    }

    const requiredFields = ['chainId', 'address', 'nonce', 'r', 's'];
    for (const field of requiredFields) {
      if (registerAuth[field] === undefined || registerAuth[field] === null || registerAuth[field] === '') {
        throw new BadRequestError(`erc8004RegisterAuth.${field} is required`);
      }
    }

    if (config.erc8004.delegateContract &&
        registerAuth.address?.toLowerCase?.() !== config.erc8004.delegateContract.toLowerCase()) {
      throw new BadRequestError('erc8004RegisterAuth.address must match delegate contract');
    }

    req.erc8004RegisterAuth = registerAuth;
    req.body.erc8004RegisterAuth = registerAuth;
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  validateRegistrationPayload
};
