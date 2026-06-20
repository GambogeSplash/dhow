# Dhow

**Settlement that makes the unfundable legible.**

Dhow pays cross-border supplier invoices in stablecoin in minutes, and turns every settlement into verified on-chain cashflow that unlocks working capital. We don't ask anyone to digitise trade. We pay their suppliers, and the ledger falls out.

Built for **The Smart Commerce Infrastructure Challenge** (Polygon × DIFC × Ignyte).

---

## The problem

Global trade runs on credit that small importers can't get. The trade-finance gap is roughly **$2.5T** (ADB). Around **41%** of SME finance applications are rejected, against **7%** for multinationals. The reason is legible to anyone who has tried: a profitable importer in Dubai or Lagos has a real order book and a real payment history, but none of it is in a form a bank can underwrite. Correspondent banking takes 3 to 5 days, charges more than 3% on a meaningful share of corridors, and leaves no structured record behind. So the cashflow exists, and it stays invisible, and the importer stays unfundable.

Every previous attempt to fix this asked corporates to change behaviour first: digitise your documents, join our consortium, adopt our standard. With no payment hook, those efforts died.

## The insight

Lead with the payment. An importer already has to pay their supplier. If that payment settles through Dhow, in stablecoin, on Polygon, the verified record of it is a by-product, not a product we have to sell. Do that across a few shipments and you have something no one can fabricate or source elsewhere: a clean, on-chain history of real cashflow. That history is the underwriting primitive.

## How it works

1. **Pay the supplier.** Open settlement, or a Proof-Lock that escrows on-chain and releases the moment shipment proof is attested. A disputed Proof-Lock refunds the buyer and counts against their record.
2. **The record writes itself.** Each settled corridor lifts a **Corridor Score**, a transparent function of settled volume, proof performance, and cadence. No black box: the importer and the financier can both see exactly how the number is derived.
3. **Capital unlocks.** Cross the eligibility threshold and Dhow surfaces the importer to financiers with a working-capital offer sized to the settled history. The financier carries the risk and earns the yield. Dhow takes a fee.

The payment is the wedge in three senses at once: it is how a customer enters, it is the customer-acquisition engine, and it is the anti-disintermediation lock. The financier's live feed of creditworthiness stays live only while the importer keeps settling on Dhow.

## Why this holds

- **Wedge inversion.** Most trade-finance plays sell software and beg for data. Dhow moves money and the data is exhaust.
- **Cashflow as the primitive.** Underwriting runs on payments Dhow settled itself. That is data no competitor can buy or fake.
- **Marketplace, not balance sheet.** Dhow matches de-risked importers to third-party financiers and takes a fee. Capital-light, and it turns the region's banks and credit funds into the demand side rather than the competition. It also sidesteps the need for a lending licence.
- **Compliant perimeter.** DIFC-domiciled settlement in native USDC on a sub-cent chain, over a corridor the incumbents under-serve.

## Regulatory posture

Dhow settles in **native USDC on Polygon**, with **AED used as the quote and display currency**. It is positioned in the **DIFC under the DFSA** (free-zone, innovation sandbox track), outside the onshore-merchant scope of the CBUAE payment-token rules. The corridor economics are real: UAE inbound remittances run near **$38.5B**, stablecoins are roughly **51%** of UAE crypto activity, Dubai is about **90%** cashless, and a Polygon settlement costs around **$0.002**.

## What's in this repo

A working product, not slideware, and the settlement is real on-chain, not mocked.

**The importer side** — a real user signs up and runs their business through it:
- **Onboarding and accounts.** Sign in, name your business, add suppliers, connect a wallet. Each account is its own workspace.
- **Send.** Pay a supplier with a chosen settlement mode and live FX.
- **Corridor Record.** The Corridor Score with its full derivation, and a ledger of settled, in-flight, refunded, and disputed corridors.
- **Capital.** The working-capital offer, and the financier's view of the borrower they would otherwise reject.

**The financier side** — the marketplace's demand side (`app/(financier)`): a desk, an opportunity feed of scored borrowers, a deal view that underwrites against verified corridors, and a fund action that moves capital. A borrower surfaces here the moment their on-chain Corridor Score crosses the eligibility threshold.

