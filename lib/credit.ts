/*
 * Dhow credit model
 * =================
 * One credit system, two layers. The first is a behaviour score (`creditScore`,
 * in the domain foundation below): a single 0–100 reputation number from settled
 * payments, mirrored on-chain. On its own that conflates three different
 * underwriting questions and can be gamed by paying yourself, so the second
 * layer (`assessCredit`) consumes it as a character signal and decides the line
 * with the decomposition a real trade-finance risk team uses — Expected Loss =
 * PD × LGD × EAD — expressed as five layers:
 *
 *   1. GATES      binary knockouts (KYB, tenure, counterparty independence)
 *   2. GRADE      a PD proxy: behaviour + cashflow → grade A–E → expected default
 *   3. LIMIT      capacity: sized off THROUGHPUT and attested RECEIVABLES,
 *                 not average deal size; graduated for thin files
 *   4. PRICE      risk-based APR: cost + expected loss + margin
 *   5. STRUCTURE  the LGD controls: receivable security, repayment sweep, reserve
 *
 * Design stance on data: Dhow sees money flowing OUT (supplier payments). That
 * is a CHARACTER signal — "this business pays its obligations" — not a capacity
 * signal. Capacity and repayment certainty come from INFLOWS, which we model as
 * attested `Receivable`s (reusing the EAS proof primitive). When a receivable is
 * attached, the advance is self-liquidating and secured (low LGD); when it is
 * not, the line is unsecured and small (high LGD). The model degrades cleanly
 * between the two, so it is honest today and stronger as receivables arrive.
 *
 * Keep this pure and deterministic: every output is a function of the facts plus
 * `now`, so a financier can recompute it independently.
 */

// ===========================================================================
// Domain foundation
// ---------------------------------------------------------------------------
// The payment primitive, currency utilities, and the behaviour score. A
// Credit Score is a transparent function of REAL settled payments. Pure and
// chain-agnostic; the Polygon settlement layer swaps in at the edges (txHash).
// ===========================================================================

export const AED_PER_USD = 3.6725; // CBUAE peg, fixed

export type SettlementMode = "open" | "prooflock";

export type SettlementStatus =
  | "draft" // composed, not yet sent
  | "locked" // prooflock: funds escrowed, awaiting proof
  | "settled" // released to supplier, on-chain confirmed
  | "refunded"; // prooflock: timed out / disputed, returned to buyer

export type ProofStatus = "awaiting" | "attested" | "failed";

/** On-chain write lifecycle for a payment's settlement action. "confirmed"
 *  means the user's signed transaction was mined; "failed" is reached when the
 *  signing/broadcast fails, and a failed write never counts toward the score. */
export type TxState = "pending" | "confirmed" | "failed";

export interface Counterparty {
  id: string;
  name: string;
  city: string;
  country: string;
  walletAddress?: string; // on-chain address settlements are sent to
}

export interface Payment {
  id: string;
  ref: string; // human ref, e.g. DHW-0412
  supplier: Counterparty;
  goods: string;
  amountAed: number;
  amountUsdc: number; // amountAed / AED_PER_USD
  mode: SettlementMode;
  status: SettlementStatus;
  proof?: {
    status: ProofStatus;
    label: string; // e.g. "Bill of lading — Jebel Ali inbound"
    attestedBy?: string;
  };
  createdAt: number; // ms epoch
  settledAt?: number;
  txHash?: string; // real Amoy tx hash when wired, synthetic when simulated
  explorerUrl?: string; // polygonscan link when on-chain
  txState?: TxState; // settlement write lifecycle
}

export interface Importer {
  id: string;
  name: string;
  city: string;
  country: string;
  walletPreview: string;
}

export interface Financier {
  id: string;
  name: string;
  blurb: string;
  appetiteAed: number; // max single facility
}

export type ScoreTier = "establishing" | "eligible" | "preferred";

export interface ScoreFactor {
  key: "history" | "volume" | "performance" | "cadence";
  label: string;
  detail: string;
  points: number; // earned
  max: number;
}

export interface CreditScore {
  score: number; // 0..100
  tier: ScoreTier;
  eligible: boolean;
  factors: ScoreFactor[];
  settledCount: number;
  trailingValueAed: number; // settled value, trailing window
  avgPaymentAed: number;
  proofMetRatio: number;
}

export const ELIGIBLE_THRESHOLD = 70;
export const PREFERRED_THRESHOLD = 88;

