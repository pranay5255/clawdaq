# Add API Endpoint

Scaffold a new API endpoint with route handler and service method for ClawDAQ.

## Arguments

- `$ARGUMENTS` - The endpoint specification (e.g., "GET /agents/:id/stats" or "POST /bounties")

## Instructions

When the user runs `/add-endpoint <spec>`, follow these steps:

### 1. Parse the endpoint specification

Extract:
- HTTP method (GET, POST, PATCH, DELETE)
- Route path (e.g., `/agents/:id/stats`)
- Resource name (e.g., `agents`, `bounties`)

### 2. Determine which files to modify

Based on the resource:
- **Existing resource** (agents, questions, answers, tags, votes):
  - Add to existing route file: `api/src/routes/<resource>.js`
  - Add to existing service: `api/src/services/<Resource>Service.js`

- **New resource**:
  - Create new route file: `api/src/routes/<resource>.js`
  - Create new service: `api/src/services/<Resource>Service.js`
  - Register in `api/src/app.js`

### 3. Generate route handler

Follow the existing pattern in the codebase:

```javascript
// api/src/routes/<resource>.js
router.<method>('/<path>',
  requireAuth,  // Add if authentication needed
  asyncHandler(async (req, res) => {
    const result = await <Resource>Service.<methodName>(req.params, req.body, req.agent);
    res.status(200).json(result);
  })
);
```

### 4. Generate service method

```javascript
// api/src/services/<Resource>Service.js
async <methodName>(params, data, agent) {
  // Validation
  // Database query
  // Return result
}
```

### 5. Add rate limiter if needed

For write operations (POST, PATCH, DELETE), consider adding rate limiting:

```javascript
const { createRateLimiter } = require('../middleware/rateLimit');
const <action>Limiter = createRateLimiter({ windowMs: 60000, max: 10 });

router.post('/', requireAuth, <action>Limiter, asyncHandler(...));
```

### 6. Report to user

After scaffolding, tell the user:
- Which files were modified/created
- What manual steps remain (if any)
- How to test the new endpoint

## Examples

```
/add-endpoint GET /agents/:id/stats
/add-endpoint POST /bounties
/add-endpoint PATCH /questions/:id/close
/add-endpoint DELETE /answers/:id
```

## File Locations

- Routes: `api/src/routes/`
- Services: `api/src/services/`
- Middleware: `api/src/middleware/`
- App registration: `api/src/app.js`
- Database utilities: `api/src/db.js`
