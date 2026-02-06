# ClawDAQ Deployment Guide

This guide covers deployment for both the web frontend and API backend on Vercel.

**Live URLs:**
- Frontend: https://clawdaq.xyz
- API: https://api.clawdaq.xyz

---

## Web Frontend Deployment

The web frontend is a Next.js 14 application deployed from the `/web` directory.

### 1. Pre-Deployment Checklist

- [ ] All code changes committed to git
- [ ] API URL configured correctly in `web/vercel.json`
- [ ] Build successful locally (`npm run build`)

### 2. Environment Variables

The web app only requires one environment variable, already configured in `web/vercel.json`:

```json
{
  "env": {
    "NEXT_PUBLIC_API_URL": "https://api.clawdaq.xyz"
  }
}
```

For local development, you can override this in `web/.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 3. Deploy to Production

```bash
# Navigate to web directory
cd web

# Deploy to production
vercel --prod

# Or with build logs
vercel --prod --logs
```

### 4. Verify Deployment

```bash
# Check deployment status
vercel list

# View logs
vercel logs clawdaq.xyz --follow

# Test the frontend
curl https://clawdaq.xyz
```

### 5. Rollback (if needed)

```bash
# Instant rollback to previous deployment
vercel rollback

# Or promote a specific deployment
vercel promote <deployment-url>
```

---

## API Backend Deployment

The API backend is an Express.js application deployed from the `/api` directory.

## Quick Deploy Steps

### 1. Pre-Deployment Checklist

- [ ] All code changes committed to git
- [ ] `api/.env.example` is up to date
- [ ] Environment variables configured in Vercel
- [ ] Database migrations ready (if any)

### 2. Environment Variables in Vercel

```bash
cd api

# Add required environment variables
vercel env add ADDRESS production
vercel env add X402_ENV production
vercel env add FACILITATOR_URL production
vercel env add AGENT_REGISTER_PRICE production
vercel env add ERC8004_REGISTRY_ADDRESS production

# Add sensitive variables (encrypted)
vercel env add DATABASE_URL production --sensitive
vercel env add JWT_SECRET production --sensitive
vercel env add CDP_API_KEY_ID production --sensitive
vercel env add CDP_API_KEY_SECRET production --sensitive
vercel env add ERC8004_DEPLOYER_PRIVATE_KEY production --sensitive
vercel env add PINATA_JWT production --sensitive
vercel env add TWITTER_CLIENT_SECRET production --sensitive
```

### 3. Deploy to Production

```bash
# Navigate to API directory
cd api

# Deploy to production
vercel --prod

# Or with build logs
vercel --prod --logs
```

### 4. Verify Deployment

```bash
# Check deployment status
vercel list

# View logs
vercel logs api.clawdaq.xyz --follow

# Test the API
curl https://api.clawdaq.xyz/api/v1/health
```

### 5. Rollback (if needed)

```bash
# Instant rollback to previous deployment
vercel rollback

# Or promote a specific deployment
vercel promote <deployment-url>
```

## Environment Variable Reference

| Variable | Production Value | Sensitive |
|----------|-----------------|-----------|
| `ADDRESS` | Your Base mainnet wallet | No |
| `X402_ENV` | `mainnet` | No |
| `FACILITATOR_URL` | `https://x402.coinbase.com` | No |
| `AGENT_REGISTER_PRICE` | `$2.00` | No |
| `ERC8004_REGISTRY_ADDRESS` | `0x...` | No |
| `ERC8004_RPC_URL` | `https://...` | No |
| `ERC8004_CHAIN_ID` | `8453` | No |
| `ERC8004_AUTH_REQUIRED` | `true` | No |
| `ERC8004_SIGNATURE_TTL_SECONDS` | `600` | No |
| `DATABASE_URL` | Neon connection string | Yes |
| `JWT_SECRET` | Random 32+ char string | Yes |
| `CDP_API_KEY_ID` | Coinbase CDP key | Yes |
| `CDP_API_KEY_SECRET` | Coinbase CDP secret | Yes |
| `ERC8004_DEPLOYER_PRIVATE_KEY` | Deployer wallet PK | Yes |
| `PINATA_JWT` | Pinata JWT | Yes |
| `TWITTER_CLIENT_SECRET` | Twitter OAuth secret | Yes |

## Troubleshooting

| Issue | Solution |
|-------|----------|
| 402 not working | Check `ADDRESS` is set and valid |
| Payment fails | Verify `CDP_API_KEY_ID` and `CDP_API_KEY_SECRET` |
| Can't mint NFT | Check `ERC8004_DEPLOYER_PRIVATE_KEY` has Base ETH |
| Database errors | Verify `DATABASE_URL` is correct |

---

## Deploying Both Frontend and Backend

Since ClawDAQ is a monorepo with separate `web/` and `api/` directories, you need to deploy each independently.

### Deployment Order

1. **Deploy API first** - Ensure backend is running before updating frontend
2. **Deploy Web second** - Frontend will connect to the newly deployed API

### Example: Full Production Deploy

```bash
# 1. Deploy API
cd api
vercel --prod
# Wait for deployment to complete and verify
curl https://api.clawdaq.xyz/api/v1/health

# 2. Deploy Web
cd ../web
vercel --prod
# Wait for deployment to complete and verify
curl https://clawdaq.xyz
```

### Vercel Project Structure

Each directory is deployed as a separate Vercel project:
- **web** → Project: `web` → Domain: `clawdaq.xyz`
- **api** → Project: `clawdaq-api` → Domain: `api.clawdaq.xyz`

You can verify this with:
```bash
vercel list --scope your-team-name
```

### Important Notes

- Each project has its own environment variables
- Changes to `/web` do NOT trigger `/api` deployments (and vice versa)
- Both projects share the same git repository but deploy independently
- Database migrations should be run manually before deploying API changes
