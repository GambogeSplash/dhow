"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useCorridor } from "@/components/CorridorProvider";
import { useOverlays } from "@/components/overlays";
import { Avatar } from "@/components/Avatar";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import {
  aed,
  Corridor,
  ELIGIBLE_THRESHOLD,
  ScoreFactor,
  usdcLabel,
} from "@/lib/corridor";

export default function CorridorPage() {
  const { corridors, score, prevScore, retry, offerAed } = useCorridor();
  const { openAttest, openRefund } = useOverlays();
  const crossedNow = prevScore < ELIGIBLE_THRESHOLD && score.eligible;

  // Pulse the factor(s) whose points just rose, so the score lift is legible.
  const prevPoints = useRef<Record<string, number>>({});
  const [movedKeys, setMovedKeys] = useState<string[]>([]);
  useEffect(() => {
    const moved: string[] = [];
    for (const f of score.factors) {
      const before = prevPoints.current[f.key];
      if (before !== undefined && f.points > before + 0.01) moved.push(f.key);
      prevPoints.current[f.key] = f.points;
    }
    if (moved.length === 0) return;
    setMovedKeys(moved);
    const t = setTimeout(() => setMovedKeys([]), 1400);
    return () => clearTimeout(t);
  }, [score]);

  const ledger = [...corridors].sort(
    (a, b) => (b.settledAt ?? b.createdAt) - (a.settledAt ?? a.createdAt),
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr]">
      {/* score */}
      <section>
        <h1 className="font-display mt-1 text-3xl tracking-tight">Credit Score</h1>
        <p className="mt-2 text-ink-2">
          Built only from settlements. This is the number a financier
          underwrites against.
        </p>

        <div className="mt-6 rounded-[var(--radius-card)] border border-line bg-surface p-6">
          <div className="flex items-end justify-between">
            <div className="flex items-baseline gap-2">
              <AnimatedNumber
                value={score.score}
                from={prevScore}
                className="font-display tnum text-6xl leading-none tracking-tight"
              />
              <span className="text-2xl text-ink-faint">/100</span>
            </div>
            <TierPill tier={score.tier} />
          </div>

          <div className="mt-6">
            <div className={`relative h-2 rounded-full bg-surface-sunk ${crossedNow ? "meter-celebrate" : ""}`}>
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-teal transition-[width] duration-700 ease-out"
                style={{ width: `${score.score}%` }}
              />
              <div
                className="absolute -top-1 h-4 w-px bg-ink-3"
                style={{ left: `${ELIGIBLE_THRESHOLD}%` }}
              />
            </div>
            <div className="mt-1.5 flex justify-between text-xs text-ink-faint">
              <span>Establishing</span>
              <span style={{ marginLeft: "auto" }}>Eligible at {ELIGIBLE_THRESHOLD}</span>
            </div>
          </div>

          <div className="mt-6 space-y-3 border-t border-line pt-5">
            {score.factors.map((f, i) => (
              <FactorRow key={f.key} f={f} index={i} moved={movedKeys.includes(f.key)} />
            ))}
          </div>
        </div>

        {crossedNow && offerAed > 0 && (
          <Link
            href="/capital"
            className="rise mt-4 flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-brass/40 bg-brass-tint px-5 py-4"
          >
            <div>
              <p className="font-medium text-brass-deep">Working capital unlocked</p>
              <p className="text-sm text-ink-3">
                {aed(offerAed)} available against this settlement.
              </p>
            </div>
            <span className="rounded-full bg-brass px-4 py-2 text-sm font-medium text-white">
              View in Capital →
            </span>
          </Link>
        )}
      </section>

      {/* ledger */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-ink-2">Settled & in-flight</h2>
          <span className="tnum font-mono text-xs text-ink-faint">
            {aed(score.trailingValueAed)} settled
          </span>
        </div>

        {ledger.length === 0 ? (
          <EmptyLedger />
        ) : (
          <div className="space-y-3">
            {ledger.map((c) => (
              <LedgerRow
                key={c.id}
                c={c}
                onAttest={() => openAttest(c.id)}
                onRefund={() => openRefund(c.id)}
                onRetry={() => retry(c.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function EmptyLedger() {
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-line-strong bg-surface p-8 text-center">
      <p className="font-medium">No settlements yet</p>
      <p className="mx-auto mt-1 max-w-xs text-sm text-ink-3">
        Pay your first supplier to start building a Credit Score. Each settled
        payment lifts the number a financier underwrites against.
      </p>
      <Link
        href="/send"
        className="mt-5 inline-block rounded-full bg-teal px-5 py-2.5 text-sm font-medium text-white"
      >
        Make your first payment →
      </Link>
    </div>
  );
}

function FactorRow({ f, index = 0, moved = false }: { f: ScoreFactor; index?: number; moved?: boolean }) {
  const pct = (f.points / f.max) * 100;
  return (
    <div className={moved ? "factor-moved" : undefined}>
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

function TierPill({ tier }: { tier: string }) {
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

function LedgerRow({
  c,
  onAttest,
  onRefund,
  onRetry,
}: {
  c: Corridor;
  onAttest: () => void;
  onRefund: () => void;
  onRetry: () => void;
}) {
  const failed = c.txState === "failed";
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Avatar name={c.supplier.name} size={36} className="mt-0.5" />
          <div>
            <div className="flex items-center gap-2">
              <span className="tnum font-mono text-xs text-ink-faint">{c.ref}</span>
              <StatusPill c={c} />
            </div>
            <p className="mt-1 font-medium">{c.supplier.name}</p>
            <p className="text-sm text-ink-3">{c.goods}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-display tnum text-xl">{aed(c.amountAed)}</p>
          <p className="tnum font-mono text-xs text-ink-faint">{usdcLabel(c.amountUsdc)}</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
        <p className="text-xs text-ink-3">
          {c.proof ? (
            <>
              <span className="text-ink-faint">Proof · </span>
              {c.proof.label}
              {c.proof.attestedBy ? ` · ${c.proof.attestedBy}` : ""}
            </>
          ) : (
            <span className="text-ink-faint">Open settlement</span>
          )}
        </p>

        {failed ? (
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-xs font-medium text-danger">Settlement failed</span>
            <button
              onClick={onRetry}
              className="rounded-full border border-danger/30 bg-danger-tint px-3 py-1.5 text-xs font-medium text-danger transition-colors hover:bg-danger-tint/70"
            >
              Retry
            </button>
          </div>
        ) : c.status === "locked" ? (
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={onRefund}
              className="rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink-3 transition-colors hover:border-line-strong hover:text-ink"
            >
              Dispute &amp; refund
            </button>
            <button
              onClick={onAttest}
              className="rounded-full bg-brass px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brass-deep"
            >
              Attest shipment proof
            </button>
          </div>
        ) : (
          <TxLink txHash={c.txHash} explorerUrl={c.explorerUrl} txState={c.txState} />
        )}
      </div>
    </div>
  );
}

function shortHash(h: string): string {
  if (h.includes("…")) return h;
  return h.length > 14 ? `${h.slice(0, 6)}…${h.slice(-4)}` : h;
}

function TxLink({
  txHash,
  explorerUrl,
  txState,
}: {
  txHash?: string;
  explorerUrl?: string;
  txState?: string;
}) {
  if (!txHash) {
    return (
      <span className="shrink-0 text-xs text-ink-faint">
        {txState === "pending" ? "confirming…" : "—"}
      </span>
    );
  }
  if (explorerUrl) {
    return (
      <a
        href={explorerUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="tnum shrink-0 font-mono text-xs text-teal-deep underline decoration-teal/30 underline-offset-2 hover:decoration-teal"
      >
        {shortHash(txHash)} ↗
      </a>
    );
  }
  return (
    <span className="tnum shrink-0 font-mono text-xs text-teal-deep">{shortHash(txHash)}</span>
  );
}

function StatusPill({ c }: { c: Corridor }) {
  if (c.status === "locked")
    return (
      <span className="rounded-full bg-pending-tint px-2 py-0.5 text-[11px] font-medium text-brass-deep">
        Locked · awaiting proof
      </span>
    );
  if (c.status === "refunded")
    return (
      <span className="rounded-full bg-danger-tint px-2 py-0.5 text-[11px] font-medium text-danger">
        Refunded
      </span>
    );
  return (
    <span className="rounded-full bg-teal-tint px-2 py-0.5 text-[11px] font-medium text-teal-deep">
      Settled
    </span>
  );
}