**The on-chain layer** — a Foundry workspace settling for real:
- **`DhowEscrow`** — Proof-Lock conditional settlement. Release is gated on a real **EAS attestation** of the shipment proof (right schema, not revoked, signed by the trusted inspector, bound to the corridor), permissionless once a valid attestation exists. OZ `Ownable`/`ReentrancyGuard`/`SafeERC20`, custom errors, and an owner fallback for stage resilience.
- **`DhowScoreRegistry`** — the Corridor Score posted on-chain per business, so the financier reads `scoreOf`/`isEligible` directly from chain rather than trusting a database.
- **`MockUSDC`** plus a minimal EAS-compatible attestation contract, with a passing test suite (15 tests) and a clean deploy script.

You get in by signing in with Privy — email, passkey, or an existing wallet — which provisions a non-custodial embedded wallet. From there you onboard your business, add a supplier, and start settling.

## Architecture

| Layer | Where | Role |
| --- | --- | --- |
| Scoring engine | `lib/corridor.ts` | Pure, chain-agnostic. Credit Score and advance sizing as transparent functions of settled corridors. Shared by client and server. |
| Identity | Privy (`components/Providers.tsx`) | Real login + a non-custodial embedded wallet per business. The verified Privy DID is the account key the server trusts. |
| Data layer | `lib/db.ts`, `lib/store-server.ts`, `db/schema.sql` | Neon / Vercel Postgres. Server-authoritative businesses, suppliers, corridors — scoped to the authenticated Privy user. |
| Client signing | `lib/chain-client.ts` | The user signs their own settlement from their embedded wallet: open pay, Proof-Lock approve+lock, release, refund. Dhow never signs a user's payment. |
| Importer store | `components/CorridorProvider.tsx` | Privy auth + DB persistence + user-signed writes. Settling a Proof-Lock runs the full chain: inspector EAS attestation (server), user-signed release, on-chain score post. |
| Operator chain layer | `lib/chain.ts`, `lib/eas.ts`, `lib/indexer.ts` | Server-only viem signer for operator-only actions: the trusted inspector's EAS attestation, the score-registry read/write, and an event indexer. |
| API | `app/api/{account,suppliers,corridors,attest,score,borrowers}` | Privy-verified persistence routes plus the operator/feed endpoints. |
| Contracts | `contracts/src/{DhowEscrow,DhowScoreRegistry,MockUSDC}.sol` | EAS-gated escrow and the on-chain credit registry. |
| Surfaces | `app/onboarding`, `app/(app)/*`, `app/(financier)/*` | The two-sided product, behind real accounts. |

Stack: Next.js, React, Tailwind v4, TypeScript, viem, Foundry, EAS. Design language is a light, operator-grade trade-ledger: chart-paper and indigo ink, verdigris teal for trust, brass for value moments, Spectral and Geist with tabular figures.

For the full technical walkthrough, see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). To run it locally end to end, see [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Maturity

An honest read, because the gaps are the roadmap.

| Stage | State |
| --- | --- |
| Thesis validated | Done. The wedge, the marketplace model, and the regulatory posture are reasoned through and citation-backed in `docs/research/`. |
| Working two-sided product | Done. Importer and financier surfaces, real Privy onboarding, the full flywheel. |
| Real accounts + persistence | Done. Privy identity (non-custodial embedded wallets) and a Neon/Vercel Postgres database, scoped per verified user. No localStorage, no sample data. |
| User-signed on-chain settlement | Done. The user signs their own open pay / Proof-Lock / release / refund from their embedded wallet on Polygon Amoy. Dhow never signs a user's payment. 15 contract tests pass. |
| Public testnet (Amoy) | Live. USDC, escrow, registry and an EAS-compatible attestation contract are deployed on Amoy; settlement produces real Polygonscan transactions. |
| Production (mainnet) | Not yet, by design. |

Where a real build goes next: the inspector EAS attestation and score-registry write are still operator-signed server-side (a trusted attester stands in for a decentralised shipment-proof oracle); financier funding is recorded as a local commitment ledger rather than a financier-wallet-signed disbursement; the attestation contract is an EAS-compatible stand-in until canonical EAS is wired; USDC is an open-mint testnet token, not Circle USDC on mainnet. Mainnet is gated on a contract audit, real USDC liquidity, and KYC/AML. No real users yet.

## Docs

- [`docs/EXPLAINER.md`](docs/EXPLAINER.md) plain-language idea, use case, and demo scenario (start here)
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) how the system fits together, layer by layer
- [`CONTRIBUTING.md`](CONTRIBUTING.md) run it locally, the on-chain flow, deploy, conventions
- [`docs/BRIEF.md`](docs/BRIEF.md) canonical product spec
- [`docs/CHAIN.md`](docs/CHAIN.md) on-chain settlement recipe
- [`docs/research/`](docs/research) regulation, Polygon stack, trade-finance benchmarks, competitive landscape
