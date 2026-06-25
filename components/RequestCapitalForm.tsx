"use client";

import { useState } from "react";
import { useCorridor } from "@/components/CorridorProvider";
import { TermsEditor } from "@/components/deal-ui";
import { aed } from "@/lib/corridor";
import { DEFAULT_RATE_PCT, DEFAULT_TENOR_DAYS, type DealTerms } from "@/lib/deal";

/*
 * Request working capital. A focused modal: set the amount and term, and the
 * request fans out to every financier on Dhow to bid on. Sized to the borrower's
 * settled corridors (their headroom).
 */
export function RequestCapitalForm({ onClose }: { onClose: () => void }) {
  const { score, maxAdvanceAed, requestCapital } = useCorridor();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(terms: DealTerms, note?: string) {
    setBusy(true);
    setErr(null);
    try {
      await requestCapital({ terms, purpose: note });
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not send the request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-6">
      <p className="text-sm text-ink-2">
        Your request goes to every financier on Dhow. They review your on-chain cashflow and bid; you
        accept the best.
      </p>
      <div className="my-4 flex items-center justify-between rounded-[var(--radius-card)] bg-teal-tint px-4 py-3">
        <span className="text-sm text-teal-deep">Your headroom</span>
        <span className="tnum font-display text-xl text-teal-deep">{aed(maxAdvanceAed)}</span>
      </div>
      <TermsEditor
        initial={{
          amountAed: Math.min(maxAdvanceAed, Math.round(score.avgCorridorAed * 0.3) || 10_000),
          ratePct: DEFAULT_RATE_PCT,
          tenorDays: DEFAULT_TENOR_DAYS,
        }}
        maxAmountAed={maxAdvanceAed}
        submitLabel="Send request →"
        busy={busy}
        noteLabel="What's it for? (optional)"
        onSubmit={submit}
      />
      {err && <p className="mt-3 text-sm text-danger">{err}</p>}
    </div>
  );
}
