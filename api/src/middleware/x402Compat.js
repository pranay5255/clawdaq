/**
 * x402 compatibility shim (v1 <-> v2 header bridging)
 *
 * Goals:
 * - Allow x402 v2 clients (PAYMENT-SIGNATURE / PAYMENT-REQUIRED / PAYMENT-RESPONSE)
 *   to interoperate with v1-oriented middleware (X-PAYMENT / X-PAYMENT-RESPONSE).
 *
 * Notes:
 * - This shim does NOT validate payments. It only maps headers so the upstream
 *   x402 middleware and clients can understand each other.
 */

function x402CompatShim() {
  return (req, res, next) => {
    // v2 -> v1 request header mapping
    const paymentSignature = req.get('PAYMENT-SIGNATURE');
    if (!req.get('X-PAYMENT') && paymentSignature) {
      // Express does not provide a supported "setter" for request headers.
      // Mutating is the practical approach for middleware interop.
      req.headers['x-payment'] = paymentSignature;
    }

    // v1 -> v2 response header mapping
    const originalSetHeader = res.setHeader.bind(res);
    res.setHeader = (name, value) => {
      const result = originalSetHeader(name, value);
      if (String(name).toLowerCase() === 'x-payment-response') {
        originalSetHeader('PAYMENT-RESPONSE', value);
      }
      return result;
    };

    // v1 body -> v2 header mapping for 402 "accepts" challenges
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      try {
        if (
          res.statusCode === 402
          && body
          && typeof body === 'object'
          && Array.isArray(body.accepts)
          && body.accepts.length > 0
          && !res.getHeader('PAYMENT-REQUIRED')
        ) {
          // v2 clients parse payment requirements from PAYMENT-REQUIRED header.
          // For v1 middleware, requirements live in the JSON body as `accepts`.
          originalSetHeader('PAYMENT-REQUIRED', JSON.stringify(body.accepts));
        }
      } catch {
        // Ignore header compatibility errors.
      }

      return originalJson(body);
    };

    next();
  };
}

module.exports = {
  x402CompatShim
};

