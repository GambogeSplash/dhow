"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { useCredit } from "@/components/CreditProvider";
import { Avatar } from "@/components/Avatar";
import { ChainBadge } from "@/components/ChainBadge";
import { TermsSummary, pct } from "@/components/deal-ui";
import { aed } from "@/lib/credit";
import { totalRepayableAed, type Deal } from "@/lib/deal";
import { press } from "@/lib/motion";

/*
 * Accepting an offer is a real commitment, so it confirms in a modal: the exact
 * terms, what you repay and by when, and which financier disburses. Confirming
 * locks the terms (and, on a competing bid, declines the rivals).
 */
export function AcceptOfferForm({ dealId, onClose }: { dealId: string; onClose: () => void }) {
  const { deals, dealAction } = useCredit();
  const deal: Deal | undefined = deals.find((d) => d.id === dealId);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!deal) return <div className="p-6 text-sm text-ink-3">This offer is no longer available.</div>;

  async function accept() {
    setBusy(true);
    setErr(null);
    try {
      await dealAction({ action: "accept", dealId });
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not accept the offer.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between rounded-[var(--radius-card)] bg-surface-sunk px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar name={deal.financierName ?? "Financier"} size={38} />
          <div>
            <p className="font-medium">{deal.financierName}</p>
            <p className="text-sm text-ink-3">
              {pct(deal.terms.ratePct)} fee · {deal.terms.tenorDays} days
            </p>
          </div>
        </div>
        <p className="font-display tnum text-2xl text-brass-deep">{aed(deal.terms.amountAed)}</p>
      </div>

      <div className="mt-4">
        <TermsSummary terms={deal.terms} />
      </div>

      <p className="mt-4 rounded-[var(--radius-card)] bg-teal-tint/50 px-4 py-3 text-sm text-ink-2">
        You agree to repay {aed(totalRepayableAed(deal.terms))} within {deal.terms.tenorDays} days.{" "}
        {deal.financierName} disburses {aed(deal.terms.amountAed)} to your wallet on chain.
        {deal.requestId ? " Accepting this declines the other offers on your request." : ""}
      </p>

      <div className="mt-4 flex items-center justify-between">
        <ChainBadge />
        <div className="flex items-center gap-2">
          <button onClick={onClose} disabled={busy} className="rounded-full px-4 py-2 text-sm text-ink-3 hover:text-ink disabled:opacity-50">
            Not yet
          </button>
          <motion.button
            {...press}
            onClick={accept}
            disabled={busy}
            className="rounded-full bg-teal px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-deep disabled:opacity-50"
          >
            {busy ? "Accepting…" : `Accept ${aed(deal.terms.amountAed)}`}
          </motion.button>
        </div>
      </div>

      {err && <p className="mt-3 text-sm text-danger">{err}</p>}
    </div>
  );
}
