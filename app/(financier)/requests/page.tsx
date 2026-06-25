"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useFinancier } from "@/components/FinancierProvider";
import { useFinancierOverlays } from "@/components/financier-overlays";
import { Avatar } from "@/components/Avatar";
import { DealStatusPill, pct } from "@/components/deal-ui";
import { stagger, riseItem, rise } from "@/lib/motion";
import { aed } from "@/lib/corridor";
import { permissions, feeAed, type Deal } from "@/lib/deal";

/*
 * The deal desk inbox. Two things land here: fresh requests no financier has
 * claimed yet, and engaged deals where it is the financier's move (a borrower's
 * counter to review, or an agreed deal ready to fund). One actionable list, so
 * nothing waiting on Creek Capital slips through.
 */

interface Row {
  deal: Deal;
  isNew: boolean;
}

export default function RequestsPage() {
  const { requests, deals, borrowers } = useFinancier();
  const { openDeal } = useFinancierOverlays();

  // New, unclaimed requests, then engaged deals awaiting the financier's move,
  // most recently updated first.
  const actionable = deals.filter((d) => {
    const p = permissions(d, "financier");
    return p.canOffer || p.canCounter || p.canAccept || p.canFund;
  });
  const rows: Row[] = [
    ...requests.map((deal) => ({ deal, isNew: true })),
    ...actionable.map((deal) => ({ deal, isNew: false })),
  ].sort((a, b) => b.deal.updatedAt - a.deal.updatedAt);

  function locationFor(borrowerId: string): string | null {
    const b = borrowers.find((x) => x.id === borrowerId);
    return b ? `${b.city}, ${b.country}` : null;
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        {rows.length > 0 && (
          <span className="rounded-full bg-brass-tint px-3 py-1 text-xs font-medium text-brass-deep">
            {rows.length} awaiting you
          </span>
        )}
      </div>
      <h1 className="font-display mt-1 text-3xl tracking-tight">Requests</h1>
      <p className="mt-2 max-w-xl text-ink-2">
        Working-capital requests from scored borrowers, plus any deal where it is your move. Review
        the cashflow, then offer, counter, or fund.
      </p>

      {rows.length === 0 ? (
        <motion.div
          variants={rise}
          initial="hidden"
          animate="show"
          className="mt-6 rounded-[var(--radius-card)] border border-dashed border-line-strong bg-surface p-8 text-center"
        >
          <p className="font-medium">Nothing waiting on you</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-ink-3">
            New requests land here, and so do deals where the borrower has answered. In the meantime,
            scout the desk for borrowers to offer.
          </p>
          <Link
            href="/opportunities"
            className="mt-5 inline-block text-sm text-brass-deep underline underline-offset-2"
          >
            View opportunities →
          </Link>
        </motion.div>
      ) : (
        <motion.ul variants={stagger} initial="hidden" animate="show" className="mt-6 space-y-3">
          {rows.map(({ deal, isNew }) => {
            const location = locationFor(deal.borrowerId);
            return (
              <motion.li key={deal.id} variants={riseItem}>
                <button
                  onClick={() => openDeal(deal.borrowerId)}
                  className="flex w-full flex-wrap items-center justify-between gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5 text-left transition-colors hover:border-line-strong"
                >
                  <div className="flex min-w-56 items-center gap-3">
                    <Avatar name={deal.borrowerName} size={42} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{deal.borrowerName}</p>
                        {isNew && (
                          <span className="rounded-full bg-brass-tint px-2 py-0.5 text-[11px] font-medium text-brass-deep">
                            New request
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-ink-3">
                        {location ?? "Borrower"}
                        {deal.purpose ? <span className="text-ink-faint"> · {deal.purpose}</span> : null}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="font-display tnum text-xl text-brass-deep">{aed(deal.terms.amountAed)}</p>
                    <p className="tnum text-xs text-ink-faint">
                      {pct(deal.terms.ratePct)} fee · {aed(feeAed(deal.terms))} · {deal.terms.tenorDays}d
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <DealStatusPill deal={deal} viewer="financier" />
                    <span className="text-sm font-medium text-brass-deep">Review →</span>
                  </div>
                </button>
              </motion.li>
            );
          })}
        </motion.ul>
      )}
    </div>
  );
}
