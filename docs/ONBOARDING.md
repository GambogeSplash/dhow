# Team onboarding

For the three of us starting work on Dhow. Read this first, then your lane below.
Running the kickoff call? Use [`onboarding-call-script.md`](onboarding-call-script.md)
(a recitable script plus a live product walkthrough); this doc is the written
reference the team reads afterward.
Background reading order: [`README.md`](../README.md) (what + why) →
[`docs/EXPLAINER.md`](EXPLAINER.md) (plain-language) →
[`docs/ARCHITECTURE.md`](ARCHITECTURE.md) (how it fits) → this doc (who does what).

## Dhow in 60 seconds

We pay a small importer's cross-border supplier invoice in stablecoin (USDC on
Polygon), and every settlement becomes verified on-chain cashflow. Enough of
that history lifts a transparent **Credit Score**; cross the threshold and the
importer is surfaced to a financier who funds them. We don't sell software and
beg for data — we move the money and the data is exhaust. Marketplace, not a
lender. Built for the Polygon × DIFC × Ignyte challenge (application due
**2026-07-13**).

## The one mental model

The **chain is the shared source of truth**. There are two human roles and a
strict signing rule:

```
 IMPORTER  app/(app)        FINANCIER  app/(financier)
   pay / lock / release        reads scored borrowers, funds them
   refund  (USER signs)             (FINANCIER signs)
        │                                │
        ▼            app/api             ▼
   account · suppliers · corridors · attest · score · borrowers · facilities · faucet
        │   (Privy-verified persistence + operator-only chain actions)
        ▼
   Postgres (Neon)              Polygon Amoy
   businesses/suppliers/         DhowEscrow · DhowScoreRegistry
   corridors/facilities          EAS attestation · USDC
```

**Signing rule (do not break it):**
- The **user signs their own settlement** (pay / lock / release / refund) from
  their Privy embedded wallet — `lib/chain-client.ts`. Dhow never holds funds
  and never signs a user's payment.
- The **operator signs only two things**: the trusted inspector's EAS
  shipment-proof attestation, and posting the Credit Score on-chain —
  `lib/chain.ts` + `lib/eas.ts`. These are legitimately third-party / operator
  actions, not the buyer's money.

**The shared contract:** `lib/corridor.ts` is the scoring engine. It is pure,
chain-agnostic, and imported by **both** the client (optimistic UI) and the
server (posting the score on-chain). **Never fork it** — both sides must compute
the identical number, or the on-chain score and the UI disagree.

## The three lanes

### Lane 1 — Smart contracts (Foundry, Solidity)

Everything under `contracts/`. You own the on-chain truth layer.

| File | What it is |
| --- | --- |
| `contracts/src/DhowEscrow.sol` | The Proof-Lock. `lock` → `releaseWithAttestation` (EAS-gated, permissionless once a valid attestation exists) → `refund` (after deadline). `releaseByInspector` is the owner-gated fallback. On every release/refund it calls the registry's `recordSettlement` in the **same transaction** (wrapped in try/catch so accounting can never block the money). `corridorId = keccak256(ref)` is the universal key. |
| `contracts/src/DhowScoreRegistry.sol` | On-chain credit reputation, computed from facts. `recordSettlement` is **escrow-only** (the `recorder`); `scoreOf` / `isEligible` compute the live score on-chain from the raw `statsOf` facts. No off-chain poster — the financier reads a number that moves with the money even if Dhow's backend is down. |
| `contracts/src/MockUSDC.sol` | 6-dp open-mint test token. Stand-in for Circle USDC. |
| `contracts/src/interfaces/IEAS.sol` | Minimal vendored EAS interface so the escrow verifies attestations without a heavy dep. `test/mocks/MockEAS.sol` is the EAS-compatible stand-in used on Amoy. |
| `contracts/test/*.t.sol` | 23 passing tests (14 escrow incl. every rejection, the on-chain settlement recording + fallback, 9 registry incl. fact accumulation, performance/cadence decay). |
| `contracts/script/Deploy.s.sol` / `DeployCore.s.sol` | Full deploy / lean reuse deploy. |
| `aderyn.toml` | Static analysis config (already wired). |

**First hour:** `cd contracts && forge install && forge test`. Read
`DhowEscrow.sol` top to bottom, then its test file — the tests are the spec of
every release/refund/attestation rejection path. Run `aderyn` to see the static
analysis surface.

**Where the real work is:** EAS gating is verified against an EAS-*compatible*
stand-in (`MockEAS`), not canonical EAS — wiring canonical EAS is open. The
score-registry write is still operator-posted (a trusted attester stands in for
a decentralised shipment-proof oracle). Mainnet is gated on an audit. Keep
`forge test` green, pin the pragma, prefer custom errors, use SafeERC20.

### Lane 2 — Backend (TypeScript: server libs, API routes, DB)

Server-only `lib/*` + `app/api/*` + `db/`. You own persistence, auth, and the
operator chain spine.

