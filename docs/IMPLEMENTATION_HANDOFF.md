# ClawDAQ ERC-8004 Custodial Handoff

Updated: 2026-02-10  
Status: API and schema refactor complete. Deployment and end-to-end validation are next.

## 1. Locked Decisions

1. DG1: Registration starts with `registration-loading.json`, then updates to `/:id/registration.json`.
2. DG2: x402 settlement is the payment source of truth. Transaction verification service removed.
3. DG3: Canonical DB/runtime fields are `erc8004_*`. Legacy `agent0_*` removed.
4. DG4: `/verify-erc8004` accepts either identity owner match or custodial registry `payer_eoa` match.
5. DG5: Contract interaction hardening is deferred to deployment phase.

## 2. Completion Check

| Task Area | Status | Notes |
|---|---|---|
| Registration route rewrite | Done | `/register-with-payment` now mints with loading URI and attempts URI finalization |
| Metadata endpoints | Done | Added `/registration-loading.json` and `/:id/registration.json` |
| Legacy identity SDK removal | Done | Removed runtime usage and deleted `Agent0Service` |
| Tx verification removal | Done | Deleted `TxVerificationService`; x402 settlement remains gate |
| ERC-8004 verification flow | Done | Identity owner or payer_eoa path supported |
| Config/env cleanup | Done | Canonical `ERC8004_IDENTITY_REGISTRY_ADDRESS` path in config |
| DB canonicalization | Done | API reads/writes use `erc8004_*`; migration drops legacy `agent0_*` |
| Docs cleanup (SDK mentions) | Done | Updated handoff and PRD references |
| Contract deploy/register verify | Pending | Next phase (network deployment + verification) |
| Live user interaction validation | Pending | Next phase after deployment |

## 3. Key Files Updated

- `api/src/routes/agents.js`
- `api/src/services/AgentService.js`
- `api/src/services/BlockchainService.js`
- `api/src/services/ERC8004Service.js`
- `api/src/services/ERC8004IdentityService.js` (new)
- `api/src/services/Agent0Service.js` (deleted)
- `api/src/services/TxVerificationService.js` (deleted)
- `api/src/middleware/x402Payment.js`
- `api/src/config/index.js`
- `api/.env.example`
- `api/scripts/schema.sql`
- `api/scripts/erc8004-migrate.sql`
- `docs/CLAWDAQ_PRD.md`

## 4. Next Phase

1. Deploy custodial and identity contracts to target chain.
2. Verify deployment addresses and env wiring in API.
3. Run end-to-end registration and verification flow against live backend.
4. Validate post-registration interaction flows.
