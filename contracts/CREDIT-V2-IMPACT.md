# Credit v2 — contract impact note

For the contracts dev. The off-chain credit engine just landed at `lib/credit.ts`
(PR #5). This note maps what v2 means for `DhowScoreRegistry` /
`IDhowScoreRegistry` so the on-chain side and the model stay coherent. **No
contract change is required to merge v2** — this is the roadmap, not a blocker.

## What changed off-chain

v1 (the `scoreCorridors` function, now in `lib/credit.ts`, mirrored on-chain in
`DhowScoreRegistry._score`) is a single 0–100 reputation number from settlement
facts:
`history(30) + volume(25) + performance(30) + cadence(15)`.

v2 (`lib/credit.ts`) replaces the single number with a five-layer underwrite —
`EL = PD × LGD × EAD`:

1. **Gates** — KYB, tenure, counterparty independence (Sybil/self-pay)
2. **Grade** — PD proxy, behaviour + cashflow → grade A–E
3. **Limit** — capacity sized off throughput **and attested receivables**
4. **Price** — risk-based APR
5. **Structure** — LGD controls: receivable security, repayment sweep, reserve

The new primitive is the **`Receivable`** — a verified *incoming* claim
(`debtor`, `amountAed`, `dueAt`, `attestationUid`, `status`). v1 only saw money
flowing **out** (supplier payments = *character*). Receivables are the **inflow**
(= *capacity* + repayment certainty), and they reuse the EAS proof primitive.

## How the registry maps onto v2

The on-chain registry does **not** become wrong — it gets **repositioned**. Its
settlement-fact score is precisely v2's **behaviour/character signal**, i.e. an
input to the **Grade** layer, not the whole answer. Outflow performance =
"this business pays its obligations." Keep it.

| v2 layer | Source today | On-chain status |
|---|---|---|
| Grade (behaviour half) | `DhowScoreRegistry.scoreOf` | ✅ already on-chain |
| Gates | off-chain KYB / graph | off-chain (fine) |
| Limit / Structure | attested receivables | ⚠️ **no on-chain primitive yet** |
| Health factor (runtime coverage) | needs exposure + receivable state | ⚠️ **exposure not on-chain** |

## The two genuinely-new on-chain needs

The registry's whole selling point is "any financier can recompute from immutable
facts with no backend in the trust path." v2 keeps that promise **only if** two
new fact types become on-chain:

1. **Receivable attestation (EAS schema).** A receivable that secures an advance
   must be provable. Add a `Receivable` EAS schema (`debtor`, `amount`, `dueAt`,
   `currency`) alongside the existing shipment-proof schema. `attestationUid` in
   `lib/credit.ts` already expects this.

2. **Receivable resolution as a settlement fact.** A receivable going
   `collected` vs `defaulted` is a first-class credit event — a default must be
   as censorship-proof as a refund is today. It is **distinct from a refund**
   (refund = our escrow returned funds; default = a third-party debtor failed to
   pay). The registry currently can't represent it.

## Decision for the contracts dev — two paths

**Path A — minimal, recommended now (additive, no rewrite):**
- Keep `DhowScoreRegistry` as the on-chain *character* score, unchanged.
- Add the `Receivable` EAS schema.
- Extend `IDhowScoreRegistry` with one recorder entrypoint so resolutions are on-chain:
  ```solidity
  /// debtor failed (success=false) or paid (success=true) an attested receivable
  function recordReceivable(address business, uint256 amount, bool collected, bytes32 attestationUid) external;
  ```
  Store it as new `Stats` fields (`receivableCollectedCount`, `receivableDefaultedCount`,
  `receivableVolume`). v2 Grade/Structure can then be recomputed on-chain-derivable.
- **Health factor stays off-chain** for now; it's recomputable by a financier from
  (registry score) + (EAS receivable attestations) + (escrow events). Honest, no new trust.

**Path B — full on-chain v2 (defer until v2 is validated):**
- Registry stores **exposure** (outstanding advance / EAD) and emits grade/limit,
  making the *entire* underwrite **and** the health factor trustlessly recomputable
  on-chain. Bigger surface (escrow must report advance draw/repay to the registry),
  so not worth it until the off-chain model has proven out.

## Health factor — the one thing Path B unlocks

We're adding a runtime **health factor** (coverage ratio on an active advance):

```
HF = Σ(receivable × debtor_haircut × tenor_factor) + reserve_collected
     ───────────────────────────────────────────────────────────────
                 outstanding_advance + accrued_fees
```

Unlike Aave, HF < 1 does **not** auto-liquidate (receivables are illiquid) — it
escalates a remediation ladder (pause advances → tighten sweep / request fresh
receivable → draw reserve). To make HF **trustlessly** recomputable, the registry
would need on-chain **exposure** — that's the single new datum behind Path B.
Until then, HF is computed off-chain in `lib/credit.ts` and is recomputable by any
financier from the public facts.

## TL;DR

- v1 registry is **not** obsolete — it's now the *character* input to v2's Grade.
- Merge v2 freely; **no contract change gates it**.
- Next contract work = **Path A**: a `Receivable` EAS schema + a `recordReceivable`
  recorder entrypoint so receivable defaults are censorship-proof.
- Path B (on-chain exposure → trustless health factor) waits until v2 proves out.
