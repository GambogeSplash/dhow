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

A working product, not slideware. A real user can sign up and run their own business through it:

- **Onboarding and accounts.** Sign in, name your business, add suppliers, connect a wallet. Each account is its own workspace.
- **Send.** Pay a supplier with a chosen settlement mode and live FX.
- **Corridor Record.** The Corridor Score with its full derivation, and a ledger of settled, in-flight, refunded, and disputed corridors.
- **Capital.** The working-capital offer, and the financier's view of the borrower they would otherwise reject.
- **Escrow contracts.** A Foundry workspace with `DhowEscrow` (lock, attest-release, timeout-refund, reentrancy-guarded) and `MockUSDC`, with a passing test suite.

There are two ways in: **Start free** for the real onboarding, or **Explore with sample data** to see the whole flywheel in one click.

## Architecture

| Layer | Where | Role |
| --- | --- | --- |
| Scoring engine | `lib/corridor.ts` | Pure, chain-agnostic. Corridor Score and advance sizing as transparent functions of settled corridors. |
| Account layer | `lib/account.ts` | Per-user identity, business, suppliers, wallet, and the sample workspace. Where a real auth provider and database swap in. |
| Workspace store | `components/CorridorProvider.tsx` | Client state and actions (pay, attest, refund, retry, accept offer). Optimistic update, then patches the real tx hash. |
| Chain layer | `lib/chain.ts`, `app/api/chain/route.ts` | Server-only viem signer. An action becomes a real Polygon transaction, or a simulated hash when no chain is configured, so it always runs. |
| Surfaces | `app/onboarding`, `app/(app)/{overview,send,corridor,capital,suppliers}` | The product, behind a real account. |

Stack: Next.js, React, Tailwind v4, TypeScript, viem, Foundry. Design language is a light, operator-grade trade-ledger: chart-paper and indigo ink, verdigris teal for trust, brass for value moments, Spectral and Geist with tabular figures.

## Run it

```bash
npm install --legacy-peer-deps
npm run dev
cd contracts && forge test
```

With no chain configured, settlement runs in simulation so the full flow works out of the box. On-chain settlement on Polygon Amoy is env-gated; the recipe is in `docs/CHAIN.md`.

## Docs

- [`docs/BRIEF.md`](docs/BRIEF.md) product spec
- [`docs/CHAIN.md`](docs/CHAIN.md) on-chain settlement recipe
- [`docs/research/`](docs/research) regulation, Polygon stack, trade-finance benchmarks, competitive landscape
