"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "motion/react";
import { useFinancier } from "@/components/FinancierProvider";
import { FaucetCard } from "@/components/FaucetCard";
import { Avatar } from "@/components/Avatar";
import { ScoreCard, GradeBadge } from "@/components/score-viz";
import { DealStatusPill, TermsSummary, TermsEditor, DealThread, pct } from "@/components/deal-ui";
import { aed, usdcLabel } from "@/lib/corridor";
import {
  permissions,
  totalRepayableAed,
  CLOSED_STATUSES,
  DEFAULT_RATE_PCT,
  DEFAULT_TENOR_DAYS,
  type Deal,
  type DealTerms,
} from "@/lib/deal";
import { springPop, rise, press } from "@/lib/motion";

function shortHash(h: string): string {
  if (h.includes("…")) return h;
  return h.length > 14 ? `${h.slice(0, 6)}…${h.slice(-4)}` : h;
}

/*
 * The borrower review + negotiation surface, extracted so it lives in a drawer
 * opened from any list (Desk / Opportunities / Requests), keeping the list
 * behind it. `onClose` is fired after a terminal action (fund) so the drawer
 * dismisses; the /deal/[business] route still deep-links to it.
 */
export function DealReview({ borrowerId, onClose }: { borrowerId: string; onClose: () => void }) {
  const { borrowers, deals, requests, dealAction, offerToBorrower, walletAddress } = useFinancier();

  const now = Date.now();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<"offer" | "counter" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const borrower = borrowers.find((b) => b.id === borrowerId);

  const deal =
    [...deals, ...requests].find(
      (d) => d.borrowerId === borrowerId && !CLOSED_STATUSES.includes(d.status),
    ) ?? null;

  if (!borrower) {
    return (
      <div className="py-16 text-center">
        <p className="font-medium">Borrower not found</p>
        <p className="mt-1 text-sm text-ink-3">It may not have settled a payment in this session yet.</p>
      </div>
    );
  }

  const settled = borrower.corridors.filter((c) => c.status === "settled");
  const perms = deal ? permissions(deal, "financier") : null;

  async function run(fn: () => Promise<void>, closeAfter?: boolean) {
    setErr(null);
    setBusy(true);
    try {
      await fn();
      setEditing(null);
      if (closeAfter) onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar name={borrower.name} size={52} />
          <div>
            <h1 className="font-display text-2xl tracking-tight">{borrower.name}</h1>
            <p className="mt-1 text-ink-3">
              {borrower.city}, {borrower.country}
              {borrower.wallet ? (
                <span className="tnum font-mono text-sm text-ink-faint">
                  {" · "}
                  {borrower.wallet.slice(0, 6)}…{borrower.wallet.slice(-4)}
                </span>
              ) : null}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {deal && <DealStatusPill deal={deal} viewer="financier" />}
          {borrower.onchainScore !== null && (
            <span className="rounded-full bg-teal-tint px-3 py-1 text-xs font-medium text-teal-deep">
              Verified on-chain
            </span>
          )}
          <GradeBadge grade={borrower.credit.grade} size={36} />
        </div>
      </div>

      <div className="mt-6 space-y-8">
        <section>
          <h2 className="mb-3 text-sm font-medium text-ink-2">Credit assessment</h2>
          {/* v2 underwriting summary: grade, approved line, price, structure. */}
          <div className="mb-3 grid grid-cols-2 gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:grid-cols-4">
            <Underwrite label="Grade" value={borrower.credit.grade} accent />
            <Underwrite label="Approved line" value={aed(borrower.credit.limitAed)} />
            <Underwrite label="Indicative rate" value={`${borrower.credit.aprPct}% APR`} />
            <Underwrite
              label="Repayment sweep"
              value={`${borrower.credit.structure.repaymentSweepPct}% of inflow`}
            />
          </div>
          <ScoreCard score={borrower.score} verifiedOnChain={borrower.onchainScore !== null} />

          {/* --- negotiation panel --- */}
          {!deal ? (
            <motion.div
              variants={rise}
              initial="hidden"
              animate="show"
              className="mt-4 rounded-[var(--radius-card)] border border-brass/40 bg-surface p-5"
            >
              <p className="text-xs uppercase tracking-wide text-ink-faint">Make an offer</p>
              <p className="mt-1 text-sm text-ink-3">
                Propose working-capital terms to {borrower.name}, sized to their{" "}
                {aed(borrower.score.avgCorridorAed)} average corridor. They can accept or counter.
              </p>
              <div className="mt-4 border-t border-line pt-4">
                <TermsEditor
                  initial={{
                    amountAed: borrower.offerAed || Math.round(borrower.score.avgCorridorAed * 0.3) || 10_000,
                    ratePct: DEFAULT_RATE_PCT,
                    tenorDays: DEFAULT_TENOR_DAYS,
                  }}
                  submitLabel="Send offer →"
                  busy={busy}
                  noteLabel="Add a note (optional)"
                  onSubmit={(terms: DealTerms, note) =>
                    run(() =>
                      offerToBorrower({ borrowerId: borrower!.id, borrowerName: borrower!.name, terms, note }),
                    )
                  }
                />
              </div>
            </motion.div>
          ) : deal.status === "funded" ? (
            <FundedCard deal={deal} now={now} />
          ) : (
            <motion.div
              variants={rise}
              initial="hidden"
              animate="show"
              className="mt-4 rounded-[var(--radius-card)] border border-brass/40 bg-surface p-5"
            >
              <p className="text-xs uppercase tracking-wide text-ink-faint">
                {deal.status === "agreed" ? "Agreed, ready to fund" : "On the table"}
              </p>
              <p className="font-display tnum mt-1 text-4xl tracking-tight text-brass-deep">
                {aed(deal.terms.amountAed)}
              </p>
              <p className="mt-1 text-sm text-ink-3">
                {pct(deal.terms.ratePct)} fee · {deal.terms.tenorDays} days · repay{" "}
                {aed(totalRepayableAed(deal.terms))}
              </p>

              {editing ? (
                <div className="mt-4 border-t border-line pt-4">
                  <TermsEditor
                    initial={deal.terms}
                    submitLabel={editing === "offer" ? "Send offer →" : "Send counter →"}
                    busy={busy}
                    noteLabel="Add a note (optional)"
                    onSubmit={(terms: DealTerms, note) =>
                      run(() => dealAction({ action: editing, dealId: deal.id, terms, note }))
                    }
                  />
                  <button
                    onClick={() => setEditing(null)}
                    className="mt-2 w-full text-center text-sm text-ink-3 hover:text-ink"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                  {perms?.canFund && (
                    <motion.button
                      {...press}
                      onClick={() => run(() => dealAction({ action: "fund", dealId: deal.id }), true)}
                      disabled={busy}
                      className="flex-1 rounded-full bg-brass py-2.5 text-sm font-medium text-white transition-colors hover:bg-brass-deep disabled:opacity-50"
                    >
                      {busy ? "Funding…" : `Fund ${aed(deal.terms.amountAed)} →`}
                    </motion.button>
                  )}
                  {perms?.canAccept && (
                    <motion.button
                      {...press}
                      onClick={() => run(() => dealAction({ action: "accept", dealId: deal.id }))}
                      disabled={busy}
                      className="flex-1 rounded-full bg-teal py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-deep disabled:opacity-50"
                    >
                      Accept {aed(deal.terms.amountAed)}
                    </motion.button>
                  )}
                  {perms?.canOffer && (
                    <button
                      onClick={() => setEditing("offer")}
                      disabled={busy}
                      className="flex-1 rounded-full border border-line py-2.5 text-sm font-medium text-ink transition-colors hover:bg-surface-sunk disabled:opacity-50"
                    >
                      Make an offer
                    </button>
                  )}
                  {perms?.canCounter && (
                    <button
                      onClick={() => setEditing("counter")}
                      disabled={busy}
                      className="flex-1 rounded-full border border-line py-2.5 text-sm font-medium text-ink transition-colors hover:bg-surface-sunk disabled:opacity-50"
                    >
                      Counter
                    </button>
                  )}
                  {perms?.canDecline && (
                    <button
                      onClick={() => run(() => dealAction({ action: "decline", dealId: deal.id }))}
                      disabled={busy}
                      className="rounded-full px-4 py-2.5 text-sm text-ink-3 transition-colors hover:text-danger disabled:opacity-50"
                    >
                      Decline
                    </button>
                  )}
                  {!perms?.canFund && !perms?.canAccept && !perms?.canOffer && !perms?.canCounter && (
                    <p className="w-full pt-1 text-sm text-ink-3">Waiting for {borrower.name} to respond.</p>
                  )}
                </div>
              )}

              <div className="mt-4 border-t border-line pt-4">
                <TermsSummary terms={deal.terms} />
              </div>
            </motion.div>
          )}

          {deal && (
            <div className="mt-4 rounded-[var(--radius-card)] border border-line bg-surface p-5">
              <p className="mb-4 text-sm font-medium text-ink-2">Negotiation</p>
              <DealThread deal={deal} />
            </div>
          )}

          {err && <p className="mt-3 text-sm text-danger">{err}</p>}

          {(!deal || deal.status !== "funded") && (
            <div className="mt-4">
              <FaucetCard walletAddress={walletAddress} />
            </div>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-ink-2">Verified settlements</h2>
            <span className="tnum font-mono text-xs text-ink-faint">
              {aed(borrower.score.trailingValueAed)} settled
            </span>
          </div>
          <div className="space-y-3">
            {settled.map((c) => (
              <div key={c.id} className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <Avatar name={c.supplier.name} size={36} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="tnum font-mono text-xs text-ink-faint">{c.ref}</span>
                        <span className="rounded-full bg-teal-tint px-2 py-0.5 text-[11px] font-medium text-teal-deep">
                          Settled
                        </span>
                      </div>
                      <p className="mt-1 font-medium">{c.supplier.name}</p>
                      <p className="text-sm text-ink-3">{c.goods}</p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-display tnum text-xl">{aed(c.amountAed)}</p>
                    <p className="tnum font-mono text-xs text-ink-faint">{usdcLabel(c.amountUsdc)}</p>
                  </div>
                </div>
                {(c.proof || c.explorerUrl) && (
                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3 text-xs">
                    <span className="text-ink-3">
                      {c.proof ? (
                        <>
                          <span className="text-ink-faint">Proof · </span>
                          {c.proof.label}
                          {c.proof.attestedBy ? ` · ${c.proof.attestedBy}` : ""}
                        </>
                      ) : (
                        <span className="text-ink-faint">Open settlement</span>
                      )}
                    </span>
                    {c.explorerUrl && c.txHash && (
                      <a
                        href={c.explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="tnum font-mono text-teal-deep underline decoration-teal/30 underline-offset-2 hover:decoration-teal"
                      >
                        {shortHash(c.txHash)} ↗
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-ink-3">
            Every figure is a payment Dhow settled and verified on-chain. {borrower.name} was a borrower banks
            reject, made legible.
          </p>
        </section>
      </div>
    </div>
  );
}

/** A funded deal: the disbursed advance, the live terms, and the settlement tx. */
function Underwrite({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="text-xs text-ink-faint">{label}</p>
      <p className={`tnum mt-0.5 font-display text-lg ${accent ? "text-teal-deep" : "text-ink"}`}>{value}</p>
    </div>
  );
}

function FundedCard({ deal, now }: { deal: Deal; now: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={springPop}
      className="mt-4 overflow-hidden rounded-[var(--radius-card)] border border-brass/40 bg-surface"
    >
      <div className="bg-brass-tint px-5 py-5">
        <p className="text-xs uppercase tracking-wide text-brass-deep">Capital deployed</p>
        <p className="font-display tnum mt-1 text-4xl tracking-tight text-brass-deep">
          {aed(deal.terms.amountAed)}
        </p>
        <p className="mt-1 text-sm text-ink-3">
          Disbursed to {deal.borrowerName}
          {deal.explorerUrl && deal.txHash && (
            <>
              {" · "}
              <a
                href={deal.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="tnum font-mono text-teal-deep underline decoration-teal/30 underline-offset-2 hover:decoration-teal"
              >
                {shortHash(deal.txHash)} ↗
              </a>
            </>
          )}
        </p>
      </div>
      <div className="px-5">
        <TermsSummary terms={deal.terms} dueAt={deal.dueAt} now={now} />
      </div>
      <div className="px-5 pb-5 pt-1">
        <Link href="/portfolio" className="inline-block text-sm text-brass-deep underline underline-offset-2">
          View in Portfolio →
        </Link>
      </div>
    </motion.div>
  );
}