function usdc(amountAed: number): number {
  return Math.round((amountAed / AED_PER_USD) * 100) / 100;
}

export function makeUsdc(amountAed: number): number {
  return usdc(amountAed);
}

/**
 * Behaviour score — built only from SETTLED payments, each factor independently
 * legible so the UI can show the derivation. This is the character signal that
 * feeds the grade in `assessCredit`, not the whole underwrite. Also mirrored
 * on-chain in DhowScoreRegistry.
 */
export function creditScore(
  payments: Payment[],
  now: number = Date.now(),
): CreditScore {
  // A settlement whose on-chain write failed is not creditworthy evidence.
  const settled = payments.filter(
    (c) => c.status === "settled" && c.txState !== "failed",
  );
  const settledCount = settled.length;
  const trailingValueAed = settled.reduce((s, c) => s + c.amountAed, 0);
  const avgPaymentAed = settledCount ? trailingValueAed / settledCount : 0;

  // performance: of prooflocks, how many released cleanly (settled) vs refunded
  const prooflocks = payments.filter((c) => c.mode === "prooflock");
  const prooflockResolved = prooflocks.filter(
    (c) => c.status === "settled" || c.status === "refunded",
  );
  const prooflockClean = prooflocks.filter((c) => c.status === "settled");
  const proofMetRatio = prooflockResolved.length
    ? prooflockClean.length / prooflockResolved.length
    : 1; // no prooflocks yet → no negative signal

  // recency / cadence: reward recent settlement against real elapsed time
  const lastSettledAt = settled.length
    ? Math.max(...settled.map((c) => c.settledAt ?? 0))
    : 0;
  const daysSinceLast = settled.length
    ? Math.max(0, (now - lastSettledAt) / 86_400_000)
    : 999;
  const cadence = settled.length >= 2 ? clamp01(1 - daysSinceLast / 45) : settled.length / 2;

  const factors: ScoreFactor[] = [
    {
      key: "history",
      label: "Settled history",
      detail: `${settledCount} settlement${settledCount === 1 ? "" : "s"}`,
      points: round1((Math.min(settledCount, 6) / 6) * 30),
      max: 30,
    },
    {
      key: "volume",
      label: "Trailing volume",
      detail: aed(trailingValueAed),
      points: round1(clamp01(trailingValueAed / 1_000_000) * 25),
      max: 25,
    },
    {
      key: "performance",
      label: "Proof performance",
      detail: prooflockResolved.length
        ? `${prooflockClean.length}/${prooflockResolved.length} released clean`
        : settledCount
          ? "no disputes"
          : "—",
      // Clean-performance points are EARNED by settling at least once. A brand-new
      // business with no settlements has no track record, so it scores 0 here
      // rather than getting full marks for the absence of disputes.
      points: round1((settledCount > 0 ? proofMetRatio : 0) * 30),
      max: 30,
    },
    {
      key: "cadence",
      label: "Cadence",
      detail: settledCount ? `${Math.round(daysSinceLast)}d since last` : "—",
      points: round1(cadence * 15),
      max: 15,
    },
  ];

  const score = Math.round(factors.reduce((s, fac) => s + fac.points, 0));
  const tier: ScoreTier =
    score >= PREFERRED_THRESHOLD
      ? "preferred"
      : score >= ELIGIBLE_THRESHOLD
        ? "eligible"
        : "establishing";

  return {
    score,
    tier,
    eligible: score >= ELIGIBLE_THRESHOLD,
    factors,
    settledCount,
    trailingValueAed,
    avgPaymentAed,
    proofMetRatio,
  };
}

/**
 * Working-capital advance sized to bridge one typical shipment's cash gap.
 * A fraction of the average settlement, scaled by score tier. Capital-light:
 * Dhow surfaces this to a financier; it does not lend its own balance sheet.
 */
export function advanceOffer(s: CreditScore): number {
  if (!s.eligible) return 0;
  const rate = s.tier === "preferred" ? 0.2 : 0.15;
  const raw = s.avgPaymentAed * rate;
  return Math.max(0, Math.round(raw / 1000) * 1000); // round to nearest AED 1,000
}

// ---- formatting helpers ----

export function aed(n: number): string {
  return `AED ${Math.round(n).toLocaleString("en-US")}`;
}

