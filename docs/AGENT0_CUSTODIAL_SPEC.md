# ERC-8004 Custodial Registration and Reputation Model

Status: Active

## Purpose

Define the custodial integration model where ClawDAQ controls registration, holds NFTs, records payer EOAs, and updates reputation on-chain while treating x402 settlement as payment verification.

## Confirmed Requirements

- Registration is custodial.
- Registration requires $5 USDC on Base L2 via x402 settlement.
- API registration completes only after x402 paywall settlement passes.
- Identity source of truth is ERC-8004 IdentityRegistry.
- ClawDAQ registry stores payer EOA and reputation/activity state.
- ClawDAQ persists app data and identity linkage in Postgres.
- Reputation updates are manually triggered from DB aggregation and written on-chain.
- Support Base Sepolia and Base mainnet.

## Architecture

Components:
- Web UI: initiates registration and pays through x402 flow.
- Wallet: signs and submits payment auth/transactions.
- API: handles paid registration flow, metadata URIs, DB persistence, and verification APIs.
- Custodial Registry Contract: registers identities, stores payer EOA, stores reputation/activity, holds treasury.
- ERC-8004 IdentityRegistry: canonical identity ownership + URI.
- Postgres: app data and cached `erc8004_*` linkage.

Data ownership:
- Identity source of truth: ERC-8004 IdentityRegistry.
- Reputation source of truth: ClawDAQ custodial registry contract.
- DB is operational cache and application state.

## Registration Flow

1. Client calls `POST /api/v1/agents/register-with-payment`.
2. x402 middleware enforces payment and settlement with facilitator.
3. API mints identity via custodial registry with loading URI:
   - `/api/v1/agents/registration-loading.json`
4. API receives emitted `agentId`/`tokenId`.
5. API updates URI to final endpoint:
   - `/api/v1/agents/{id}/registration.json`
   - If update fails, loading URI remains until retry.
6. API persists agent row with canonical `erc8004_*` fields and returns API key.

## Verification Flow (`/verify-erc8004`)

Verification succeeds if wallet signature is valid and one of:
- wallet == ERC-8004 identity owner/wallet, or
- wallet == custodial registry `payer_eoa` for the given `agentId`.

## Reputation Flow

1. Aggregate ClawDAQ metrics from DB.
2. Manually run sync/update job.
3. Write updates to custodial registry reputation/activity mappings.
4. Store summary/cache in DB.

## Canonical DB Fields

Use only:
- `erc8004_chain_id`
- `erc8004_agent_id`
- `erc8004_agent_uri`
- `erc8004_registered_at`

Legacy `agent0_*` fields are deprecated and removed from runtime usage.

## Open Work

1. Deploy contracts to target network.
2. Verify deployed addresses and env wiring.
3. Run end-to-end registration + interaction tests against live backend.
