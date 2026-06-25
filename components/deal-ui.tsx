"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { stagger, riseItem, press } from "@/lib/motion";
import {
  type Deal,
  type DealParty,
  type DealTerms,
  type DealEvent,
  feeAed,
  totalRepayableAed,
  daysUntil,
  statusLabel,
  MIN_RATE_PCT,
  MAX_RATE_PCT,
  MIN_TENOR_DAYS,
  MAX_TENOR_DAYS,
  TENOR_OPTIONS,
} from "@/lib/deal";
import { aed } from "@/lib/corridor";

/*
 * Shared presentational pieces for the working-capital negotiation, used by both
 * the importer (/capital) and the financier (deal / requests / portfolio). They
 * render a deal; all actions are passed in as callbacks so each side owns its
 * own signing/persistence.
 */

export function pct(n: number): string {
  return `${Number.isInteger(n) ? n : n.toFixed(2).replace(/0$/, "")}%`;
}

// ---- status pill ----

const STATUS_TONE: Record<Deal["status"], string> = {
  requested: "bg-surface-sunk text-ink-2",
  offered: "bg-brass-tint text-brass-deep",
  countered: "bg-brass-tint text-brass-deep",
  agreed: "bg-teal-tint text-teal-deep",
  funded: "bg-teal-tint text-teal-deep",
  repaid: "bg-surface-sunk text-ink-2",
  declined: "bg-surface-sunk text-ink-faint",
  withdrawn: "bg-surface-sunk text-ink-faint",
};

