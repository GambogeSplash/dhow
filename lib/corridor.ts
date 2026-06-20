/*
 * Dhow corridor engine
 * --------------------
 * The underwriting primitive, in code. A Credit Score is a transparent
 * function of REAL settled payments — so a working-capital offer can be shown
 * to derive from settlements, not asserted. Keep this pure and chain-agnostic;
 * the Polygon settlement layer swaps in at the edges (txHash, on-chain proof).
 */

export const AED_PER_USD = 3.6725; // CBUAE peg, fixed

export type SettlementMode = "open" | "prooflock";

export type SettlementStatus =
  | "draft" // composed, not yet sent
  | "locked" // prooflock: funds escrowed, awaiting proof
  | "settled" // released to supplier, on-chain confirmed
  | "refunded"; // prooflock: timed out / disputed, returned to buyer

export type ProofStatus = "awaiting" | "attested" | "failed";

/** On-chain write lifecycle for a corridor's settlement action. "confirmed"
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

export interface Corridor {
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

export interface CorridorScore {
  score: number; // 0..100
  tier: ScoreTier;
  eligible: boolean;
  factors: ScoreFactor[];
  settledCount: number;
  trailingValueAed: number; // settled value, trailing window
  avgCorridorAed: number;
  proofMetRatio: number;
}

export const ELIGIBLE_THRESHOLD = 70;
export const PREFERRED_THRESHOLD = 88;

function usdc(amountAed: number): number {
  return Math.round((amountAed / AED_PER_USD) * 100) / 100;
}

export function makeCorridorUsdc(amountAed: number): number {
  return usdc(amountAed);
}

/**
 * Score is built only from SETTLED corridors. Each factor is independently
 * legible so the UI can show the derivation.
 */
export function scoreCorridors(
  corridors: Corridor[],
  now: number = Date.now(),
): CorridorScore {
  // A settlement whose on-chain write failed is not creditworthy evidence.
  const settled = corridors.filter(
    (c) => c.status === "settled" && c.txState !== "failed",
  );
  const settledCount = settled.length;
  const trailingValueAed = settled.reduce((s, c) => s + c.amountAed, 0);
  const avgCorridorAed = settledCount ? trailingValueAed / settledCount : 0;

  // performance: of prooflocks, how many released cleanly (settled) vs refunded
  const prooflocks = corridors.filter((c) => c.mode === "prooflock");
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
        : "no disputes",
      points: round1(proofMetRatio * 30),
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

  const score = Math.round(factors.reduce((s, f) => s + f.points, 0));
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
    avgCorridorAed,
    proofMetRatio,
  };
}

/**
 * Working-capital advance sized to bridge one typical shipment's cash gap.
 * A fraction of the average settlement, scaled by score tier. Capital-light:
 * Dhow surfaces this to a financier; it does not lend its own balance sheet.
 */
export function advanceOffer(s: CorridorScore): number {
  if (!s.eligible) return 0;
  const rate = s.tier === "preferred" ? 0.2 : 0.15;
  const raw = s.avgCorridorAed * rate;
  return Math.max(0, Math.round(raw / 1000) * 1000); // round to nearest AED 1,000
}

// ---- formatting helpers ----

export function aed(n: number): string {
  return `AED ${Math.round(n).toLocaleString("en-US")}`;
}

export function usdcLabel(n: number): string {
  return `${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
