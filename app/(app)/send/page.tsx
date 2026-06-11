"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCorridor } from "@/components/CorridorProvider";
import {
  aed,
  AED_PER_USD,
  SettlementMode,
  usdcLabel,
} from "@/lib/corridor";

export default function SendPage() {
  const router = useRouter();
  const { draft, corridors, send } = useCorridor();
  const [mode, setMode] = useState<SettlementMode>(draft.mode);

  const alreadySent = corridors.some((c) => c.id === draft.id);

  function handleSend() {
    send({ ...draft, mode });
    router.push("/corridor");
  }

  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-sm text-ink-3">Send</p>
      <h1 className="font-display mt-1 text-3xl tracking-tight">
        Pay your supplier
      </h1>
      <p className="mt-2 max-w-lg text-ink-2">
        Settle cross-border in stablecoin on Polygon. Minutes, not days. The
        record writes itself.
      </p>

      <div className="mt-8 overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
        {/* counterparties */}
        <div className="flex items-center justify-between gap-4 border-b border-line px-6 py-5">
          <Party label="From" name="Al Noor Trading" sub="Dubai, UAE" />
          <Arrow />
          <Party
            label="To"
            name={draft.supplier.name}
            sub={`${draft.supplier.city}, ${draft.supplier.country}`}
            alignRight
          />
        </div>

        {/* amount */}
        <div className="border-b border-line px-6 py-7">
          <p className="text-sm text-ink-3">{draft.goods}</p>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="font-display tnum text-5xl tracking-tight">
              {aed(draft.amountAed)}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-sm text-ink-3">
            <span className="tnum font-mono text-teal-deep">
              {usdcLabel(draft.amountUsdc)}
            </span>
            <span className="text-ink-faint">
              · settles in USDC at peg {AED_PER_USD.toFixed(4)} AED/USD
            </span>
          </div>
        </div>

        {/* mode */}
        <div className="px-6 py-6">
          <p className="mb-3 text-sm font-medium text-ink-2">Settlement</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <ModeCard
              active={mode === "open"}
              onClick={() => setMode("open")}
              title="Open settlement"
              desc="Pay now. Funds reach the supplier in minutes."
            />
            <ModeCard
              active={mode === "prooflock"}
              onClick={() => setMode("prooflock")}
              title="Proof-Lock"
              desc="Escrow on-chain. Releases automatically when shipment proof is attested."
              badge="Conditional"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-line bg-surface-sunk px-6 py-4">
          <p className="max-w-xs text-xs text-ink-3">
            {mode === "prooflock"
              ? "Funds lock in a Polygon escrow and release to the supplier the moment the bill of lading is attested."
              : "A single on-chain transfer settles directly to the supplier."}
          </p>
          {alreadySent ? (
            <button
              onClick={() => router.push("/corridor")}
              className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper"
            >
              View in Corridor Record →
            </button>
          ) : (
            <button
              onClick={handleSend}
              className="rounded-full bg-teal px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-deep"
            >
              {mode === "prooflock" ? "Lock & send" : "Send payment"}
            </button>
          )}
        </div>
      </div>

      {/* before / after */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Compare
          tone="muted"
          head="Correspondent banking"
          big="3–5 days"
          sub=">3% on a quarter of corridors, opaque FX"
        />
        <Compare
          tone="teal"
          head="On Dhow"
          big="Minutes"
          sub="~$0.002 settlement on Polygon, FX shown up front"
        />
      </div>
    </div>
  );
}

function Party({
  label,
  name,
  sub,
  alignRight,
}: {
  label: string;
  name: string;
  sub: string;
  alignRight?: boolean;
}) {
  return (
    <div className={alignRight ? "text-right" : ""}>
      <p className="text-xs uppercase tracking-wide text-ink-faint">{label}</p>
      <p className="mt-0.5 font-medium">{name}</p>
      <p className="text-sm text-ink-3">{sub}</p>
    </div>
  );
}

function Arrow() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-ink-faint" fill="none">
      <path
        d="M4 12h15m0 0-5-5m5 5-5 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ModeCard({
  active,
  onClick,
  title,
  desc,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  desc: string;
  badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-[var(--radius-card)] border px-4 py-4 text-left transition-all ${
        active
          ? "border-teal bg-teal-tint/60 ring-1 ring-teal"
          : "border-line bg-surface hover:border-line-strong"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="font-medium">{title}</span>
        {badge && (
          <span className="rounded-full bg-brass-tint px-2 py-0.5 text-[11px] font-medium text-brass-deep">
            {badge}
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-ink-3">{desc}</p>
    </button>
  );
}

function Compare({
  tone,
  head,
  big,
  sub,
}: {
  tone: "muted" | "teal";
  head: string;
  big: string;
  sub: string;
}) {
  return (
    <div
      className={`rounded-[var(--radius-card)] border px-5 py-4 ${
        tone === "teal"
          ? "border-teal/30 bg-teal-tint/50"
          : "border-line bg-surface"
      }`}
    >
      <p className="text-xs uppercase tracking-wide text-ink-faint">{head}</p>
      <p
        className={`font-display mt-1 text-2xl ${
          tone === "teal" ? "text-teal-deep" : "text-ink"
        }`}
      >
        {big}
      </p>
      <p className="mt-0.5 text-sm text-ink-3">{sub}</p>
    </div>
  );
}
