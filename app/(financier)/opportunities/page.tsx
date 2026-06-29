"use client";

import { useFinancier } from "@/components/FinancierProvider";
import { useFinancierOverlays } from "@/components/financier-overlays";
import { Avatar } from "@/components/Avatar";
import { TierPill, GradeBadge } from "@/components/score-viz";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { aed, ELIGIBLE_THRESHOLD } from "@/lib/credit";

export default function OpportunitiesPage() {
  const { borrowers, facilities } = useFinancier();
  const { openDeal } = useFinancierOverlays();
  // Surface highest score first; a borrower rises into view as it crosses 70.
  const sorted = [...borrowers].sort((a, b) => b.score.score - a.score.score);
  const eligibleCount = sorted.filter((b) => b.score.eligible).length;
  const fundedIds = new Set(facilities.filter((f) => !f.repaid).map((f) => f.borrowerId));

  return (
    <div>
      <h1 className="font-display mt-1 text-3xl tracking-tight">Scored borrowers</h1>
      <p className="mt-2 max-w-xl text-ink-2">
        Every figure is a payment Dhow settled and verified on-chain. You underwrite the cashflow you
        can see, not an attestation you have to trust.
      </p>

      <p className="mt-4 text-sm text-ink-3">
        <span className="tnum font-medium text-ink">{sorted.length}</span> scored,{" "}
        <span className="tnum font-medium text-teal-deep">{eligibleCount}</span> eligible at {ELIGIBLE_THRESHOLD} or above.
      </p>

      <div className="mt-6 space-y-3">
        {sorted.map((b) => {
          const eligible = b.score.eligible;
          const funded = fundedIds.has(b.id);
          const gap = ELIGIBLE_THRESHOLD - b.score.score;
          return (
            <div
              key={b.id}
              className={`flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-card)] border bg-surface p-5 ${
                eligible ? "border-line" : "border-dashed border-line-strong"
              }`}
            >
              <div className="flex min-w-48 items-center gap-3">
                <Avatar name={b.name} size={40} />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{b.name}</p>
                    {b.onchainScore !== null && (
                      <span className="rounded-full bg-teal-tint px-2 py-0.5 text-[11px] font-medium text-teal-deep">
                        On-chain
                      </span>
                    )}
                    {funded && (
                      <span className="rounded-full bg-brass-tint px-2 py-0.5 text-[11px] font-medium text-brass-deep">
                        Funded
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-ink-3">
                    {b.city}, {b.country}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <GradeBadge grade={b.credit.grade} size={32} />
                <div className="flex items-baseline gap-1">
                  <AnimatedNumber
                    value={b.score.score}
                    from={b.score.score}
                    className={`font-display tnum text-2xl tracking-tight ${
                      eligible ? "text-teal-deep" : "text-ink"
                    }`}
                  />
                  <span className="text-sm text-ink-faint">/100</span>
                </div>
              </div>

              <div className="text-right">
                <p className="tnum text-sm">{aed(b.score.trailingValueAed)}</p>
                <p className="text-xs text-ink-faint">verified volume</p>
              </div>

              <div className="text-right">
                <p className="tnum text-sm">{eligible ? aed(b.credit.limitAed) : "—"}</p>
                <p className="text-xs text-ink-faint">
                  {eligible ? `line · ${b.credit.aprPct}% APR` : "advance offer"}
                </p>
              </div>

              {eligible ? (
                <button
                  onClick={() => openDeal(b.id)}
                  className="rounded-full bg-brass px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brass-deep"
                >
                  Review deal →
                </button>
              ) : (
                <span className="rounded-full bg-surface-sunk px-4 py-2 text-sm text-ink-faint">
                  needs +{gap} to qualify
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
