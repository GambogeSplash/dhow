"use client";

import { AnimatedNumber } from "@/components/AnimatedNumber";
import { CorridorScore, ELIGIBLE_THRESHOLD, ScoreFactor } from "@/lib/corridor";

/*
 * Shared Credit Score visualisation, used by both the importer's Corridor
 * Record and the financier's deal view so the two personas read the same
 * number in the same visual language.
 */

export function TierPill({ tier }: { tier: string }) {
  const map: Record<string, string> = {
    establishing: "bg-surface-sunk text-ink-3",
    eligible: "bg-teal-tint text-teal-deep",
    preferred: "bg-brass-tint text-brass-deep",
  };
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${map[tier]}`}>
      {tier}
    </span>
  );
}

export function FactorRow({ f, index = 0 }: { f: ScoreFactor; index?: number }) {
  const pct = (f.points / f.max) * 100;
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-ink-2">{f.label}</span>
        <span className="tnum font-mono text-xs text-ink-3">
          {f.points.toFixed(0)}
          <span className="text-ink-faint">/{f.max}</span>
        </span>
      </div>
      <div className="mt-1 flex items-center gap-3">
        <div className="h-1.5 flex-1 rounded-full bg-surface-sunk">
          <div
            className="h-1.5 rounded-full bg-teal/70 transition-[width] duration-700 ease-out"
            style={{ width: `${pct}%`, transitionDelay: `${index * 120}ms` }}
          />
        </div>
        <span className="w-40 shrink-0 text-right text-xs text-ink-faint">{f.detail}</span>
      </div>
    </div>
  );
}

/** The big number + threshold meter + factor breakdown. */
export function ScoreCard({
  score,
  prevScore,
  verifiedOnChain,
}: {
  score: CorridorScore;
  prevScore?: number;
  verifiedOnChain?: boolean;
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6">
      <div className="flex items-end justify-between">
        <div className="flex items-baseline gap-2">
          <AnimatedNumber
            value={score.score}
            from={prevScore ?? score.score}
            className="font-display tnum text-6xl leading-none tracking-tight"
          />
          <span className="text-2xl text-ink-faint">/100</span>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <TierPill tier={score.tier} />
          {verifiedOnChain && (
            <span className="rounded-full bg-teal-tint px-2 py-0.5 text-[11px] font-medium text-teal-deep">
              Verified on-chain
            </span>
          )}
        </div>
      </div>

      <div className="mt-6">
        <div className="relative h-2 rounded-full bg-surface-sunk">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-teal transition-[width] duration-700 ease-out"
            style={{ width: `${score.score}%` }}
          />
          <div className="absolute -top-1 h-4 w-px bg-ink-3" style={{ left: `${ELIGIBLE_THRESHOLD}%` }} />
        </div>
        <div className="mt-1.5 flex justify-between text-xs text-ink-faint">
          <span>Establishing</span>
          <span style={{ marginLeft: "auto" }}>Eligible at {ELIGIBLE_THRESHOLD}</span>
        </div>
      </div>

      <div className="mt-6 space-y-3 border-t border-line pt-5">
        {score.factors.map((f, i) => (
          <FactorRow key={f.key} f={f} index={i} />
        ))}
      </div>
    </div>
  );
}
