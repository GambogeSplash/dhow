import { describe, it, expect } from "vitest";
import { assessCredit, advanceHealth, type CreditInput, type Receivable } from "./credit";
import type { Corridor, Counterparty } from "./credit";

const DAY = 86_400_000;
const NOW = 1_700_000_000_000;

function cp(id: string): Counterparty {
  return { id, name: id, city: "Dubai", country: "AE" };
}

function settled(id: string, supplier: string, amountAed: number, daysAgo: number): Corridor {
  return {
    id,
    ref: `DHW-${id}`,
    supplier: cp(supplier),
    goods: "components",
    amountAed,
    amountUsdc: amountAed / 3.6725,
    mode: "prooflock",
    status: "settled",
    proof: { status: "attested", label: "bill of lading" },
    createdAt: NOW - daysAgo * DAY,
    settledAt: NOW - daysAgo * DAY,
    txState: "confirmed",
  };
}

function base(corridors: Corridor[], extra: Partial<CreditInput> = {}): CreditInput {
  return {
    profile: { kybVerified: true, onboardedAt: NOW - 120 * DAY },
    corridors,
    now: NOW,
    ...extra,
  };
}

describe("assessCredit — eligibility gates", () => {
  it("blocks a thin file with one counterparty", () => {
    const a = assessCredit(base([settled("1", "sup-a", 100_000, 10)]));
    expect(a.eligible).toBe(false);
    expect(a.gateFailures).toContain("too_few_counterparties");
  });

  it("blocks unverified KYB", () => {
    const a = assessCredit(
      base([settled("1", "sup-a", 1e5, 30), settled("2", "sup-b", 1e5, 20)], {
        profile: { kybVerified: false, onboardedAt: NOW - 120 * DAY },
      }),
    );
    expect(a.eligible).toBe(false);
    expect(a.gateFailures).toContain("kyb_incomplete");
  });
});

describe("assessCredit — closes the v1 wash-trade hole", () => {
  it("self-dealing to a linked wallet is a hard stop AND earns no score", () => {
    // Six fat self-payments that would have scored ~75 and 'Eligible' in v1.
    const wash = Array.from({ length: 6 }, (_, i) => settled(`${i}`, "shell", 200_000, 60 - i * 5));
    const a = assessCredit(
      base(wash, {
        profile: {
          kybVerified: true,
          onboardedAt: NOW - 120 * DAY,
          linkedCounterpartyIds: ["shell"],
        },
      }),
    );
    expect(a.eligible).toBe(false);
    expect(a.gateFailures).toContain("circular_fund_flow");
    // settlements to the linked wallet are excluded → no settled history credit
    expect(a.gateFailures).toContain("no_settlement_history");
    expect(a.limitAed).toBe(0);
  });
});

describe("assessCredit — grade + capacity", () => {
  const healthy = [
    settled("1", "sup-a", 120_000, 80),
    settled("2", "sup-b", 90_000, 55),
    settled("3", "sup-a", 110_000, 30),
    settled("4", "sup-c", 95_000, 12),
  ];

  it("a diversified, recent, clean book is eligible with a real grade", () => {
    const a = assessCredit(base(healthy));
    expect(a.eligible).toBe(true);
    expect(["A", "B", "C"]).toContain(a.grade);
    expect(a.limitAed).toBeGreaterThan(0);
    expect(a.aprPct).toBeGreaterThan(0);
  });

  it("a verified receivable adds a secured line and lowers blended LGD", () => {
    const receivables: Receivable[] = [
      {
        id: "r1",
        debtor: cp("buyer-x"),
        amountAed: 300_000,
        dueAt: NOW + 45 * DAY,
        attestationUid: "0xproof",
        status: "verified",
      },
    ];
    const unsecured = assessCredit(base(healthy));
    const secured = assessCredit(base(healthy, { receivables }));
    expect(secured.securedLimitAed).toBeGreaterThan(0);
    expect(secured.limitAed).toBeGreaterThan(unsecured.limitAed);
    expect(secured.lgd).toBeLessThan(unsecured.lgd);
    expect(secured.structure.securedByReceivable).toBe(true);
  });

  it("refunds drop performance and the grade", () => {
    const withRefund: Corridor[] = [
      ...healthy,
      { ...settled("5", "sup-b", 100_000, 20), status: "refunded", proof: { status: "failed", label: "x" } },
    ];
    const clean = assessCredit(base(healthy));
    const dinged = assessCredit(base(withRefund));
    expect(dinged.score).toBeLessThan(clean.score);
  });
});

describe("advanceHealth — runtime coverage on a live advance", () => {
  function rec(over: Partial<Receivable> = {}): Receivable {
    return {
      id: "r1",
      debtor: cp("buyer-x"),
      amountAed: 300_000,
      dueAt: NOW + 30 * DAY,
      attestationUid: "0xproof",
      status: "verified",
      ...over,
    };
  }

  it("a fresh verified receivable covers the advance → healthy", () => {
    const h = advanceHealth({ outstandingAed: 200_000, receivables: [rec()], now: NOW });
    // 300k × 0.8 advance-rate = 240k coverage over 200k exposure = 1.2×... plus reserve none
    expect(h.coverageAed).toBe(240_000);
    expect(h.hf).toBeCloseTo(1.2, 2);
    expect(h.band).toBe("watch"); // 1.2 sits below the 1.3 healthy line
    expect(h.exposureAed).toBe(200_000);
  });

  it("reserve held lifts coverage and the band", () => {
    const bare = advanceHealth({ outstandingAed: 200_000, receivables: [rec()], now: NOW });
    const withReserve = advanceHealth({
      outstandingAed: 200_000,
      receivables: [rec()],
      reserveHeldAed: 30_000,
      now: NOW,
    });
    expect(withReserve.coverageAed).toBe(bare.coverageAed + 30_000);
    expect(withReserve.hf).toBeGreaterThan(bare.hf);
    expect(withReserve.band).toBe("healthy"); // 270k / 200k = 1.35×
  });

  it("an overdue receivable decays coverage toward zero", () => {
    const onTime = advanceHealth({ outstandingAed: 200_000, receivables: [rec()], now: NOW });
    const late = advanceHealth({
      outstandingAed: 200_000,
      receivables: [rec({ dueAt: NOW - 15 * DAY })], // 15d past due, half the grace window
      now: NOW,
    });
    expect(late.coverageAed).toBeLessThan(onTime.coverageAed);
    expect(late.hf).toBeLessThan(onTime.hf);
  });

  it("unverified / defaulted receivables count for nothing → impaired", () => {
    const h = advanceHealth({
      outstandingAed: 200_000,
      receivables: [rec({ status: "expected", attestationUid: undefined }), rec({ id: "r2", status: "defaulted" })],
      now: NOW,
    });
    expect(h.coverageAed).toBe(0);
    expect(h.band).toBe("impaired");
    expect(h.action).toMatch(/draw the reserve/i);
  });

  it("a repaid advance has no exposure and infinite HF", () => {
    const h = advanceHealth({ outstandingAed: 0, receivables: [], now: NOW });
    expect(h.hf).toBe(Infinity);
    expect(h.band).toBe("healthy");
    expect(h.headline).toMatch(/repaid/i);
  });
});