export function DealStatusPill({ deal, viewer }: { deal: Deal; viewer: DealParty }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_TONE[deal.status]}`}>
      {statusLabel(deal, viewer)}
    </span>
  );
}

// ---- terms summary ----

export function TermsSummary({
  terms,
  dueAt,
  now,
}: {
  terms: DealTerms;
  dueAt?: number;
  now?: number;
}) {
  return (
    <dl className="divide-y divide-line">
      <Row k="Advance" v={aed(terms.amountAed)} strong />
      <Row k="Financing fee" v={`${pct(terms.ratePct)} · ${aed(feeAed(terms))}`} />
      <Row k="Total to repay" v={aed(totalRepayableAed(terms))} strong />
      <Row
        k="Term"
        v={
          dueAt && now
            ? `${terms.tenorDays} days · due in ${Math.max(0, daysUntil(dueAt, now))}d`
            : `${terms.tenorDays} days`
        }
      />
    </dl>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5 text-sm">
      <dt className="text-ink-3">{k}</dt>
      <dd className={`tnum ${strong ? "font-semibold text-ink" : "font-medium text-ink-2"}`}>{v}</dd>
    </div>
  );
}

// ---- terms editor (request / offer / counter) ----

export function TermsEditor({
  initial,
  maxAmountAed,
  submitLabel,
  onSubmit,
  busy,
  noteLabel,
}: {
  initial: DealTerms;
  maxAmountAed?: number;
  submitLabel: string;
  onSubmit: (terms: DealTerms, note?: string) => void;
  busy?: boolean;
  noteLabel?: string;
}) {
  const [amount, setAmount] = useState(String(initial.amountAed));
  const [rate, setRate] = useState(String(initial.ratePct));
  const [tenor, setTenor] = useState(initial.tenorDays);
  const [note, setNote] = useState("");

  const amountNum = Math.max(0, Number(amount.replace(/[^0-9.]/g, "")) || 0);
  const rateNum = Math.min(MAX_RATE_PCT, Math.max(MIN_RATE_PCT, Number(rate) || MIN_RATE_PCT));
  const terms: DealTerms = { amountAed: amountNum, ratePct: rateNum, tenorDays: tenor };
  const overMax = maxAmountAed != null && amountNum > maxAmountAed;
  const valid = amountNum > 0 && !overMax;

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="text-xs uppercase tracking-wide text-ink-faint">Advance amount (AED)</span>
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="tnum mt-1 w-full rounded-[var(--radius-input)] border border-line bg-surface px-3 py-2.5 text-lg outline-none focus:border-ink-3"
        />
        {overMax && (
          <span className="mt-1 block text-xs text-danger">
            Above your headroom of {aed(maxAmountAed!)}.
          </span>
        )}
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs uppercase tracking-wide text-ink-faint">Fee %</span>
          <input
            inputMode="decimal"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className="tnum mt-1 w-full rounded-[var(--radius-input)] border border-line bg-surface px-3 py-2.5 outline-none focus:border-ink-3"
          />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-wide text-ink-faint">Term</span>
          <select
            value={tenor}
            onChange={(e) => setTenor(Number(e.target.value))}
            className="mt-1 w-full rounded-[var(--radius-input)] border border-line bg-surface px-3 py-2.5 outline-none focus:border-ink-3"
          >
            {TENOR_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d} days
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="rounded-[var(--radius-card)] bg-surface-sunk px-4 py-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-3">Fee</span>
          <span className="tnum font-medium">{aed(feeAed(terms))}</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-sm">
          <span className="text-ink-3">Total to repay</span>
          <span className="tnum font-semibold">{aed(totalRepayableAed(terms))}</span>
        </div>
      </div>

      {noteLabel && (
        <label className="block">
          <span className="text-xs uppercase tracking-wide text-ink-faint">{noteLabel}</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="mt-1 w-full resize-none rounded-[var(--radius-input)] border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-ink-3"
          />
        </label>
      )}

      <motion.button
        {...press}
        onClick={() => valid && onSubmit(terms, note.trim() || undefined)}
        disabled={!valid || busy}
        className="w-full rounded-full bg-ink py-3 text-sm font-medium text-paper transition-colors hover:bg-ink-2 disabled:opacity-50"
      >
        {busy ? "Working…" : submitLabel}
      </motion.button>
    </div>
  );
}

// ---- negotiation thread ----

const KIND_VERB: Record<DealEvent["kind"], string> = {
  requested: "requested",
  offered: "offered terms",
  countered: "countered",
  agreed: "agreed to terms",
  funded: "funded the advance",
  repaid: "repaid in full",
  declined: "declined",
  withdrawn: "withdrew the request",
  message: "noted",
};

function actorLabel(actor: DealEvent["actor"], deal: Deal): string {
  if (actor === "borrower") return deal.borrowerName;
  if (actor === "financier") return deal.financierName ?? "Financier";
  return "Dhow";
}

export function DealThread({ deal }: { deal: Deal }) {
  return (
    <motion.ol className="space-y-4" variants={stagger} initial="hidden" animate="show">
      {deal.events.map((e, i) => (
        <motion.li key={e.id} variants={riseItem} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span
              className={`mt-1 h-2.5 w-2.5 rounded-full ${
                e.actor === "borrower" ? "bg-teal" : e.actor === "financier" ? "bg-brass" : "bg-ink-faint"
              }`}
            />
            {i < deal.events.length - 1 && <span className="mt-1 w-px flex-1 bg-line" />}
          </div>
          <div className="-mt-0.5 pb-1">
            <p className="text-sm">
              <span className="font-medium text-ink">{actorLabel(e.actor, deal)}</span>{" "}
              <span className="text-ink-2">{KIND_VERB[e.kind]}</span>
            </p>
            {e.terms && (
              <p className="tnum mt-0.5 text-sm text-ink-3">
                {aed(e.terms.amountAed)} · {pct(e.terms.ratePct)} fee · {e.terms.tenorDays}d
              </p>
            )}
            {e.note && <p className="mt-0.5 text-sm text-ink-3">“{e.note}”</p>}
            <p className="mt-0.5 text-xs text-ink-faint">{relTime(e.createdAt)}</p>
          </div>
        </motion.li>
      ))}
    </motion.ol>
  );
}

function relTime(ts: number): string {
  // Rendered in event handlers / client effects only paths render this; keep it
  // resilient if ts is 0.
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export { MIN_TENOR_DAYS, MAX_TENOR_DAYS };
