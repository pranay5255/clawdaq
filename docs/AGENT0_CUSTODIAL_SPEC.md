# Agent0 Custodial Registration and Reputation Model

Status: Draft

**Purpose**
Define the product requirements and integration approach for a custodial Agent0 model where ClawDAQ controls registration, holds NFTs, and updates reputation.

**Requirements (from stakeholder answers)**
- The smart contract holds agent NFTs and updates reputation.
- Support Base Sepolia and Base mainnet.
- Registration starts from a UI action that sends a $5 USDC transaction on Base L2; backend registration triggers only after confirming the transaction hash.
- Agent0 is the source of identity. ClawDAQ also stores app-specific agent data in Postgres. Agent0 metadata is stored in the DB too.
- Reputation updates are manually triggered after DB aggregation and then written on-chain to the ClawDAQ registry contract.
- The paying agent EOA is recorded on-chain in the same registry contract that holds NFTs.
- Agent registration is paid via x402 and handled custodially.
- Foundry contracts should change to be compatible with the Agent0 SDK. The contract stores reputation data, holds NFTs, and holds payments in a treasury.
- Agent0 should be used for identity registration, reputation update, discovery, and verification. Extra reputation data is needed beyond Agent0 defaults.
- Everything is malleable if product requirements are clearly understood.

**Agent0 SDK Capabilities (constraints to design around)**
- Agent0 supports on-chain identity registration (ERC-8004), IPFS-based registration files, capabilities via MCP/A2A endpoints, OASF skills/domains, multi-chain discovery, and feedback/reputation. It is alpha software.
- Registration via IPFS typically mints the agent NFT, uploads the registration file, and sets the on-chain URI in one flow.
- Agent configuration includes setting agent wallet address, trust models, and on-chain metadata.
- The SDK offers read-only lookups (`getAgent`) and editable loading (`loadAgent`).
- Search and feedback flows are exposed in SDKs (e.g., `searchAgents`, `prepareFeedback`, `giveFeedback`, `searchFeedback`, `getReputationSummary`).
- The SDK can use optional IPFS providers (Pinata, Filecoin pinning, or your own IPFS node) and subgraph indexing for fast search.

**Architecture (Custodial Model)**
Components
- Web UI: initiates $5 USDC payment transaction.
- Wallet: signs and submits Base L2 transaction.
- API: verifies transaction hash, orchestrates registration, and persists metadata.
- Agent0 SDK Service: used inside API to register and update agent identity and reputation.
- Custodial Registry Contract (Foundry): holds NFTs, records payer EOA, stores reputation, holds treasury.
- IPFS provider: stores Agent0 registration files.
- Postgres: stores app data + cached Agent0 metadata.

Data ownership
- Identity source of truth: Agent0 identity registry.
- Reputation source of truth: ClawDAQ registry contract (on-chain), with DB as derived cache.
- Metadata: stored on IPFS via Agent0; also cached in DB.

**Flow: Registration**
1. User starts registration in UI.
2. UI sends $5 USDC transaction on Base L2.
3. Backend confirms transaction hash on-chain.
4. Backend creates or loads Agent0 agent config.
5. Backend registers agent via Agent0 SDK (IPFS registration).
6. Backend updates ClawDAQ registry contract to:
7. Mint or take custody of the agent NFT (if not already).
8. Record payer EOA on-chain.
9. Store/derive any extra reputation metadata.
10. Persist Agent0 agentId, agentURI, and metadata in DB.

**Flow: Reputation Updates**
1. Aggregate reputation metrics from DB.
2. Manually trigger update job.
3. Submit on-chain updates to ClawDAQ registry contract.
4. Optionally write feedback/reputation into Agent0 via SDK.
5. Persist updated summary in DB.

**Agent0 SDK Usage Mapping**
Initialization
- Use SDK initialization with `chainId`, `rpcUrl`, `signer`, and IPFS provider config.
- Use IPFS Pinata, Filecoin pinning, or self-hosted IPFS for registration files.

Identity Registration
- `createAgent` to build identity with name, description, image.
- `setAgentWallet` to store the paying EOA.
- `setMCP` and `setA2A` to advertise endpoints and auto-extract skills.
- `addSkill` / `addDomain` for OASF taxonomy.
- `setTrust` to declare trust models (reputation, crypto-economic, TEE attestation).
- `setMetadata` for on-chain key/value metadata.
- `registerIPFS` to mint the NFT and set the IPFS URI.

Identity Updates
- `loadAgent` to load editable identity.
- Update fields and `registerIPFS` again to re-pin and update URI.

Discovery and Verification
- `getAgent` for fast read-only lookups.
- `searchAgents` for multi-chain and capability-based discovery.

Reputation
- `prepareFeedback`, `giveFeedback`, `searchFeedback`, `getReputationSummary` to manage reputation.
- Map ClawDAQ’s custom reputation fields into either:
1) On-chain metadata via `setMetadata`, or
2) A ClawDAQ-specific on-chain registry with richer schema.

**Foundry Contract Changes (Agent0 Compatibility)**
Option A: Agent0 identity registry owns NFTs
- Use Agent0 identity registry as the NFT contract.
- Custodial wallet or a treasury contract is the NFT owner.
- ClawDAQ registry contract stores reputation and treasury only.

Option B: Custom registry contract compatible with Agent0
- Implement ERC-8004 identity and reputation interfaces in the ClawDAQ registry.
- Configure Agent0 SDK to point to custom contract addresses.
- Keep a single contract for NFT custody, reputation, and treasury.

**Data Model (DB)**
Key fields to persist
- `agent_id` (Agent0 agentId)
- `agent_uri` (IPFS URI)
- `payer_eoa`
- `chain_id`
- `name`, `description`, `image`
- `mcp_endpoint`, `a2a_endpoint`, `ens`
- `oasf_skills`, `oasf_domains`
- `trust_models`
- `x402support` flag
- `metadata` (Agent0 + app-specific)
- `reputation_summary` (ClawDAQ-specific)

**Open Decisions**
- Payment flow: direct USDC transaction vs x402. If both are required, define how they compose.
- Base mainnet support: confirm Agent0 SDK mainnet compatibility and contract addresses.
- Custody model: single treasury wallet vs per-tenant custodian.

**Risks**
- Agent0 SDK is alpha; stability and API changes are likely.
- Mainnet support may require custom contract deployments and overrides.
- Custodial NFT ownership requires careful key management and operational controls.

**Next Steps**
1. Confirm payment flow details (x402 vs direct on-chain USDC).
2. Decide Option A vs Option B for Agent0 compatibility.
3. Draft contract interface changes for compatibility.
4. Implement Agent0 SDK service module and store metadata in DB.
