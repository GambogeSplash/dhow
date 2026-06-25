"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useCorridor } from "@/components/CorridorProvider";
import { useOverlays } from "@/components/overlays";
import { Avatar } from "@/components/Avatar";
import { aed, Corridor, ELIGIBLE_THRESHOLD, usdcLabel } from "@/lib/corridor";
import { statusLabel, ACTIVE_STATUSES } from "@/lib/deal";
import { stagger, riseItem } from "@/lib/motion";

export default function OverviewPage() {
  const { business, corridors, score, offerAed, activeDeal } = useCorridor();
  const { openSend } = useOverlays();

  const inFlight = corridors.filter((c) => c.status === "locked").length;

  // Capital metric reflects a live deal if there is one, else the indicative offer.
  const capital = activeDeal
    ? {
        value: aed(activeDeal.terms.amountAed),
        foot: statusLabel(activeDeal, "borrower"),
        tone: ACTIVE_STATUSES.includes(activeDeal.status) ? ("teal" as const) : ("brass" as const),
      }
    : {
        value: score.eligible ? aed(offerAed) : "Locked",
        foot: score.eligible ? "request now" : `unlocks at score ${ELIGIBLE_THRESHOLD}`,
        tone: score.eligible ? ("brass" as const) : ("ink" as const),
      };
  const recent = [...corridors]
    .sort((a, b) => (b.settledAt ?? b.createdAt) - (a.settledAt ?? a.createdAt))
    .slice(0, 5);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-3">Overview</p>
          <h1 className="font-display mt-1 text-3xl tracking-tight">
            {business?.name}
          </h1>
        </div>
        <button
          onClick={() => openSend()}
          className="rounded-full bg-teal px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-deep"
        >
          Pay a supplier →
        </button>
      </div>

      {/* metrics */}
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <Metric
          label="Credit Score"
          value={`${score.score}`}
          suffix="/100"
          foot={<span className="capitalize">{score.tier}</span>}
          tone={score.eligible ? "teal" : "ink"}
        />
        <Metric
          label="Settled volume"
          value={aed(score.trailingValueAed)}
          foot={`${score.settledCount} settlement${score.settledCount === 1 ? "" : "s"}`}
        />
        <Metric label="Working capital" value={capital.value} foot={capital.foot} tone={capital.tone} href="/capital" />
        <Metric
          label="In-flight"
          value={`${inFlight}`}
          foot={inFlight ? "awaiting proof" : "nothing pending"}
        />
      </motion.div>

      {/* recent activity */}
      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-ink-2">Recent activity</h2>
          <Link href="/corridor" className="text-sm text-teal-deep hover:underline">
            View Cashflow Record →
          </Link>
        </div>

        {recent.length === 0 ? (
          <div className="rounded-[var(--radius-card)] border border-dashed border-line-strong bg-surface p-8 text-center">
            <p className="font-medium">Make your first payment</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-ink-3">
              Pay a supplier in stablecoin and the record starts writing itself.
              Each settlement lifts your Credit Score.
            </p>
            <button
              onClick={() => openSend()}
              className="mt-5 inline-block rounded-full bg-teal px-5 py-2.5 text-sm font-medium text-white"
            >
              Pay a supplier →
            </button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
            {recent.map((c, i) => (
              <ActivityRow key={c.id} c={c} first={i === 0} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  suffix,
  foot,
  tone = "ink",
  href,
}: {
  label: string;
  value: string;
  suffix?: string;
  foot?: React.ReactNode;
  tone?: "ink" | "teal" | "brass";
  href?: string;
}) {
  const valueColor =
    tone === "teal" ? "text-teal-deep" : tone === "brass" ? "text-brass-deep" : "text-ink";
  const body = (
    <>
      <p className="text-xs uppercase tracking-wide text-ink-faint">{label}</p>
      <p className={`font-display tnum mt-2 text-3xl leading-none tracking-tight ${valueColor}`}>
        {value}
        {suffix && <span className="text-lg text-ink-faint">{suffix}</span>}
      </p>
      {foot && <p className="mt-2 text-sm text-ink-3">{foot}</p>}
    </>
  );
  const cls = "block rounded-[var(--radius-card)] border border-line bg-surface p-5";
  return (
    <motion.div variants={riseItem}>
      {href ? (
        <Link href={href} className={`${cls} transition-colors hover:border-line-strong`}>
          {body}
        </Link>
      ) : (
        <div className={cls}>{body}</div>
      )}
    </motion.div>
  );
}

function ActivityRow({ c, first }: { c: Corridor; first: boolean }) {
  return (
    <div
      className={`flex items-center justify-between gap-4 px-5 py-3.5 ${
        first ? "" : "border-t border-line"
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={c.supplier.name} size={34} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="tnum font-mono text-xs text-ink-faint">{c.ref}</span>
            <StatusPill c={c} />
          </div>
          <p className="mt-0.5 truncate text-sm font-medium">{c.supplier.name}</p>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="tnum font-medium">{aed(c.amountAed)}</p>
        <p className="tnum font-mono text-xs text-ink-faint">{usdcLabel(c.amountUsdc)}</p>
      </div>
    </div>
  );
}

function StatusPill({ c }: { c: Corridor }) {
  if (c.txState === "failed")
    return (
      <span className="rounded-full bg-danger-tint px-2 py-0.5 text-[11px] font-medium text-danger">
        Failed
      </span>
    );
  if (c.status === "locked")
    return (
      <span className="rounded-full bg-pending-tint px-2 py-0.5 text-[11px] font-medium text-brass-deep">
        Locked
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