| File | What it is |
| --- | --- |
| `lib/db.ts` | Neon serverless Postgres client + `dbConfigured()` gate. |
| `db/schema.sql` | businesses / suppliers / corridors / facilities. Apply this to your DB. |
| `lib/store-server.ts` | Server-authoritative CRUD, **every function scoped by `businessId` (the verified Privy DID)** — a caller can only touch their own rows. |
| `lib/privy-server.ts` | `getUserId(req)` / `privyConfigured()` — verifies the Privy access token. Every mutating route gates on this. |
| `lib/chain.ts` | Server-only viem signer for **operator** actions: EAS attest, score post/read, faucet, USDC transfer. Env-gated via `getChainConfig()`. |
| `lib/eas.ts` | Inspector signs a shipment-proof attestation, returns its uid for release. |
| `lib/indexer.ts` | Reads escrow events so the financier derives a borrower's corridors from chain state, cross-machine. |
| `app/api/account` | GET/POST the authenticated business profile + wallet. |
| `app/api/suppliers` | POST add a supplier. |
| `app/api/corridors` | GET (public chain-derived feed by payer) · POST (create after user signs) · PATCH (lifecycle). |
| `app/api/attest` | POST: operator creates the EAS shipment-proof attestation. |
| `app/api/score` | POST: post score on-chain · GET: read `scoreOf` / eligibility. |
| `app/api/borrowers` | GET: scored borrower feed for the financier. |
| `app/api/facilities` | GET/POST/PATCH the financier's funded facilities (created after a real on-chain USDC transfer). |
| `app/api/faucet` | POST: operator sponsors a new user's wallet with POL + test USDC. |

**First hour:** read `lib/store-server.ts` (the data model in code) alongside
`db/schema.sql`, then `app/api/corridors/route.ts` — it shows the full pattern:
Privy guard → DB write → chain-derived read. Note the env-gating: with no DB or
Privy config the routes degrade gracefully rather than crash.

**Where the real work is:** financier funding is recorded after a real transfer
but the disbursement flow can deepen; no KYC/AML layer yet; the indexer cache is
in-memory. The `chainConfigured`/`dbConfigured`/`privyConfigured` gates are how
everything stays runnable without secrets — preserve that.

### Lane 3 — Product / frontend / design (you)

`app/` surfaces, `components/`, `app/globals.css`. You own the two-sided product
and the design language.

| File | What it is |
| --- | --- |
| `app/page.tsx` | Landing. |
| `app/onboarding/` | Sign in (Privy) → business → supplier → wallet. |
| `app/(app)/{overview,send,corridor,capital,suppliers}` | Importer surfaces. |
| `app/(financier)/{desk,opportunities,deal/[business],portfolio}` | Financier surfaces. |
| `components/CorridorProvider.tsx` | Importer client store: `useCorridor` / `useAccount` / `useWorkspace`. Privy auth + DB persistence + user-signed writes. `attest()` runs the full attest → release → post-score chain. |
| `components/FinancierProvider.tsx` | Financier store: borrowers from `/api/borrowers` + on-chain score overlay; funds via a real signed USDC transfer. |
| `components/Providers.tsx` | Privy + wagmi + react-query, scoped to app+onboarding so the public landing stays provider-free. |
| `components/{score-viz,AnimatedNumber,Sidebar,AppShell,FaucetCard,DhowMark,LandingCta}.tsx` | Shared UI. `score-viz` (`ScoreCard`/`FactorRow`/`TierPill`) renders the same number both personas read. |
| `app/globals.css` | Design tokens: chart-paper `#faf8f3`, indigo ink `#11202e`, verdigris teal `#0c7c66` (trust), brass `#b07d28` (value moments). Spectral display + Geist + Geist Mono, tabular figures. No dark mode. |

**First hour:** run it (below), click the full flywheel, then read
`CorridorProvider.tsx` — it's where UI state, the scoring engine, and the
user-signed chain calls meet.

**Copy rules (enforced):** no em dashes or dash-joined clauses in user-facing
strings; no decorative sparkle icons; never say "letter of credit" (say
Proof-Lock / conditional settlement) or "we lend".

## Run it

```bash
npm install --legacy-peer-deps          # web3 deps need legacy peer resolution
cd contracts && forge install && cd ..  # OpenZeppelin submodule
npm run dev -- -p 4400                  # http://localhost:4400
```

Real run needs three creds (see [`docs/SETUP.md`](SETUP.md)):
`NEXT_PUBLIC_PRIVY_APP_ID` + `PRIVY_APP_SECRET`, `DATABASE_URL` (apply
`db/schema.sql`), and the deployed `NEXT_PUBLIC_USDC/ESCROW` addresses on Amoy.
Without them the gates keep the app runnable but the live chain/DB paths are off.

Full local-chain flow (anvil → deploy → real txs) and Amoy deploy:
[`CONTRIBUTING.md`](../CONTRIBUTING.md) and [`docs/CHAIN.md`](CHAIN.md).

**Tests:** `npm test` (Vitest — scoring engine) · `cd contracts && forge test`
(15 contract tests) · `npx tsc --noEmit` (app typecheck).

## How we work

- **Branches** off `main`, open a PR. `main` auto-deploys to Vercel
  (https://dhow-pi.vercel.app). Keep `forge test` and the typecheck green.
- **Commits:** no `Co-Authored-By` trailers. README stays signal-only.
- The honest current state and the gaps that are the actual roadmap are the
  **Maturity** table in [`README.md`](../README.md) — that table is the backlog.

## The shared seam, restated

If you change `lib/corridor.ts`, the contract `DhowScoreRegistry` semantics, or
the EAS schema, you've touched all three lanes at once. Flag those in the PR and
loop the other two in. Everything else is mostly lane-local.
</content>
</invoke>
