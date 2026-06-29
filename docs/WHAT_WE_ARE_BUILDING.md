# What we're building, and why

## In one line

**Dhow settles cross-border supplier payments in stablecoin, and turns each
settlement into the cashflow evidence that makes a small importer fundable.**

The payment is the product you reach for. The credit record is what falls out
the back. Nobody has to "digitise their trade" — we pay their suppliers, and
the verified ledger writes itself.

---

## The problem

The global trade-finance gap is **$2.5 trillion** (ADB) — roughly a tenth of
all world merchandise trade that wants financing and can't get it. The weight
lands on small importers: SMEs are rejected on about **41%** of trade-finance
applications, against ~7% for multinationals.

The reason is circular, and that circle is the whole problem:

> Banks reject SMEs because they can't see reliable cashflow.
> They can't see the cashflow **because** they rejected them.

Meanwhile the payment rails these businesses live on are slow and opaque.
Correspondent banking takes 3–5 days and costs over 3% on a quarter of
corridors. So the SME loses twice: the money moves badly, **and** moving it
badly leaves no usable record of having moved it.

## Why the obvious fixes failed

Every prior on-chain attempt broke the same way:

- **Bank consortia** (Marco Polo, we.trade, Contour) asked corporates to
  digitise trade with no payment hook. No reason to show up daily → no volume →
  insolvency.
- **Tokenised-receivables platforms** (Centrifuge, Polytrade) quietly walked
  away from trade receivables toward tokenised treasuries — the underlying data
  was unverifiable and the origination wasn't theirs.

The missing ingredient was always the same: **deal origination tied to real
payment flow and verifiable performance data.** Not a portal. Not a promise. A
payment that actually happened, that we settled, that we can prove.

---

## What Dhow actually is

A three-layer product, and the order matters.

### 1. The wedge — stablecoin supplier settlement

An importer pays their overseas supplier through Dhow. Two modes:

- **Open settlement** — a direct stablecoin (USDC) transfer to the supplier,
  on Polygon, in minutes, for a fraction of a cent.
- **Proof-Lock** — funds are escrowed on-chain and **release only when shipment
  proof is attested** (a bill of lading attested by a trusted inspector via
  EAS). If proof never arrives, the buyer is refunded after a deadline. This is
  a conditional settlement — the trust mechanics of a letter of credit, without
  the letter, the bank, or the week.

The payment is genuinely better than the bank wire. That's why it gets used.
That's the whole wedge.

### 2. The primitive — a verified on-chain cashflow record

Because Dhow settled the payment, Dhow can prove it happened. Every settled
payment lifts a **Credit Score** — a *transparent function* of the payments we
settled ourselves:

- **Settled history** — how many real settlements
- **Trailing volume** — how much real value moved
- **Proof performance** — of Proof-Locks, how many released clean vs. disputed
- **Cadence** — how recently and regularly they settle

The score isn't asserted, it's *derived*, and the derivation is shown on screen.
It is posted on-chain to a registry, so a financier reads a number they can
verify — not an attestation they have to trust. **This is data no one can
fabricate and no one else can source, because it's the residue of payments only
we processed.**

### 3. The market — matching de-risked SMEs to capital

Once a business crosses the eligibility threshold, Dhow surfaces it to
financiers, who extend a working-capital advance sized to bridge one shipment's
cash gap.

**Dhow is a marketplace, not a balance-sheet lender.** We match and take a fee;
we don't lend our own capital. That decision is load-bearing:

- It makes the region's banks our **demand side**, not our competition.
- It keeps us capital-light.
- It sidesteps needing a lending licence.

---

## Why the flywheel holds

The payment is the wedge in three senses at once:

1. **Entry** — it's the thing a business signs up to do.
2. **Acquisition** — every payment is a new data point that compounds the score.
3. **Lock-in** — the financier's view of a borrower stays live *only while the
   SME keeps settling on Dhow.* Stop settling, the signal goes stale. The
   payment habit is the moat.

> We don't ask anyone to change their behaviour with no payoff. We give them a
> better payment, and creditworthiness accrues as a side effect of using it.

---

## Who it's for

- **Beachhead:** UAE-based SME importers settling cross-border supplier payments
  on under-served MENA↔Asia/Africa corridors flowing through Jebel Ali
  (15.5M TEU/yr). The UAE is the right wedge: stablecoins are already ~51% of
  national crypto activity, and DIFC offers a regulated home with direct access
  to financier liquidity.
- **Demand side:** DIFC-based working-capital providers and banks who want
  de-risked, pre-verified SME origination they could never source themselves.

---

## How it's built

| Layer | What runs it |
| --- | --- |
| **Settlement** | USDC on **Polygon (Amoy testnet today)**. `DhowEscrow` Proof-Lock contract (Foundry-tested), conditional release gated on a real **EAS** shipment-proof attestation. |
| **Identity & wallet** | **Privy** — real login + a non-custodial embedded wallet per business. **The user signs their own settlements.** Dhow never holds their funds. |
| **Credit record** | `DhowScoreRegistry` on-chain; the score is computed by a pure, auditable engine (`lib/credit.ts`) from settled payments and posted on-chain. |
| **Data** | **Neon / Vercel Postgres** — businesses, suppliers, payments. Per-user, server-authoritative, scoped to the authenticated Privy identity. |
| **App** | Next.js 16, server API routes for persistence, client-side signing via the user's embedded wallet. |

### The compliance perimeter, deliberately

- We settle in **native USDC on Polygon** and use **AED only as a display
  currency.** No AED stablecoin is involved (none exists permissionlessly on
  Polygon), which keeps us clear of onshore stablecoin regimes.
- Dhow is positioned **DIFC / DFSA** (free-zone, sandbox path), outside CBUAE
  PTSR, which excludes free zones.
- We never call Proof-Lock a "letter of credit," never say "we lend," never
  claim a regulatory first.

---

## What's real, and what's next (no varnish)

**Real:**
- The Proof-Lock escrow + EAS attestation + score registry contracts, deployed
  and exercised on Amoy.
- The scoring engine — a genuine, transparent function of settled payments.
- User-signed settlement from a real embedded wallet; per-user persistence in a
  real database; the full pay → settle → score → capital loop.

**Next, honestly:**
- **Mainnet** settlement with real USDC — gated behind a contract audit, real
  USDC liquidity, and KYC/compliance. Testnet first is the responsible default.
- The **financier side** as a full product surface (today it reads the live
  on-chain payment feed and posted scores).
- Real inspector integrations for shipment proof (today a trusted attester key
  stands in for the inspector).
- KYC/AML onboarding and a compliance workflow before any real-money corridor.

---

## The sentence to remember

**We don't ask anyone to digitise trade. We pay their suppliers, and the
ledger falls out.**
