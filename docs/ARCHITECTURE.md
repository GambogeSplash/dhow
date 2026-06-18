# Architecture

How Dhow fits together, for someone about to work on it. Read [`EXPLAINER.md`](EXPLAINER.md) first for the idea; this is the system.

## The shape in one picture

```
 IMPORTER (app/(app))                          FINANCIER (app/(financier))
 CorridorProvider                              FinancierProvider
      │  pay / lock / attest / refund                │  reads scored borrowers
      ▼                                              ▼  funds eligible ones
 ┌──────────────── API routes (app/api) ──────────────────┐
 │  /chain    settle: pay | lock | release | refund        │
 │  /attest   create the EAS shipment-proof attestation    │
 │  /score    POST: post score on-chain · GET: read it     │
 │  /fund     financier USDC transfer to the SME           │
 │  /corridors  read corridors from chain events           │
 └───────────────────────────┬─────────────────────────────┘
                              ▼  server-only viem signer (lib/chain, lib/eas, lib/indexer)
 ┌──────────────────── Polygon (or anvil) ────────────────────┐
 │  DhowEscrow   lock → releaseWithAttestation → refund        │
 │  EAS / attestation contract   shipment proof               │
 │  DhowScoreRegistry   scoreOf / isEligible / postScore       │
 │  USDC                                                       │
 └─────────────────────────────────────────────────────────────┘
```

The chain is the shared source of truth. The financier reads the same chain a judge can, so "verified, not trust-me" is literal.

## The flywheel, as transactions

1. **Lock** — importer sends a Proof-Lock. `DhowEscrow.lock` pulls USDC into escrow. (`/api/chain` action `lock`.)
2. **Attest** — the trusted inspector signs an EAS shipment-proof attestation (schema: `corridorId, ref, docType, portOfEntry, inspectedAt, supplier`). Returns a uid. (`/api/attest` → `lib/eas.ts`.)
3. **Release** — `DhowEscrow.releaseWithAttestation(corridorId, uid)` verifies the attestation (schema, not revoked, not expired, attester is the inspector, corridorId matches to block replay) and releases to the supplier. Permissionless: the attestation is the authorisation. (`/api/chain` action `release`.)
4. **Score** — the server recomputes the Corridor Score with the pure engine and posts it to `DhowScoreRegistry`. (`/api/score` POST.)
5. **Surface + fund** — the financier polls `/api/score` and `/api/corridors`, sees the score cross the threshold, and funds the SME with a real USDC transfer. (`/api/fund`.)

Every step is a real on-chain transaction when the chain is wired, or a simulated hash when it isn't, so the demo always runs.

## Layers

### Scoring engine — `lib/corridor.ts`
Pure and chain-agnostic, and the single most important piece of shared logic. `scoreCorridors(corridors, now)` returns the Corridor Score as a transparent function of four factors: history (≤30), volume (≤25), proof performance (≤30), cadence (≤15). `ELIGIBLE_THRESHOLD = 70`. `advanceOffer(score)` sizes the working-capital offer. Imported on the client (optimistic UI) and the server (posting the score on-chain). Do not fork this; both sides must agree.

### Contracts — `contracts/src`
- **`DhowEscrow.sol`** — the Proof-Lock. `lock` / `releaseWithAttestation` / `releaseByInspector` (owner-gated fallback when `requireEas` is off) / `refund` (after deadline). Events `Locked` / `Released(…, bytes32 attestationUid)` / `Refunded`. `corridorId = keccak256(ref)` is the universal key.
- **`DhowScoreRegistry.sol`** — `postScore(business, score, attestationUid)` (poster-only), `scoreOf`, `isEligible`. The on-chain reputation surface.
- **`interfaces/IEAS.sol`** — minimal vendored EAS interface (the `Attestation` struct + `getAttestation`) so the escrow verifies attestations without a heavy dependency. `test/mocks/MockEAS.sol` is an EAS-compatible attestation registry used locally and on testnet until canonical EAS is wired.

### Chain spine — server-only
- **`lib/chain.ts`** — the viem signer and config (`getChainConfig` env-gate), the `pay | lock | release | refund` action router, plus `postScoreOnChain` / `readScoreOnChain` / `transferUsdc`.
- **`lib/eas.ts`** — the inspector signs a shipment-proof attestation and returns its uid for release.
- **`lib/indexer.ts`** — reads escrow events (`Locked`/`Released`/`Refunded`) so the financier can derive a borrower's corridors from chain state cross-machine, with a short in-memory cache.

### Stores — client
- **`CorridorProvider`** (`useCorridor`/`useAccount`/`useWorkspace`) — importer state, localStorage-persisted, optimistic-then-reconcile. `attest()` runs the full attest → release → post-score chain.
- **`FinancierProvider`** (`useFinancier`) — derives borrowers from the importer's persisted workspace (same-origin localStorage, so a two-window demo is live), overlays the on-chain score from `/api/score`, and funds via `/api/fund`.

### Shared UI — `components/score-viz.tsx`
`ScoreCard` / `FactorRow` / `TierPill`, so both personas read the same number in one visual language. Design tokens live in `app/globals.css`.

## Demo mode

Set `NEXT_PUBLIC_DEMO_MODE=1` to: auto-attest a locked Proof-Lock after a short beat (no manual click on stage), speed the score count-up, tighten the financier poll to 1s, and cascade the factor bars. The factor that moved pulses and the meter celebrates when the score crosses the threshold.

## What's deliberately deferred

Multi-financier bidding, real KYC/AML, fee-accrual beyond a single repayment, Privy production auth, a database (state is localStorage on the importer, chain-derived on the financier), and canonical EAS on mainnet. These are scoped out of the demo on purpose; the thesis is proven by the live flywheel, not by breadth.
