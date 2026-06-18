"use client";

import Link from "next/link";
import { useFinancier } from "@/components/FinancierProvider";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { aed, ELIGIBLE_THRESHOLD } from "@/lib/corridor";

export default function OpportunitiesPage() {
  const { borrowers } = useFinancier();
  // Surface highest score first; the demo borrower rises into view as it crosses 70.
  const sorted = [...borrowers].sort((a, b) => b.score.score - a.score.score);

  return (
    <div>
      <p className="text-sm text-ink-3">Opportunities</p>
      <h1 className="font-display mt-1 text-3xl tracking-tight">Scored borrowers</h1>
      <p className="mt-2 max-w-xl text-ink-2">
        Every figure is a payment Dhow settled and verified on-chain. You underwrite the cashflow you
        can see, not an attestation you have to trust.
      </p>

      <div className="mt-6 space-y-3">
        {sorted.map((b) => {
          const eligible = b.score.eligible;
          return (
            <div
              key={b.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5"
            >
              <div className="min-w-40">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{b.name}</p>
                  {b.onchainScore !== null && (
                    <span className="rounded-full bg-teal-tint px-2 py-0.5 text-[11px] font-medium text-teal-deep">
                      On-chain
                    </span>
                  )}
                </div>
                <p className="text-sm text-ink-3">
                  {b.city}, {b.country}
                </p>
              </div>

              <div className="flex items-baseline gap-1">
                <AnimatedNumber
                  value={b.score.score}
                  from={b.score.score}
                  className="font-display tnum text-2xl tracking-tight"
                />
                <span className="text-sm text-ink-faint">/100</span>
              </div>

              <div className="text-right">
                <p className="tnum text-sm">{aed(b.score.trailingValueAed)}</p>
                <p className="text-xs text-ink-faint">verified volume</p>
              </div>

              <div className="text-right">
                <p className="tnum text-sm">{eligible ? aed(b.offerAed) : "—"}</p>
                <p className="text-xs text-ink-faint">advance offer</p>
              </div>

              {eligible ? (
                <Link
                  href={`/deal/${b.id}`}
                  className="rounded-full bg-brass px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brass-deep"
                >
                  Review deal →
                </Link>
              ) : (
                <span className="rounded-full bg-surface-sunk px-4 py-2 text-sm text-ink-faint">
                  {ELIGIBLE_THRESHOLD - b.score.score} to eligible
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
