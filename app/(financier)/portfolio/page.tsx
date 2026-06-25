"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useFinancier } from "@/components/FinancierProvider";
import { Avatar } from "@/components/Avatar";
import { DealStatusPill, pct } from "@/components/deal-ui";
import { stagger, riseItem, rise } from "@/lib/motion";
import { aed } from "@/lib/corridor";
import { FINANCIER } from "@/lib/financier";
import { totalRepayableAed, daysUntil } from "@/lib/deal";

function shortHash(h: string): string {
  if (h.includes("…")) return h;
  return h.length > 14 ? `${h.slice(0, 6)}…${h.slice(-4)}` : h;
}

export default function PortfolioPage() {
  const { deals } = useFinancier();
  const now = Date.now();

  // The book: deals that have been disbursed, live or closed clean.
  const book = deals.filter((d) => d.status === "funded" || d.status === "repaid");
  // Funded first, then repaid; within each, most recent first.
  const rows = [...book].sort(
    (a, b) =>
      Number(a.status === "repaid") - Number(b.status === "repaid") ||
      (b.fundedAt ?? b.updatedAt) - (a.fundedAt ?? a.updatedAt),
  );

  const funded = book.filter((d) => d.status === "funded");
  const deployedAed = funded.reduce((s, d) => s + d.terms.amountAed, 0);
  const availableAed = Math.max(0, FINANCIER.appetiteAed - deployedAed);
  const repaidCount = book.filter((d) => d.status === "repaid").length;

  return (
    <div>
      <p className="text-sm text-ink-3">Portfolio</p>
      <h1 className="font-display mt-1 text-3xl tracking-tight">Facilities</h1>
      <p className="mt-2 max-w-xl text-ink-2">
        Capital deployed against verified settlements. The facility stays safe while the borrower keeps
        settling on Dhow: the loan is repaid out of the next settlement.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Metric label="Deployed" value={aed(deployedAed)} sub={`${funded.length} active`} tone="brass" />
        <Metric label="Available" value={aed(availableAed)} tone="ink" />
        <Metric
          label="Repaid"
          value={`${repaidCount}`}
          sub={repaidCount === 1 ? "facility" : "facilities"}
          tone="ink"
        />
      </div>

      {book.length === 0 ? (
        <motion.div
          variants={rise}
          initial="hidden"
          animate="show"
          className="mt-6 rounded-[var(--radius-card)] border border-dashed border-line-strong bg-surface p-8 text-center"
        >
          <p className="font-medium">No facilities yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-ink-3">
            Agree terms with a borrower and fund the advance, and it appears here.
          </p>
          <Link href="/requests" className="mt-5 inline-block text-sm text-brass-deep underline underline-offset-2">
            View requests →
          </Link>
        </motion.div>
      ) : (
        <motion.ul variants={stagger} initial="hidden" animate="show" className="mt-6 space-y-3">
          {rows.map((d) => (
            <motion.li
              key={d.id}
              variants={riseItem}
              className="rounded-[var(--radius-card)] border border-line bg-surface p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex min-w-48 items-center gap-3">
                  <Avatar name={d.borrowerName} size={40} />
                  <div>
                    <p className="font-medium">{d.borrowerName}</p>
                    <p className="text-sm text-ink-3">
                      {pct(d.terms.ratePct)} fee · {d.terms.tenorDays}d
                      {d.fundedAt && (
                        <span className="text-ink-faint">
                          {" · "}funded {new Date(d.fundedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="font-display tnum text-xl text-brass-deep">{aed(d.terms.amountAed)}</p>
                  <p className="tnum text-xs text-ink-faint">repay {aed(totalRepayableAed(d.terms))}</p>
                </div>

                <DealStatusPill deal={d} viewer="financier" />
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3 text-sm">
                <span className="text-ink-3">
                  {d.status === "repaid" ? (
                    <>
                      <span className="text-ink-faint">Closed clean</span>
                      {d.repaidAt
                        ? ` · ${new Date(d.repaidAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
                        : ""}
                    </>
                  ) : d.dueAt ? (
                    <>
                      <span className="text-ink-faint">Due in </span>
                      <span className="tnum font-medium text-ink-2">{Math.max(0, daysUntil(d.dueAt, now))} days</span>
                    </>
                  ) : (
                    <span className="text-ink-faint">Funded</span>
                  )}
                </span>
                {(d.status === "repaid" ? d.repayExplorerUrl && d.repayTxHash : d.explorerUrl && d.txHash) && (
                  <a
                    href={(d.status === "repaid" ? d.repayExplorerUrl : d.explorerUrl)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="tnum font-mono text-teal-deep underline decoration-teal/30 underline-offset-2 hover:decoration-teal"
                  >
                    {shortHash((d.status === "repaid" ? d.repayTxHash : d.txHash)!)} ↗
                  </a>
                )}
              </div>
            </motion.li>
          ))}
        </motion.ul>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: "ink" | "brass";
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
      <p className="text-xs uppercase tracking-wide text-ink-faint">{label}</p>
      <p className={`font-display tnum mt-2 text-2xl ${tone === "brass" ? "text-brass-deep" : "text-ink"}`}>
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-ink-3">{sub}</p>}
    </div>
  );
}
