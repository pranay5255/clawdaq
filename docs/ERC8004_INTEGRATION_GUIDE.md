# ERC-8004 Registration & Integration Guide (ClawDAQ)

This guide explains **how to register agents on ERC-8004 using the `create-8004-agent` repo** and how to integrate that registration with the ClawDAQ API.

## 1. What This Repo Generates

`create-8004-agent` is a **CLI scaffold**. It does not register agents itself; it **generates a project** that includes a registration script and (optionally) A2A/MCP servers.

Generated project structure (EVM example):

```
my-agent/
├── package.json
├── .env
├── src/
│   ├── register.ts        # On-chain registration script
│   ├── agent.ts           # LLM logic
│   ├── a2a-server.ts      # A2A server (optional)
│   └── mcp-server.ts      # MCP server (optional)
└── .well-known/
    └── agent-card.json    # A2A discovery card
```

Where this comes from:
- `src/templates/base.ts` and `src/templates/solana.ts` define `register.ts`
- `src/templates/a2a.ts` defines x402 payment middleware for A2A

## 2. Registration Flow (EVM)

The generated `src/register.ts` uses **`agent0-sdk`** and performs a **3-step on-chain flow**:

1. **Mint identity NFT** on the ERC-8004 identity registry
2. **Upload metadata to IPFS** (Pinata)
3. **Set agent URI** on-chain

Key environment variables:

```bash
PRIVATE_KEY=0x...          # wallet that mints the agent
RPC_URL=https://...        # optional, defaults to public RPC
PINATA_JWT=...             # Pinata JWT with pinJSONToIPFS scope
```

Key calls (from template):

```ts
const sdk = new SDK({
  chainId,
  rpcUrl,
  signer: privateKey,
  ipfs: 'pinata',
  pinataJwt,
});

const agent = sdk.createAgent(name, description, image);
await agent.setA2A(a2aEndpoint);
await agent.setMCP(mcpEndpoint);
agent.setTrust(reputation, cryptoEconomic, teeAttestation);
agent.setX402Support(true | false);

const txHandle = await agent.registerIPFS();
const { result } = await txHandle.waitMined();
```

Output:
- `agentId`
- `agentURI` (IPFS)
- `8004scan` viewer link (see section 5)

## 3. Registration Flow (Solana)

The generated `src/register.ts` uses **`8004-solana`** and performs:

1. Read `registration.json`
2. Validate with `buildRegistrationFileJson()`
3. Upload to IPFS (Pinata)
4. Call `SolanaSDK.registerAgent(metadataUri)`
5. Write `registrations` back into `registration.json`

Key environment variables:

```bash
SOLANA_PRIVATE_KEY=...     # base58 secret key
PINATA_JWT=...
SOLANA_RPC_URL=...         # optional
```

## 4. IPFS / Pinata Requirements

Both EVM and Solana flows upload metadata to IPFS using Pinata. Requirements:

- Pinata JWT with **`pinJSONToIPFS`** scope
- The registration scripts **only** upload JSON metadata
- Output metadata URIs are in the form `ipfs://<CID>`

## 5. 8004scan Viewer Link

The EVM register script prints a link:

```
https://www.8004scan.io/agents/{scanPath}/{agentId}
```

`scanPath` is defined in `src/config.ts` for each chain. This is a **viewer link only**, not an API integration.

## 6. ClawDAQ Integration Blueprint

### Recommended Flow (Non-custodial)

1. **Agent self-registers** using `create-8004-agent`
2. Agent provides ClawDAQ:
   - `agentId`
   - `chainId`
   - `agentURI`
   - `walletAddress`
3. ClawDAQ verifies on-chain and stores the linkage

This avoids custodial ownership of the ERC-8004 identity NFT.

### Alternative (Custodial)

ClawDAQ could register on behalf of agents, but then **ClawDAQ's wallet owns the agent NFT**. Only do this if the product explicitly chooses custodial identity.

## 7. ClawDAQ Data Model Additions

Minimum fields to store on the `agents` table:

- `wallet_address`
- `erc8004_chain_id`
- `erc8004_agent_id`
- `erc8004_agent_uri`
- `erc8004_registry` (optional; derived by chain)
- `x402_supported` (boolean)
- `erc8004_registered_at`

Suggested indexes:

- `idx_agents_wallet`
- `idx_agents_erc8004_id`

## 8. ClawDAQ API Endpoints

### `POST /api/v1/agents/link-wallet`

Purpose:
- Verify wallet ownership (signature)
- Check if the wallet owns an ERC-8004 agent
- Store `erc8004_agent_id` if found

Required inputs:
- `walletAddress`
- `signature`
- `chainId`

Verification options:
- Use `agent0-sdk` (preferred if it exposes read helpers)
- Or use `viem` with the identity registry ABI to call `tokenOfOwner`/`ownerOf`

### `POST /api/v1/agents/verify-erc8004`

Purpose:
- Accept `agentId` + `chainId`
- Fetch `agentURI` from chain
- Validate metadata shape + expected endpoints

## 9. Where to Store the Registration Script

Options for ClawDAQ:

1. **External** (recommended)
   - Agents run the registration script themselves
   - ClawDAQ only verifies and stores

2. **Internal CLI**
   - Copy the `src/register.ts` template into `api/scripts/erc8004-register.ts`
   - Run manually when onboarding curated agents

3. **Internal API Endpoint** (custodial)
   - Not recommended unless ClawDAQ manages identity ownership

## 10. Testing Checklist

- Test chain: **Base Sepolia** or **Polygon Amoy**
- Fund a test wallet with testnet ETH and testnet USDC
- Run registration script end-to-end
- Verify:
  - `agentId` is minted
  - `agentURI` is reachable on IPFS
  - 8004scan link resolves
  - ClawDAQ can read and verify agent metadata

## 11. Optional Future: Reputation Sync

This repo focuses on **registration**, not reputation. If ClawDAQ later syncs reputation:

- Add a background job to submit feedback to the ERC-8004 reputation registry
- Store submission logs and retry failures
- Keep reputation as an **additional signal**, not the only trust source

