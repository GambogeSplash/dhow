import { describe, it, expect } from "vitest";
import {
  scoreCorridors,
  advanceOffer,
  makeCorridorUsdc,
  AED_PER_USD,
  ELIGIBLE_THRESHOLD,
  type Corridor,
} from "./corridor";

const DAY = 86_400_000;
const NOW = 1_700_000_000_000; // fixed clock so cadence is deterministic

const supplier = { id: "sup_1", name: "Meridian", city: "Shenzhen", country: "China" };

function corridor(p: Partial<Corridor> & Pick<Corridor, "id" | "status" | "mode" | "amountAed">): Corridor {
  return {
    ref: p.ref ?? `DHW-${p.id}`,
    supplier,
    goods: "goods",
    amountUsdc: makeCorridorUsdc(p.amountAed),
    createdAt: NOW - 5 * DAY,
    ...p,
  } as Corridor;
}

describe("makeCorridorUsdc", () => {
  it("converts AED to USDC at the CBUAE peg", () => {
    expect(makeCorridorUsdc(367_250)).toBeCloseTo(100_000, 0);
    expect(makeCorridorUsdc(0)).toBe(0);
  });
  it("matches AED_PER_USD", () => {
    expect(makeCorridorUsdc(AED_PER_USD)).toBeCloseTo(1, 5);
  });
});

describe("scoreCorridors", () => {
  it("is zero and 'establishing' with no settlements", () => {
    const s = scoreCorridors([], NOW);
    expect(s.score).toBe(0);
    expect(s.tier).toBe("establishing");
    expect(s.eligible).toBe(false);
    expect(s.settledCount).toBe(0);
  });

  it("only counts settled corridors, not drafts or locks", () => {
    const s = scoreCorridors(
      [
        corridor({ id: "1", status: "draft", mode: "open", amountAed: 100_000 }),
        corridor({ id: "2", status: "locked", mode: "prooflock", amountAed: 100_000 }),
      ],
      NOW,
    );
    expect(s.settledCount).toBe(0);
    expect(s.trailingValueAed).toBe(0);
  });

  it("excludes settlements whose on-chain write failed", () => {
    const ok = corridor({ id: "1", status: "settled", mode: "open", amountAed: 200_000, settledAt: NOW - DAY, txState: "confirmed" });
    const failed = corridor({ id: "2", status: "settled", mode: "open", amountAed: 200_000, settledAt: NOW - DAY, txState: "failed" });
    const s = scoreCorridors([ok, failed], NOW);
    expect(s.settledCount).toBe(1);
    expect(s.trailingValueAed).toBe(200_000);
  });

  it("rises with settled history and volume", () => {
    const few = scoreCorridors(
      [corridor({ id: "1", status: "settled", mode: "open", amountAed: 100_000, settledAt: NOW - DAY })],
      NOW,
    );
    const many = scoreCorridors(
      Array.from({ length: 6 }, (_, i) =>
        corridor({ id: String(i), status: "settled", mode: "open", amountAed: 200_000, settledAt: NOW - DAY }),
      ),
      NOW,
    );
    expect(many.score).toBeGreaterThan(few.score);
  });

  it("crosses the eligibility threshold with a strong settled record", () => {
    const corridors = Array.from({ length: 6 }, (_, i) =>
      corridor({
        id: String(i),
        status: "settled",
        mode: "prooflock",
        amountAed: 250_000,
        settledAt: NOW - (i + 1) * DAY,
        proof: { status: "attested", label: "BoL" },
      }),
    );
    const s = scoreCorridors(corridors, NOW);
    expect(s.score).toBeGreaterThanOrEqual(ELIGIBLE_THRESHOLD);
    expect(s.eligible).toBe(true);
  });

  it("penalises proof performance when a prooflock is refunded", () => {
    const base = Array.from({ length: 3 }, (_, i) =>
      corridor({ id: `s${i}`, status: "settled", mode: "prooflock", amountAed: 200_000, settledAt: NOW - (i + 1) * DAY, proof: { status: "attested", label: "BoL" } }),
    );
    const withRefund = [
      ...base,
      corridor({ id: "r", status: "refunded", mode: "prooflock", amountAed: 200_000, proof: { status: "failed", label: "BoL" } }),
    ];
    const clean = scoreCorridors(base, NOW);
    const dinged = scoreCorridors(withRefund, NOW);
    expect(dinged.proofMetRatio).toBeLessThan(clean.proofMetRatio);
    expect(dinged.score).toBeLessThan(clean.score);
  });

  it("factor points never exceed their maxima and sum to the score", () => {
    const corridors = Array.from({ length: 10 }, (_, i) =>
      corridor({ id: String(i), status: "settled", mode: "prooflock", amountAed: 500_000, settledAt: NOW - DAY, proof: { status: "attested", label: "BoL" } }),
    );
    const s = scoreCorridors(corridors, NOW);
    for (const f of s.factors) expect(f.points).toBeLessThanOrEqual(f.max);
    const summed = Math.round(s.factors.reduce((a, f) => a + f.points, 0));
    expect(s.score).toBe(summed);
    expect(s.score).toBeLessThanOrEqual(100);
  });
});

describe("advanceOffer", () => {
  it("is zero when not eligible", () => {
    const s = scoreCorridors([], NOW);
    expect(advanceOffer(s)).toBe(0);
  });

  it("is a positive, rounded fraction of the average corridor once eligible", () => {
    const corridors = Array.from({ length: 6 }, (_, i) =>
      corridor({ id: String(i), status: "settled", mode: "prooflock", amountAed: 300_000, settledAt: NOW - (i + 1) * DAY, proof: { status: "attested", label: "BoL" } }),
    );
    const s = scoreCorridors(corridors, NOW);
    const offer = advanceOffer(s);
    expect(offer).toBeGreaterThan(0);
    expect(offer % 1000).toBe(0); // rounded to nearest AED 1,000
    expect(offer).toBeLessThan(s.avgCorridorAed); // an advance, not the whole corridor
  });
});
