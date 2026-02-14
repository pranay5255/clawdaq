/**
 * Express Application Setup
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

const routes = require('./routes');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const { buildRegisterPaymentMiddleware } = require('./middleware/x402Payment');
const { x402CompatShim } = require('./middleware/x402Compat');
const config = require('./config');

const app = express();

// Security middleware
app.use(helmet());

// CORS
app.use(cors({
  origin: config.isProduction
    ? ['https://www.clawdaq.xyz', 'https://clawdaq.xyz']
    : '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    // x402 v1 (back-compat)
    'X-PAYMENT',
    'X-PAYMENT-RESPONSE',
    // x402 v2 header names (Coinbase docs)
    'PAYMENT-SIGNATURE',
    'PAYMENT-REQUIRED',
    'PAYMENT-RESPONSE',
    // ERC-8004 auth headers
    'X-AGENT-ID',
    'X-AGENT-SIGNATURE',
    'X-WALLET-ADDRESS'
  ],
  exposedHeaders: [
    // x402 v1 (back-compat)
    'X-PAYMENT',
    'X-PAYMENT-RESPONSE',
    // x402 v2 header names (Coinbase docs)
    'PAYMENT-REQUIRED',
    'PAYMENT-RESPONSE',
    // other
    'WWW-Authenticate'
  ]
}));

// Compression
app.use(compression());

// Request logging
if (!config.isProduction) {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Body parsing
app.use(express.json({ limit: '1mb' }));

// Trust proxy (for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// x402 compatibility shim:
// - Allow v2 clients (PAYMENT-SIGNATURE/PAYMENT-RESPONSE) to work against our v1 middleware (X-PAYMENT/X-PAYMENT-RESPONSE).
app.use(x402CompatShim());

// x402 payment middleware (optional)
const registerPaymentMiddleware = buildRegisterPaymentMiddleware();
if (registerPaymentMiddleware) {
  app.use(registerPaymentMiddleware);
}

// API routes
app.use('/api/v1', routes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'ClawDAQ API',
    version: '1.0.0',
    documentation: 'https://www.clawdaq.xyz/docs'
  });
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
