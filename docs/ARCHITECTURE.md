# Architecture

How Dhow fits together, for someone about to work on it. Read [`EXPLAINER.md`](EXPLAINER.md) first for the idea; this is the system.

## The shape in one picture

```
 IMPORTER (app/(app))                          FINANCIER (app/(financier))
 CreditProvider                              FinancierProvider
      │  pay / lock / release / refund               │  reads scored borrowers
      │  (USER signs, lib/chain-client)              ▼  funds eligible ones
      ▼                                                 (FINANCIER signs)
 ┌──────────────── API routes (app/api) ──────────────────┐
 │  account · suppliers · payments   Privy-verified persistence (Neon DB)  │
 │  attest    create the EAS shipment-proof attestation    │
 │  score     GET: read the live on-chain score (read-only) │
 │  borrowers scored borrower feed for the financier       │
 │  facilities financier funded-facility ledger            │
 │  faucet    operator sponsors a new user's wallet        │
 └───────────────────────────┬─────────────────────────────┘
                              ▼  server-only viem signer (lib/chain, lib/eas, lib/indexer)
 ┌──────────────────── Polygon (or anvil) ────────────────────┐
 │  DhowEscrow   lock → releaseWithAttestation → refund        │
 │  EAS / attestation contract   shipment proof               │
 │  DhowScoreRegistry   recordSettlement(escrow-only) ·        │
 │                      scoreOf / isEligible (live, on-chain)  │
 │  USDC                                                       │
 └─────────────────────────────────────────────────────────────┘
```

The chain is the shared source of truth. The financier reads the same chain a judge can, so "verified, not trust-me" is literal.

## The flywheel, as transactions

1. **Lock** — the importer signs a Proof-Lock from their own Privy embedded wallet. `DhowEscrow.lock` pulls USDC into escrow. (`lib/chain-client.ts` `lockProoflock`; the payment persists via `/api/payments`.)
2. **Attest** — the trusted inspector signs an EAS shipment-proof attestation (schema: `paymentId, ref, docType, portOfEntry, inspectedAt, supplier`). Returns a uid. (`/api/attest` → `lib/eas.ts`, operator-signed.)
3. **Release** — `DhowEscrow.releaseWithAttestation(paymentId, uid)` verifies the attestation (schema, not revoked, not expired, attester is the inspector, paymentId matches to block replay) and releases to the supplier. Permissionless: the attestation is the authorisation. (user-signed, `lib/chain-client.ts` `releasePayment`.)
4. **Score** — in the *same release transaction*, the escrow calls `DhowScoreRegistry.recordSettlement`, appending the settlement fact on-chain. The score is recomputed live from those facts on every read. There is no separate score-post step, no privileged poster, and no off-chain server in the trust path — if Dhow's backend is down, the score still moves with the money. (`refund` records the failed-proof fact the same way.)
5. **Surface + fund** — the financier reads `/api/borrowers` (with the live on-chain score from `/api/score` GET), sees the score cross the threshold, and funds the SME with a real USDC transfer signed from their own wallet; the facility persists via `/api/facilities`.

Settlement, release and the score update are one atomic on-chain transaction the user signs; the only operator step (attest) is real when the chain is wired and gates off gracefully when it isn't.

## Layers

### Scoring engine — `lib/credit.ts`
Pure and chain-agnostic, and the single most important piece of shared logic. `creditScore(payments, now)` returns the Credit Score as a transparent function of four factors: history (≤30), volume (≤25), proof performance (≤30), cadence (≤15). `ELIGIBLE_THRESHOLD = 70`. `advanceOffer(score)` sizes the working-capital offer. Imported on the client for the optimistic UI; the *canonical* score is the one computed on-chain by `DhowScoreRegistry._score`, which mirrors this same four-factor formula. Keep the two in lockstep — both sides must agree.

