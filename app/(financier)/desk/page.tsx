"use client";

import Link from "next/link";
import { useFinancier } from "@/components/FinancierProvider";
import { useFinancierOverlays } from "@/components/financier-overlays";
import { Avatar } from "@/components/Avatar";
import { TierPill, GradeBadge } from "@/components/score-viz";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { aed, ELIGIBLE_THRESHOLD } from "@/lib/credit";

export default function DeskPage() {
  const { financier, borrowers, facilities, deployedAed, availableAed } = useFinancier();
  const { openDeal } = useFinancierOverlays();
  // Highest score first, so the strongest deal sits at the top of the desk.
  const eligible = borrowers
    .filter((b) => b.score.eligible)
    .sort((a, b) => b.score.score - a.score.score);
  const fundedIds = new Set(facilities.filter((f) => !f.repaid).map((f) => f.borrowerId));
  const active = facilities.filter((f) => !f.repaid);

  return (
    <div>
      <h1 className="font-display mt-1 text-3xl tracking-tight">{financier.name}</h1>
      <p className="mt-2 max-w-xl text-ink-2">
        {financier.blurb} The desk shows the borrowers whose on-chain Credit Score clears{" "}
        {ELIGIBLE_THRESHOLD}, ranked by score. Every figure is a settlement Dhow verified on-chain.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        <Metric label="Appetite" value={aed(financier.appetiteAed)} tone="ink" />
        <Metric label="Deployed" value={aed(deployedAed)} sub={`${active.length} active`} tone="brass" />
        <Metric label="Available" value={aed(availableAed)} tone="ink" />
        <Metric
          label="Eligible"
          value={`${eligible.length}`}
          sub={eligible.length === 1 ? "borrower" : "borrowers"}
          tone="ink"
        />
      </div>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-sm font-medium text-ink-2">Eligible borrowers</h2>
        <Link href="/opportunities" className="text-sm text-brass-deep underline underline-offset-2">
          View all opportunities →
        </Link>
      </div>

      {eligible.length === 0 ? (
        <div className="mt-3 rounded-[var(--radius-card)] border border-dashed border-line-strong bg-surface p-8 text-center">
          <p className="font-medium">No eligible borrowers yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-ink-3">
            Borrowers appear here the moment their on-chain Credit Score crosses {ELIGIBLE_THRESHOLD}.
            They settle a payment, the score lifts, and the opportunity surfaces, live.
          </p>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {eligible.map((b) => {
            const funded = fundedIds.has(b.id);
            return (
              <button
                key={b.id}
                onClick={() => openDeal(b.id)}
                className="flex w-full flex-wrap items-center justify-between gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-4 text-left transition-colors hover:border-line-strong"
              >
                <div className="flex min-w-48 items-center gap-3">
                  <Avatar name={b.name} size={40} />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{b.name}</p>
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
                      className="font-display tnum text-2xl tracking-tight text-teal-deep"
                    />
                    <span className="text-sm text-ink-faint">/100</span>
                  </div>
                </div>

                <div className="text-right">
                  <p className="tnum text-sm">{aed(b.score.trailingValueAed)}</p>
                  <p className="text-xs text-ink-faint">verified volume</p>
                </div>

                <div className="text-right">
                  <p className="font-display tnum text-xl text-brass-deep">{aed(b.credit.limitAed)}</p>
                  <p className="text-xs text-ink-faint">line · {b.credit.aprPct}% APR</p>
                </div>

                <span className="text-sm font-medium text-brass-deep">Review deal →</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: "ink" | "brass";
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
      <p className="text-xs uppercase tracking-wide text-ink-faint">{label}</p>
      <p className={`font-display tnum mt-2 text-2xl ${tone === "brass" ? "text-brass-deep" : "text-ink"}`}>
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-ink-3">{sub}</p>}
    </div>
  );
}
