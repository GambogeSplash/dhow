import { describe, it, expect } from "vitest";
import {
  creditScore,
  advanceOffer,
  makeUsdc,
  AED_PER_USD,
  ELIGIBLE_THRESHOLD,
  type Payment,
} from "./credit";

const DAY = 86_400_000;
const NOW = 1_700_000_000_000; // fixed clock so cadence is deterministic

const supplier = { id: "sup_1", name: "Meridian", city: "Shenzhen", country: "China" };

function payment(p: Partial<Payment> & Pick<Payment, "id" | "status" | "mode" | "amountAed">): Payment {
  return {
    ref: p.ref ?? `DHW-${p.id}`,
    supplier,
    goods: "goods",
    amountUsdc: makeUsdc(p.amountAed),
    createdAt: NOW - 5 * DAY,
    ...p,
  } as Payment;
}

describe("makeUsdc", () => {
  it("converts AED to USDC at the CBUAE peg", () => {
    expect(makeUsdc(367_250)).toBeCloseTo(100_000, 0);
    expect(makeUsdc(0)).toBe(0);
  });
  it("matches AED_PER_USD", () => {
    expect(makeUsdc(AED_PER_USD)).toBeCloseTo(1, 5);
  });
});

describe("creditScore", () => {
  it("is zero and 'establishing' with no settlements", () => {
    const s = creditScore([], NOW);
    expect(s.score).toBe(0);
    expect(s.tier).toBe("establishing");
    expect(s.eligible).toBe(false);
    expect(s.settledCount).toBe(0);
  });

  it("only counts settled payments, not drafts or locks", () => {
    const s = creditScore(
      [
        payment({ id: "1", status: "draft", mode: "open", amountAed: 100_000 }),
        payment({ id: "2", status: "locked", mode: "prooflock", amountAed: 100_000 }),
      ],
      NOW,
    );
    expect(s.settledCount).toBe(0);
    expect(s.trailingValueAed).toBe(0);
  });

  it("excludes settlements whose on-chain write failed", () => {
    const ok = payment({ id: "1", status: "settled", mode: "open", amountAed: 200_000, settledAt: NOW - DAY, txState: "confirmed" });
    const failed = payment({ id: "2", status: "settled", mode: "open", amountAed: 200_000, settledAt: NOW - DAY, txState: "failed" });
    const s = creditScore([ok, failed], NOW);
    expect(s.settledCount).toBe(1);
    expect(s.trailingValueAed).toBe(200_000);
  });

  it("rises with settled history and volume", () => {
    const few = creditScore(
      [payment({ id: "1", status: "settled", mode: "open", amountAed: 100_000, settledAt: NOW - DAY })],
      NOW,
    );
    const many = creditScore(
      Array.from({ length: 6 }, (_, i) =>
        payment({ id: String(i), status: "settled", mode: "open", amountAed: 200_000, settledAt: NOW - DAY }),
      ),
      NOW,
    );
    expect(many.score).toBeGreaterThan(few.score);
  });

  it("crosses the eligibility threshold with a strong settled record", () => {
    const payments = Array.from({ length: 6 }, (_, i) =>
      payment({
        id: String(i),
        status: "settled",
        mode: "prooflock",
        amountAed: 250_000,
        settledAt: NOW - (i + 1) * DAY,
        proof: { status: "attested", label: "BoL" },
      }),
    );
    const s = creditScore(payments, NOW);
    expect(s.score).toBeGreaterThanOrEqual(ELIGIBLE_THRESHOLD);
    expect(s.eligible).toBe(true);
  });

  it("penalises proof performance when a prooflock is refunded", () => {
    const base = Array.from({ length: 3 }, (_, i) =>
      payment({ id: `s${i}`, status: "settled", mode: "prooflock", amountAed: 200_000, settledAt: NOW - (i + 1) * DAY, proof: { status: "attested", label: "BoL" } }),
    );
    const withRefund = [
      ...base,
      payment({ id: "r", status: "refunded", mode: "prooflock", amountAed: 200_000, proof: { status: "failed", label: "BoL" } }),
    ];
    const clean = creditScore(base, NOW);
    const dinged = creditScore(withRefund, NOW);
    expect(dinged.proofMetRatio).toBeLessThan(clean.proofMetRatio);
    expect(dinged.score).toBeLessThan(clean.score);
  });

  it("factor points never exceed their maxima and sum to the score", () => {
    const payments = Array.from({ length: 10 }, (_, i) =>
      payment({ id: String(i), status: "settled", mode: "prooflock", amountAed: 500_000, settledAt: NOW - DAY, proof: { status: "attested", label: "BoL" } }),
    );
    const s = creditScore(payments, NOW);
    for (const f of s.factors) expect(f.points).toBeLessThanOrEqual(f.max);
    const summed = Math.round(s.factors.reduce((a, f) => a + f.points, 0));
    expect(s.score).toBe(summed);
    expect(s.score).toBeLessThanOrEqual(100);
  });
});

describe("advanceOffer", () => {
  it("is zero when not eligible", () => {
    const s = creditScore([], NOW);
    expect(advanceOffer(s)).toBe(0);
  });

  it("is a positive, rounded fraction of the average payment once eligible", () => {
    const payments = Array.from({ length: 6 }, (_, i) =>
      payment({ id: String(i), status: "settled", mode: "prooflock", amountAed: 300_000, settledAt: NOW - (i + 1) * DAY, proof: { status: "attested", label: "BoL" } }),
    );
    const s = creditScore(payments, NOW);
    const offer = advanceOffer(s);
    expect(offer).toBeGreaterThan(0);
    expect(offer % 1000).toBe(0); // rounded to nearest AED 1,000
    expect(offer).toBeLessThan(s.avgPaymentAed); // an advance, not the whole payment
  });
});