export function usdcLabel(n: number): string {
  return `${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// ===========================================================================
// Credit assessment — the underwriting decision built on the foundation above.
// ===========================================================================

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/** Verified incoming claim — the missing capacity + repayment source. A
 *  receivable with an attestationUid is "verified" (proof on chain) and can
 *  secure an advance; without one it is "expected" and informational only. */
export interface Receivable {
  id: string;
  debtor: Counterparty;
  amountAed: number;
  dueAt: number; // ms epoch
  attestationUid?: string; // EAS proof of the obligation; absent ⇒ unverified
  status: "expected" | "verified" | "collected" | "defaulted";
}

/** Identity facts that drive the eligibility gates. */
export interface BusinessProfile {
  kybVerified: boolean;
  onboardedAt: number; // ms epoch — platform tenure start
  /** Counterparty ids the fund-flow graph found to be ownership-linked to this
   *  business (money loops back). Empty in the common case; populated by the
   *  Sybil/graph check. Any settlement to these is excluded as non-arm's-length. */
  linkedCounterpartyIds?: string[];
  inActiveDefault?: boolean;
}

export interface CreditInput {
  profile: BusinessProfile;
  payments: Payment[];
  receivables?: Receivable[];
  now?: number;
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

export type Grade = "A" | "B" | "C" | "D" | "E";

export type GateReason =
  | "kyb_incomplete"
  | "no_settlement_history"
  | "insufficient_tenure"
  | "too_few_counterparties"
  | "circular_fund_flow"
  | "active_default";

export interface GradeFactor {
  key: "history" | "performance" | "stability" | "trajectory" | "diversity" | "cadence" | "tenure";
  label: string;
  detail: string;
  points: number;
  max: number;
}

export interface CreditAssessment {
  /** Layer 1 — eligibility. `false` ⇒ no offer regardless of score. */
  eligible: boolean;
  gateFailures: GateReason[];

  /** Layer 2 — PD proxy. */
  score: number; // 0..100, the continuous grade input
  grade: Grade;
  pd: number; // modelled annual probability of default for the grade (0..1)
  factors: GradeFactor[];

  /** Layer 3 — capacity. */
  limitAed: number; // total approved line
  securedLimitAed: number; // portion backed by verified receivables
  unsecuredLimitAed: number; // portion backed by behaviour only

  /** Layer 4 — price. */
  aprPct: number; // risk-based annual rate
  lgd: number; // blended loss-given-default (0..1)

  /** Layer 5 — structure / controls. */
  structure: {
    repaymentSweepPct: number; // % of future on-rail inflow auto-swept to repay
    reservePct: number; // holdback on each advance
    maxTenorDays: number; // advance must self-liquidate within this
    securedByReceivable: boolean;
  };

  /** Plain-language reason codes (adverse-action ready). */
  reasons: string[];
}

// ---------------------------------------------------------------------------
// Constants — every weight, threshold and grade calibration in one place.
// ---------------------------------------------------------------------------

const ELIGIBLE_MIN_TENURE_DAYS = 21; // anti-flash: a real track record takes time
const ELIGIBLE_MIN_COUNTERPARTIES = 2; // independence: never lend off a single relationship
const HISTORY_CAP = 6; // settlements for full history credit
const VOLUME_CAP_AED = 1_000_000; // trailing-volume reference
const CADENCE_WINDOW_DAYS = 45;

// Grade calibration: score band → grade → modelled annual PD. PDs are
// illustrative-but-plausible SME trade-credit defaults, steepening down-grade.
const GRADE_TABLE: { grade: Grade; min: number; pd: number }[] = [
  { grade: "A", min: 85, pd: 0.01 },
  { grade: "B", min: 70, pd: 0.03 },
  { grade: "C", min: 55, pd: 0.07 },
  { grade: "D", min: 40, pd: 0.15 },
  { grade: "E", min: 0, pd: 0.3 },
];

// Capacity factors per grade: fraction of monthly throughput offered unsecured.
const UNSECURED_THROUGHPUT_FACTOR: Record<Grade, number> = {
  A: 0.5,
  B: 0.35,
  C: 0.2,
  D: 0.1,
  E: 0,
};

// Advance rate against a VERIFIED receivable (haircut for dilution/dispute).
const RECEIVABLE_ADVANCE_RATE = 0.8;

// LGD assumptions: a receivable-secured advance recovers far better than an
// unsecured behavioural line.
const LGD_SECURED = 0.3;
const LGD_UNSECURED = 0.85;

// Pricing: base covers cost-of-capital + ops + margin; risk premium = EL.
const APR_BASE_PCT = 8;

// Health factor — runtime coverage on a LIVE advance. Banding mirrors the
// remediation ladder: open conservative, escalate as coverage decays. Unlike a
// DeFi health factor, HF < 1 does not auto-liquidate (receivables are illiquid)
// — it triggers a workflow, so the floor is a flag, not a seizure.
const HF_HEALTHY = 1.3; // ≥ this: on track
const HF_WATCH = 1.15; // ≥ this: monitor, hold new advances
const HF_FLOOR = 1.0; // ≥ this: tight; below: impaired
const OVERDUE_GRACE_DAYS = 30; // a past-due receivable decays to zero coverage over this

// ---------------------------------------------------------------------------
// The model
// ---------------------------------------------------------------------------

export function assessCredit(input: CreditInput): CreditAssessment {
  const now = input.now ?? Date.now();
  const linked = new Set(input.profile.linkedCounterpartyIds ?? []);

  // Arm's-length settled payments only: drop failed writes AND any settlement
  // to an ownership-linked counterparty (self-dealing earns no credit).
  const settled = input.payments.filter(
    (c) =>
      c.status === "settled" &&
      c.txState !== "failed" &&
      !linked.has(c.supplier.id),
  );
  const refunded = input.payments.filter((c) => c.status === "refunded");

  // ---- shared aggregates -------------------------------------------------
  const settledCount = settled.length;
  const trailingValueAed = settled.reduce((s, c) => s + c.amountAed, 0);
  const distinctCounterparties = new Set(settled.map((c) => c.supplier.id)).size;
  const tenureDays = (now - input.profile.onboardedAt) / 86_400_000;
  const lastSettledAt = settledCount
    ? Math.max(...settled.map((c) => c.settledAt ?? 0))
    : 0;
  const daysSinceLast = settledCount ? Math.max(0, (now - lastSettledAt) / 86_400_000) : Infinity;

  // ---- LAYER 1: eligibility gates ---------------------------------------
  const gateFailures: GateReason[] = [];
  if (!input.profile.kybVerified) gateFailures.push("kyb_incomplete");
  if (settledCount === 0) gateFailures.push("no_settlement_history");
  if (tenureDays < ELIGIBLE_MIN_TENURE_DAYS) gateFailures.push("insufficient_tenure");
  if (distinctCounterparties < ELIGIBLE_MIN_COUNTERPARTIES)
    gateFailures.push("too_few_counterparties");
  // Circular flow: any settlement routed to a linked wallet is a hard stop.
  if (input.payments.some((c) => c.status === "settled" && linked.has(c.supplier.id)))
    gateFailures.push("circular_fund_flow");
  if (input.profile.inActiveDefault) gateFailures.push("active_default");
  const eligible = gateFailures.length === 0;

  // ---- LAYER 2: grade (PD proxy) ----------------------------------------
  // history (20): breadth of track record, saturating at HISTORY_CAP.
  const history = (Math.min(settledCount, HISTORY_CAP) / HISTORY_CAP) * 20;

  // performance (25): clean releases vs disputes. No history ⇒ 0 (no free marks).
  const resolved = settledCount + refunded.length;
  const performance = settledCount > 0 ? (settledCount / resolved) * 25 : 0;

  // stability (15): low month-to-month volatility of settled volume is safer
  // than the same average delivered lumpily.
  const monthly = monthlyVolumes(settled, now);
  const stability = clamp01(1 - coefficientOfVariation(monthly)) * 15;

  // trajectory (10): recent 90d throughput vs the prior 90d. Decline is the
  // single strongest early-warning sign, so it is penalised, not just unrewarded.
  const traj = trajectoryRatio(settled, now); // 0.5 flat, >0.5 growing, <0.5 shrinking
  const trajectory = clamp01(traj) * 10;

  // diversity (10): concentration across counterparties (1 - HHI). One supplier
  // for everything is fragile even when behaviour looks perfect.
  const diversity = (1 - herfindahl(settled)) * 10;

  // cadence (10): recency decay against real elapsed time.
  const cadence =
    settledCount >= 2
      ? clamp01(1 - daysSinceLast / CADENCE_WINDOW_DAYS) * 10
      : (settledCount / 2) * 10;

  // tenure (10): months on platform, capped at 12.
  const tenure = clamp01(tenureDays / 365) * 10;

  const factors: GradeFactor[] = [
    f("history", "Settled history", `${settledCount} settlement${settledCount === 1 ? "" : "s"}`, history, 20),
    f("performance", "Proof performance", resolved ? `${settledCount}/${resolved} released clean` : "—", performance, 25),
    f("stability", "Cashflow stability", monthly.length >= 2 ? `${monthly.length} active months` : "thin", stability, 15),
    f("trajectory", "Trajectory", traj > 0.55 ? "growing" : traj < 0.45 ? "slowing" : "steady", trajectory, 10),
    f("diversity", "Counterparty mix", `${distinctCounterparties} counterpart${distinctCounterparties === 1 ? "y" : "ies"}`, diversity, 10),
    f("cadence", "Cadence", settledCount ? `${Math.round(daysSinceLast)}d since last` : "—", cadence, 10),
    f("tenure", "Tenure", `${Math.round(tenureDays)}d on platform`, tenure, 10),
  ];

  const score = Math.round(factors.reduce((s, x) => s + x.points, 0));
  const { grade, pd } = gradeFor(score);

  // ---- LAYER 3: limit (capacity) ----------------------------------------
  const avgMonthlyVolume = monthly.length ? mean(monthly) : 0;

  // Unsecured line: a fraction of monthly throughput, scaled by grade, then
  // graduated by tenure so thin files start small (cold-start + Sybil cost).
  const tenureRamp = clamp01(tenureDays / 180); // full size only after ~6 months
  const concentrationHaircut = 1 - Math.max(0, herfindahl(settled) - 0.5); // penalise >50% HHI
  let unsecuredLimitAed = eligible
    ? avgMonthlyVolume * UNSECURED_THROUGHPUT_FACTOR[grade] * tenureRamp * concentrationHaircut
    : 0;
  unsecuredLimitAed = roundTo(unsecuredLimitAed, 1000);

  // Secured line: advance against verified receivables due within tenor. This is
  // the self-liquidating, low-LGD path the model is built to reward.
  const verifiedReceivables = (input.receivables ?? []).filter(
    (r) => r.status === "verified" && !!r.attestationUid,
  );
  const eligibleReceivableValue = verifiedReceivables.reduce((s, r) => s + r.amountAed, 0);
  const securedLimitAed = eligible ? roundTo(eligibleReceivableValue * RECEIVABLE_ADVANCE_RATE, 1000) : 0;

  const limitAed = securedLimitAed + unsecuredLimitAed;

  // ---- LAYER 4: price (risk-based) --------------------------------------
  const securedShare = limitAed > 0 ? securedLimitAed / limitAed : 0;
  const lgd = LGD_SECURED * securedShare + LGD_UNSECURED * (1 - securedShare);
  const expectedLossPct = pd * lgd * 100;
  const aprPct = eligible ? roundTo(APR_BASE_PCT + expectedLossPct, 0.25) : 0;

  // ---- LAYER 5: structure ----------------------------------------------
  const structure = {
    // Worse grades repay a larger share of inflow per cycle (de-risk faster).
    repaymentSweepPct: { A: 10, B: 15, C: 20, D: 30, E: 0 }[grade],
    reservePct: securedShare > 0 ? 5 : 10,
    maxTenorDays: securedLimitAed > 0 ? receivableTenorDays(verifiedReceivables, now) : 60,
    securedByReceivable: securedLimitAed > 0,
  };

  return {
    eligible,
    gateFailures,
    score,
    grade,
    pd,
    factors,
    limitAed,
    securedLimitAed,
    unsecuredLimitAed,
    aprPct,
    lgd: roundTo(lgd, 0.01),
    structure,
    reasons: reasonCodes(eligible, gateFailures, factors, grade, structure.securedByReceivable),
  };
}

// ---------------------------------------------------------------------------
// Health factor — runtime coverage on a live advance
// ---------------------------------------------------------------------------
// `assessCredit` underwrites a deal at ORIGINATION. Once money is out, nothing
// there tells you the position is decaying. The health factor is that missing
// runtime monitor: a single coverage ratio that updates as receivables are
// attested, collected, default, or fall overdue — recomputable by a financier
// from the same public facts.

export type HealthBand = "healthy" | "watch" | "tight" | "impaired";

export interface AdvanceHealthInput {
  /** What is still owed on the advance (principal + accrued fee) — the EAD. */
  outstandingAed: number;
  /** Receivables backing this advance. Only verified ones secure it; the rest
   *  are informational, exactly as in the limit calc. */
  receivables?: Receivable[];
  /** Holdback already captured by the financier — counts toward coverage. */
  reserveHeldAed?: number;
  /** When the advance itself is due. Past it, the position is overdue (a flag,
   *  not part of the ratio). */
  dueAt?: number;
  now?: number;
}

export interface HealthContribution {
  receivableId: string;
  debtor: string;
  faceAed: number;
  countedAed: number; // face after advance-rate + overdue haircuts
  haircutPct: number; // 1 - counted/face, as a percentage
  note: string;
}

export interface AdvanceHealth {
  /** Coverage ÷ exposure. `Infinity` when nothing is outstanding (repaid). */
  hf: number;
  band: HealthBand;
  exposureAed: number;
  coverageAed: number; // discounted receivables + reserve held
  reserveAed: number;
  overdueDays: number; // how late the advance itself is (0 if not due/early)
  contributions: HealthContribution[];
  /** The remediation step for this band — the workflow, not a liquidation. */
  action: string;
  headline: string;
}

/** Coverage ratio on a live advance. Pure: a function of the facts + `now`, so a
 *  financier recomputes it independently. HF < 1 escalates a workflow (pause →
 *  tighten sweep → draw reserve), it does not seize — receivables are illiquid. */
export function advanceHealth(input: AdvanceHealthInput): AdvanceHealth {
  const now = input.now ?? Date.now();
  const exposureAed = Math.max(0, Math.round(input.outstandingAed));
  const reserveAed = Math.max(0, Math.round(input.reserveHeldAed ?? 0));

  const contributions: HealthContribution[] = [];
  let receivableCoverage = 0;
  for (const r of input.receivables ?? []) {
    // Only a verified, on-chain-attested receivable secures the advance. Others
    // are informational (collected ⇒ already swept; defaulted ⇒ worth nothing).
    const secures = r.status === "verified" && !!r.attestationUid;
    const overdueDays = Math.max(0, (now - r.dueAt) / 86_400_000);
    const overdueFactor = clamp01(1 - overdueDays / OVERDUE_GRACE_DAYS);
    const counted = secures ? r.amountAed * RECEIVABLE_ADVANCE_RATE * overdueFactor : 0;
    receivableCoverage += counted;
    contributions.push({
      receivableId: r.id,
      debtor: r.debtor.name,
      faceAed: Math.round(r.amountAed),
      countedAed: Math.round(counted),
      haircutPct: r.amountAed > 0 ? roundTo((1 - counted / r.amountAed) * 100, 1) : 100,
      note: !secures
        ? r.status === "defaulted"
          ? "defaulted — no value"
          : r.status === "collected"
            ? "collected — already swept"
            : "unverified — not counted"
        : overdueDays > 0
          ? `${Math.round(overdueDays)}d overdue — discounted`
          : "verified · advance-rate haircut",
    });
  }

  const coverageAed = Math.round(receivableCoverage + reserveAed);
  const hf = exposureAed > 0 ? coverageAed / exposureAed : Infinity;
  const overdueDays =
    input.dueAt && now > input.dueAt ? Math.round((now - input.dueAt) / 86_400_000) : 0;

  const band: HealthBand =
    hf >= HF_HEALTHY ? "healthy" : hf >= HF_WATCH ? "watch" : hf >= HF_FLOOR ? "tight" : "impaired";

  return {
    hf,
    band,
    exposureAed,
    coverageAed,
    reserveAed,
    overdueDays,
    contributions,
    action: healthAction(band, overdueDays),
    headline: exposureAed === 0 ? "Repaid — no exposure" : `${hf.toFixed(2)}× covered`,
  };
}

function healthAction(band: HealthBand, overdueDays: number): string {
  if (band === "impaired")
    return "Coverage below 1.0× — draw the reserve and flag the financier.";
  if (band === "tight")
    return "Tighten the repayment sweep and request a fresh verified receivable.";
  if (band === "watch") return "Monitor; hold new advances against this borrower.";
  return overdueDays > 0 ? "Covered, but the advance is past due — confirm repayment." : "On track.";
}

// ---------------------------------------------------------------------------
// Feature helpers — pure, deterministic.
// ---------------------------------------------------------------------------

/** Settled volume bucketed by calendar month, most-recent-first, dropping
 *  empty months so the variation reflects active trading. */
function monthlyVolumes(settled: Payment[], now: number): number[] {
  const buckets = new Map<number, number>();
  for (const c of settled) {
    const t = c.settledAt ?? now;
    const key = monthKey(t);
    buckets.set(key, (buckets.get(key) ?? 0) + c.amountAed);
  }
  return [...buckets.entries()].sort((a, b) => b[0] - a[0]).map(([, v]) => v);
}

function monthKey(ms: number): number {
  const d = new Date(ms);
  return d.getUTCFullYear() * 12 + d.getUTCMonth();
}

/** Recent-90d vs prior-90d throughput, squashed to 0..1 around 0.5 = flat. */
function trajectoryRatio(settled: Payment[], now: number): number {
  const window = 90 * 86_400_000;
  let recent = 0;
  let prior = 0;
  for (const c of settled) {
    const age = now - (c.settledAt ?? now);
    if (age <= window) recent += c.amountAed;
    else if (age <= 2 * window) prior += c.amountAed;
  }
  if (recent === 0 && prior === 0) return 0.5;
  if (prior === 0) return 1; // all-new flow reads as growth
  // ratio 1 ⇒ 0.5, ratio 2+ ⇒ →1, ratio 0 ⇒ →0
  const r = recent / prior;
  return clamp01(r / (r + 1) + 0.0); // 1→0.5, 2→0.667, 0.5→0.333
}

/** Herfindahl concentration index over counterparties: 0 = perfectly diverse,
 *  1 = a single counterparty. */
function herfindahl(settled: Payment[]): number {
  const total = settled.reduce((s, c) => s + c.amountAed, 0);
  if (total === 0) return 1;
  const byCp = new Map<string, number>();
  for (const c of settled) byCp.set(c.supplier.id, (byCp.get(c.supplier.id) ?? 0) + c.amountAed);
  let hhi = 0;
  for (const v of byCp.values()) hhi += (v / total) ** 2;
  return hhi;
}

function coefficientOfVariation(xs: number[]): number {
  if (xs.length < 2) return 1; // too thin to call it stable → treat as volatile
  const m = mean(xs);
  if (m === 0) return 1;
  const variance = xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length;
  return Math.sqrt(variance) / m;
}

function receivableTenorDays(rs: Receivable[], now: number): number {
  if (!rs.length) return 60;
  const furthest = Math.max(...rs.map((r) => r.dueAt));
  return Math.max(7, Math.round((furthest - now) / 86_400_000));
}

function gradeFor(score: number): { grade: Grade; pd: number } {
  const row = GRADE_TABLE.find((g) => score >= g.min) ?? GRADE_TABLE[GRADE_TABLE.length - 1];
  return { grade: row.grade, pd: row.pd };
}

function reasonCodes(
  eligible: boolean,
  gates: GateReason[],
  factors: GradeFactor[],
  grade: Grade,
  secured: boolean,
): string[] {
  if (!eligible) return gates.map(gateLabel);
  const weakest = [...factors].sort((a, b) => a.points / a.max - b.points / b.max).slice(0, 2);
  const out = [`Grade ${grade}.`];
  out.push(secured ? "Advance secured by a verified receivable." : "Unsecured line — attach a verified receivable to increase it.");
  for (const w of weakest) out.push(`Improve: ${w.label.toLowerCase()} (${Math.round((w.points / w.max) * 100)}% of max).`);
  return out;
}

function gateLabel(g: GateReason): string {
  switch (g) {
    case "kyb_incomplete": return "Business verification (KYB) incomplete.";
    case "no_settlement_history": return "No settled payments yet.";
    case "insufficient_tenure": return `Account younger than ${ELIGIBLE_MIN_TENURE_DAYS} days.`;
    case "too_few_counterparties": return `Fewer than ${ELIGIBLE_MIN_COUNTERPARTIES} independent suppliers.`;
    case "circular_fund_flow": return "Payments routed to an ownership-linked wallet.";
    case "active_default": return "An existing advance is in default.";
  }
}

// ---- tiny math/util ----
function f(key: GradeFactor["key"], label: string, detail: string, points: number, max: number): GradeFactor {
  return { key, label, detail, points: roundTo(points, 0.1), max };
}
function mean(xs: number[]): number {
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0;
}
function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
function roundTo(n: number, step: number): number {
  return Math.round(n / step) * step;
}
