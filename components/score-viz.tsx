"use client";

import { AnimatedNumber } from "@/components/AnimatedNumber";
import { CreditScore, ELIGIBLE_THRESHOLD, ScoreFactor, aed } from "@/lib/credit";
import type { AdvanceHealth, Grade, HealthBand } from "@/lib/credit";

/** The v2 credit grade as a coloured chip — one component, used by the importer
 *  Capital page and the financier desk so both read the grade identically. */
export function GradeBadge({ grade, size = 36 }: { grade: Grade; size?: number }) {
  const map: Record<Grade, string> = {
    A: "bg-teal text-white",
    B: "bg-teal-tint text-teal-deep",
    C: "bg-brass/20 text-brass-deep",
    D: "bg-brass/30 text-brass-deep",
    E: "bg-danger/15 text-danger",
  };
  return (
    <span
      className={`flex items-center justify-center rounded-full font-display ${map[grade]}`}
      style={{ height: size, width: size, fontSize: size * 0.5 }}
    >
      {grade}
    </span>
  );
}

/*
 * Shared Credit Score visualisation, used by both the importer's Payment
 * Record and the financier's deal view so the two personas read the same
 * number in the same visual language.
 */

/** Runtime coverage on a live advance — the `assessCredit` companion that says
 *  how safe the position is *now*, not just at origination. Coverage ÷ exposure,
 *  with the 1.0× floor marked; below it the advance is under-covered. */
export function HealthFactorMeter({ health }: { health: AdvanceHealth }) {
  const bandTone: Record<HealthBand, { pill: string; bar: string; text: string }> = {
    healthy: { pill: "bg-teal-tint text-teal-deep", bar: "bg-teal", text: "text-teal-deep" },
    watch: { pill: "bg-brass-tint text-brass-deep", bar: "bg-brass", text: "text-brass-deep" },
    tight: { pill: "bg-brass/30 text-brass-deep", bar: "bg-brass-deep", text: "text-brass-deep" },
    impaired: { pill: "bg-danger/15 text-danger", bar: "bg-danger", text: "text-danger" },
  };
  const tone = bandTone[health.band];
  const SCALE = 1.5; // bar tops out at 1.5×; the 1.0× floor sits at 2/3
  const fillPct = Math.min(1, (Number.isFinite(health.hf) ? health.hf : SCALE) / SCALE) * 100;
  const floorPct = (1 / SCALE) * 100;

  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-ink-3">Advance health</span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${tone.pill}`}>
          {health.band}
        </span>
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span className={`font-display tnum text-3xl leading-none tracking-tight ${tone.text}`}>
          {health.headline}
        </span>
      </div>

      <div className="mt-3">
        <div className="relative h-2 rounded-full bg-surface-sunk">
          <div
            className={`absolute inset-y-0 left-0 rounded-full ${tone.bar} transition-[width] duration-700 ease-out`}
            style={{ width: `${fillPct}%` }}
          />
          {/* the 1.0× floor: at or above is covered, below is under-covered */}
          <div className="absolute -top-1 h-4 w-px bg-ink-3" style={{ left: `${floorPct}%` }} />
        </div>
        <div className="mt-1.5 flex justify-between text-xs text-ink-faint">
          <span>{aed(health.coverageAed)} cover</span>
          <span style={{ left: `${floorPct}%` }} className="relative -translate-x-1/2">1.0×</span>
          <span>{aed(health.exposureAed)} owed</span>
        </div>
      </div>

      <p className="mt-3 text-xs text-ink-3">{health.action}</p>
    </div>
  );
}

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
  score: CreditScore;
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
