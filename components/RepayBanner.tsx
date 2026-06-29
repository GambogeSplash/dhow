"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useCorridor } from "@/components/CorridorProvider";
import { aed } from "@/lib/credit";
import { springSoft, press } from "@/lib/motion";

/*
 * The anti-disintermediation mechanic, made literal. When a borrower settles a
 * payment while a facility is outstanding, this offers to clear it from that
 * settlement in one tap. Consent stays explicit (no silent debit), but the loop
 * "you keep settling on Dhow, the facility repays itself" becomes a real action.
 */
export function RepayBanner() {
  const { repayPrompt, dealAction, dismissRepayPrompt } = useCorridor();
  const [busy, setBusy] = useState(false);

  async function repay() {
    if (!repayPrompt) return;
    setBusy(true);
    try {
      await dealAction({ action: "repay", dealId: repayPrompt.dealId });
      dismissRepayPrompt();
    } finally {
      setBusy(false);
    }
  }

  return (
    <AnimatePresence>
      {repayPrompt && (
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={springSoft}
          className="border-b border-brass/40 bg-brass-tint"
        >
          <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-3">
            <p className="text-sm text-brass-deep">
              <span className="font-medium">{repayPrompt.corridorRef} settled.</span> Clear your{" "}
              {aed(repayPrompt.amountAed)} facility with {repayPrompt.financierName} from this settlement?
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={dismissRepayPrompt}
                disabled={busy}
                className="rounded-full px-3 py-1.5 text-sm text-ink-3 transition-colors hover:text-ink disabled:opacity-50"
              >
                Not now
              </button>
              <motion.button
                {...press}
                onClick={repay}
                disabled={busy}
                className="rounded-full bg-brass px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brass-deep disabled:opacity-50"
              >
                {busy ? "Repaying…" : `Repay ${aed(repayPrompt.amountAed)}`}
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
