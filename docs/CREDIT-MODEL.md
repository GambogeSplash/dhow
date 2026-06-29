# Dhow credit model — how the score works

This explains how Dhow decides whether to advance working capital, how much, at
what price, and how it watches the advance afterwards. It's written so anyone —
including the smart-contract dev — can read the logic without reading the code,
then jump to the exact source when they need to.

- **Code:** [`lib/credit.ts`](../lib/credit.ts) — pure, deterministic, no I/O.
  One module, two layers: the payment primitives + behaviour score
  (`creditScore`), and the underwriting decision (`assessCredit`, `advanceHealth`).
- **Tests:** [`lib/credit.test.ts`](../lib/credit.test.ts) + [`lib/credit-score.test.ts`](../lib/credit-score.test.ts) — worked cases.
- **Contract impact:** [`contracts/CREDIT-V2-IMPACT.md`](../contracts/CREDIT-V2-IMPACT.md).

---

## 1. The one idea

A loan loses money in exactly one way: the borrower doesn't pay it back. A risk
team prices that as **Expected Loss**:

```
Expected Loss = PD × LGD × EAD
                │     │     └── Exposure at Default — how much is out (the advance)
                │     └──────── Loss Given Default — how much we lose if they don't pay
                └────────────── Probability of Default — how likely they don't pay
```

Everything below is just Dhow measuring those three things from facts it can
see, and turning them into an offer.

## 2. Why the behaviour score isn't the whole answer

The first layer, `creditScore` (in `lib/credit.ts`, mirrored on-chain in
`DhowScoreRegistry`), is a single 0–100 number from settlement history. On its
own it has two problems:

1. It conflates *will they pay* (PD), *how much can they handle* (capacity), and
   *how much we'd recover* (LGD) into one figure.
2. It can be **gamed by paying yourself** — fat settlements to your own wallet
   inflate the score.

So it's not the decision — it's an input. The second layer, `assessCredit`,
consumes it as a character signal and splits the actual decision into five
layers, closing the self-dealing hole along the way.

## 3. Dhow's data stance (the important bit)

Dhow sees money flowing **out** — supplier payments. That is a **character**
signal ("this business pays its obligations"), *not* a capacity signal. Capacity
and repayment certainty come from money flowing **in**, which Dhow models as
**attested receivables** (`Receivable`, reusing the EAS proof primitive).

- A **verified** receivable (on-chain attestation) can **secure** an advance →
  self-liquidating, low LGD.
- Without one, the line is **unsecured** and small → high LGD.

The model degrades cleanly between the two, so it's honest today and gets
stronger as receivables arrive.

---

## 4. The five layers

### Layer 1 — Gates (eligibility)

Binary knockouts. Any one fails → no offer, regardless of score:

| Gate | Rule |
|---|---|
| KYB | business verification complete |
| Settlement history | at least one arm's-length settled payment |
| Tenure | account ≥ **21 days** old (anti-flash) |
| Independence | ≥ **2** distinct counterparties |
| Circular flow | **no** settlement routed to an ownership-linked wallet |
| Active default | not currently in default |

Settlements to ownership-linked wallets are **excluded** from every calculation,
so wash-trading earns nothing *and* trips the circular-flow gate.

### Layer 2 — Grade (the PD proxy)

A 0–100 score from seven weighted factors, then mapped to a grade and a modelled
annual default rate:

| Factor | Max pts | What it measures |
|---|---|---|
| Settled history | 20 | breadth of track record (saturates at 6 settlements) |
| Proof performance | 25 | clean releases vs disputes/refunds |
| Cashflow stability | 15 | low month-to-month volatility |
| Trajectory | 10 | recent 90d vs prior 90d throughput (decline is penalised) |
| Counterparty mix | 10 | concentration across suppliers (1 − HHI) |
| Cadence | 10 | recency of last settlement |
| Tenure | 10 | months on platform (caps at 12) |

| Score ≥ | Grade | Modelled annual PD |
|---|---|---|
| 85 | A | 1% |
| 70 | B | 3% |
| 55 | C | 7% |
| 40 | D | 15% |
| 0 | E | 30% |

(PDs are illustrative-but-plausible SME trade-credit defaults; calibrate against
real outcomes as they accumulate.)

### Layer 3 — Limit (capacity)

Two independent lines, summed:

- **Unsecured** = `avg monthly throughput × grade factor × tenure ramp × concentration haircut`.
  Grade factor: A 50%, B 35%, C 20%, D 10%, E 0%. The tenure ramp reaches full
  size only after ~6 months, so thin files start small (cold-start + Sybil cost).
- **Secured** = `verified receivables due within tenor × 80%` advance rate (the
  20% haircut covers dilution/dispute).

