import { describe, it, expect } from "vitest";
import { assessCredit, type CreditInput, type Receivable } from "./credit";
import type { Corridor, Counterparty } from "./corridor";

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
