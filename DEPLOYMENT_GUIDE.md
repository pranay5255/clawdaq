# ClawDAQ API Deployment Guide

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