### Layer 4 — Price (risk-based APR)

```
APR = base(8%) + Expected-Loss premium,   where premium = PD × blended-LGD
```

Blended LGD mixes the secured (30%) and unsecured (85%) portions by their share
of the limit. Attaching a verified receivable raises the secured share → lowers
blended LGD → lowers both the price and the expected loss.

### Layer 5 — Structure (the LGD controls)

The terms that make a default cost less:

- **Repayment sweep** — % of future on-rail inflow auto-swept to repay (worse
  grades sweep more: A 10% … D 30%).
- **Reserve** — holdback per advance (5% if secured, 10% if not).
- **Max tenor** — the advance must self-liquidate within this window.
- **Secured-by-receivable** flag.

---

## 5. Health factor (watching a *live* advance)

Layers 1–5 underwrite at **origination**. Once money is out, the **health
factor** is the runtime monitor — a single coverage ratio, recomputable from the
same public facts (`advanceHealth()` in `lib/credit.ts`):

```
       Σ(verified receivable × 80% × overdue-decay) + reserve held
HF  =  ──────────────────────────────────────────────────────────
                       outstanding advance + fee
```

| HF | Band | Action (a workflow, not a seizure) |
|---|---|---|
| ≥ 1.30 | healthy | on track |
| ≥ 1.15 | watch | hold new advances, monitor |
| ≥ 1.00 | tight | tighten the sweep, request a fresh verified receivable |
| < 1.00 | impaired | draw the reserve, flag the financier |

**Key difference from DeFi:** unlike an Aave health factor, HF < 1 does **not**
auto-liquidate — trade receivables are illiquid and can't be seized and sold. So
the floor escalates a workflow rather than triggering a liquidation. A past-due
receivable decays toward zero coverage over a 30-day grace window.

---

## 6. Worked example

A grade-B importer, AED 600k/mo throughput, a verified AED 300k receivable due in
30 days, takes a 200k advance:

- **Unsecured** ≈ 600k × 35% × ramp ≈ a modest behavioural line.
- **Secured** = 300k × 80% = 240k available against the receivable.
- **Price** = 8% + (3% PD × low blended LGD) → a low single-digit premium.
- **Live HF** = 240k cover ÷ ~203k owed ≈ **1.18× → watch**; add the 5% reserve
  (10k) and it clears **1.23×**. If the receivable goes 15 days overdue, cover
  halves and HF drops into **tight**, surfacing the action before maturity.

---

## 7. For the smart-contract dev — how to get clarity

You own the on-chain side (`DhowScoreRegistry`, `DhowEscrow`). Here's how to map
this model to it and verify parity.

**What's already yours, on-chain.** `DhowScoreRegistry._score` is the behaviour
score. **It is not obsolete** — it's the *character* input to the Grade layer
(the "does this business pay its obligations" half). Keep it.

**Why it's safe to reason about.** `lib/credit.ts` is **pure and deterministic**:
every output is a function of `(facts, now)` and nothing else — no clock reads
inside, no network, no randomness. That's the same property the registry sells
("any financier can recompute from immutable facts"). So on-chain and off-chain
numbers can be made to agree within integer rounding, exactly as `_score`
already mirrors `creditScore` (in `lib/credit.ts`).

**The two new on-chain needs** (detailed in
[`contracts/CREDIT-V2-IMPACT.md`](../contracts/CREDIT-V2-IMPACT.md)):

1. A **`Receivable` EAS schema** (`debtor`, `amount`, `dueAt`, `currency`) so a
   receivable that secures an advance is provable. `attestationUid` in the model
   already expects this.
2. A **`recordReceivable(business, amount, collected, attestationUid)`** recorder
   entrypoint so a receivable going **collected vs defaulted** is on-chain — a
   default must be as censorship-proof as a refund is today, and it's a
   *different event* from a refund (debtor failed to pay ≠ our escrow returned funds).

**Decision waiting on you:** Path A (minimal — registry stays the character
score, add the receivable schema + resolution fact; health factor stays
off-chain but recomputable) vs Path B (full on-chain assessment — registry also
stores **exposure**, which is the one datum that would make the health factor
*trustlessly* recomputable on-chain). Recommendation: **Path A now, Path B once
the model proves out.**

**How to sanity-check parity yourself:**

1. Read `_score` in `DhowScoreRegistry.sol` and the Layer-2 weights in §4 above —
   confirm history/performance/volume/cadence line up.
2. Run `npm test` (now scoped to our unit tests) — `lib/credit.test.ts` shows the
   exact inputs→outputs, including the wash-trade gate and the health-factor bands.
3. Ping with anything that doesn't reconcile; the model is small (~400 lines) and
   every constant is named at the top of `lib/credit.ts`.
