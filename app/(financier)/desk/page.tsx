"use client";

import Link from "next/link";
import { useFinancier } from "@/components/FinancierProvider";
import { aed, ELIGIBLE_THRESHOLD } from "@/lib/corridor";

export default function DeskPage() {
  const { financier, borrowers, facilities, deployedAed, availableAed } = useFinancier();
  const eligible = borrowers.filter((b) => b.score.eligible);
  const active = facilities.filter((f) => !f.repaid);

  return (
    <div>
      <p className="text-sm text-ink-3">Desk</p>
      <h1 className="font-display mt-1 text-3xl tracking-tight">{financier.name}</h1>
      <p className="mt-2 max-w-xl text-ink-2">{financier.blurb}</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Metric label="Appetite" value={aed(financier.appetiteAed)} tone="ink" />
        <Metric label="Deployed" value={aed(deployedAed)} sub={`${active.length} active`} tone="brass" />
        <Metric label="Available" value={aed(availableAed)} tone="ink" />
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
          {eligible.map((b) => (
            <Link
              key={b.id}
              href={`/deal/${b.id}`}
              className="flex items-center justify-between rounded-[var(--radius-card)] border border-line bg-surface p-4 transition-colors hover:border-line-strong"
            >
              <div>
                <p className="font-medium">{b.name}</p>
                <p className="text-sm text-ink-3">
                  {b.city}, {b.country}
                </p>
              </div>
              <div className="text-right">
                <p className="font-display tnum text-xl text-teal-deep">{b.score.score}/100</p>
                <p className="text-xs text-ink-faint">{aed(b.offerAed)} offer</p>
              </div>
            </Link>
          ))}
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