### Contracts — `contracts/src`
- **`DhowEscrow.sol`** — the Proof-Lock. `lock` / `releaseWithAttestation` / `releaseByInspector` (owner-gated fallback when `requireEas` is off) / `refund` (after deadline). Events `Locked` / `Released(…, bytes32 attestationUid)` / `Refunded`. `paymentId = keccak256(ref)` is the universal key.
- **`DhowScoreRegistry.sol`** — the on-chain reputation surface, computed from facts. `recordSettlement(business, amount, success, uid)` is callable **only by the escrow** (the `recorder`), appending raw settlement facts (`statsOf`); `scoreOf` / `isEligible` / `isPreferred` compute the live score from those facts at read time (recency decays with real elapsed time). No off-chain poster, no privileged write — the score is as censorship-proof and live as the settlement itself.
- **`interfaces/IEAS.sol`** — minimal vendored EAS interface (the `Attestation` struct + `getAttestation`) so the escrow verifies attestations without a heavy dependency. `test/mocks/MockEAS.sol` is an EAS-compatible attestation registry used locally and on testnet until canonical EAS is wired.

### Client signing — `lib/chain-client.ts`
The user signs their own settlement (`payOpen` / `lockProoflock` / `releasePayment` / `refundPayment`) from their Privy embedded wallet over its EIP-1193 provider. Addresses come from `NEXT_PUBLIC_*` env; `chainConfigured()` gates it. Dhow never signs a user's payment.

### Operator chain spine — server-only
- **`lib/chain.ts`** — the viem signer and config (`getChainConfig` env-gate) for operator-only actions: `readScoreOnChain` (read-only — the score is written on-chain by the escrow, never by the server), the faucet (`fundTestWallet`), and `transferUsdc`.
- **`lib/eas.ts`** — the inspector signs a shipment-proof attestation and returns its uid for release.
- **`lib/indexer.ts`** — reads escrow events (`Locked`/`Released`/`Refunded`) so the financier can derive a borrower's payments from chain state cross-machine, with a short in-memory cache.

### Persistence — server-only
- **`lib/db.ts`** + **`db/schema.sql`** — Neon serverless Postgres (businesses / suppliers / payments / facilities).
- **`lib/store-server.ts`** — server-authoritative CRUD, every function scoped by `businessId` (the verified Privy DID), so a caller only ever touches their own rows.
- **`lib/privy-server.ts`** — verifies the Privy access token (`getUserId`); every mutating route gates on it.

### Stores — client
- **`CreditProvider`** (`useCredit`/`useAccount`/`useWorkspace`) — importer state: Privy auth + DB persistence (via `app/api/*`) + user-signed writes, optimistic-then-reconcile. `attest()` runs the full attest → release → post-score chain.
- **`FinancierProvider`** (`useFinancier`) — borrowers from `/api/borrowers` (real, cross-machine), overlays the on-chain score from `/api/score`, and funds via a real signed USDC transfer recorded in `/api/facilities`.

### Shared UI — `components/score-viz.tsx`
`ScoreCard` / `FactorRow` / `TierPill`, so both personas read the same number in one visual language. Design tokens live in `app/globals.css`.

## Config gating

There is no demo/sim mode. The app reads its capabilities from env and degrades
gracefully when a layer is unconfigured: `privyConfigured()` (auth),
`dbConfigured()` (persistence), `chainConfigured()` / `getChainConfig()`
(client and operator chain). With no config the surfaces still render but the
live paths are off; a real run needs Privy + a Neon DB + the deployed Amoy
addresses (see [`SETUP.md`](SETUP.md)).

## What's deliberately deferred

Multi-financier bidding, real KYC/AML, fee-accrual beyond a single repayment,
canonical EAS on mainnet (Amoy uses an EAS-compatible attestation contract), a
decentralised shipment-proof oracle (the inspector attestation and score post
are still operator-signed), and mainnet itself (gated on an audit + real USDC
liquidity). These are scoped out on purpose; the thesis is proven by the live
flywheel, not by breadth. The honest stage-by-stage read is the Maturity table
in [`README.md`](../README.md).
