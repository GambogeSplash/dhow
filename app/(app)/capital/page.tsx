"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "motion/react";
import { useCorridor } from "@/components/CorridorProvider";
import { Avatar } from "@/components/Avatar";
import { DealStatusPill, TermsSummary, TermsEditor, DealThread, pct } from "@/components/deal-ui";
import { aed, ELIGIBLE_THRESHOLD } from "@/lib/corridor";
import {
  permissions,
  feeAed,
  totalRepayableAed,
  daysUntil,
  DEFAULT_RATE_PCT,
  DEFAULT_TENOR_DAYS,
  type DealTerms,
} from "@/lib/deal";
import { springPop, springSoft, rise, press } from "@/lib/motion";

export default function CapitalPage() {
  const { score, business, financier, activeDeal, maxAdvanceAed, requestCapital, dealAction } =
    useCorridor();

  const now = Date.now();
  const [busy, setBusy] = useState(false);
  const [countering, setCountering] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run(fn: () => Promise<void>) {
    setErr(null);
    setBusy(true);
    try {
      await fn();
      setCountering(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  // Gate: no deal yet and not eligible → locked.
  if (!activeDeal && !score.eligible) {
    return (
      <div className="mx-auto max-w-xl">
        <p className="text-sm text-ink-3">Capital</p>
        <h1 className="font-display mt-1 text-3xl tracking-tight">Working capital</h1>
        <motion.div
          variants={rise}
          initial="hidden"
          animate="show"
          className="mt-6 rounded-[var(--radius-card)] border border-line bg-surface p-8 text-center"
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface-sunk">
            <LockIcon />
          </div>
          <p className="mt-4 font-medium">Not yet unlocked</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-ink-3">
            You can request working capital once your Credit Score crosses {ELIGIBLE_THRESHOLD}.
            You&apos;re at {score.score}. Settle another corridor to get there.
          </p>
          <Link
            href="/corridor"
            className="mt-5 inline-block rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper"
          >
            View Cashflow Record →
          </Link>
        </motion.div>
      </div>
    );
  }

  const perms = activeDeal ? permissions(activeDeal, "borrower") : null;

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* deal lifecycle — borrower side */}
      <section>
        <div className="flex items-center justify-between">
          <p className="text-sm text-ink-3">Capital</p>
          {activeDeal && <DealStatusPill deal={activeDeal} viewer="borrower" />}
        </div>
        <h1 className="font-display mt-1 text-3xl tracking-tight">
          {!activeDeal
            ? "Request working capital"
            : activeDeal.status === "funded"
              ? "Your facility"
              : "Your deal"}
        </h1>

        {/* --- no deal: request form --- */}
        {!activeDeal && (
          <motion.div variants={rise} initial="hidden" animate="show" className="mt-5">
            <p className="text-ink-2">
              Ask {financier.name} for an advance against your settled corridors. You set the
              amount and term; they respond with an offer you can accept or counter.
            </p>
            <div className="mt-5 rounded-[var(--radius-card)] border border-line bg-surface p-5">
              <div className="mb-4 flex items-center justify-between rounded-[var(--radius-card)] bg-teal-tint px-4 py-3">
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
                onSubmit={(terms, note) => run(() => requestCapital({ terms, purpose: note }))}
              />
            </div>
          </motion.div>
        )}

        {/* --- open negotiation --- */}
        {activeDeal && ["requested", "offered", "countered"].includes(activeDeal.status) && (
          <motion.div variants={rise} initial="hidden" animate="show" className="mt-5 space-y-5">
            <div className="rounded-[var(--radius-card)] border border-brass/40 bg-surface p-5">
              <p className="text-xs uppercase tracking-wide text-ink-faint">
                {activeDeal.status === "requested" ? "Your request" : "On the table"}
              </p>
              <p className="font-display tnum mt-1 text-4xl tracking-tight text-brass-deep">
                {aed(activeDeal.terms.amountAed)}
              </p>
              <p className="mt-1 text-sm text-ink-3">
                {pct(activeDeal.terms.ratePct)} fee · {activeDeal.terms.tenorDays} days · repay{" "}
                {aed(totalRepayableAed(activeDeal.terms))}
              </p>

              {countering ? (
                <div className="mt-4 border-t border-line pt-4">
                  <TermsEditor
                    initial={activeDeal.terms}
                    maxAmountAed={maxAdvanceAed}
                    submitLabel="Send counter →"
                    busy={busy}
                    noteLabel="Add a note (optional)"
                    onSubmit={(terms: DealTerms, note) =>
                      run(() => dealAction({ action: "counter", dealId: activeDeal.id, terms, note }))
                    }
                  />
                  <button
                    onClick={() => setCountering(false)}
                    className="mt-2 w-full text-center text-sm text-ink-3 hover:text-ink"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                  {perms?.canAccept && (
                    <motion.button
                      {...press}
                      onClick={() => run(() => dealAction({ action: "accept", dealId: activeDeal.id }))}
                      disabled={busy}
                      className="flex-1 rounded-full bg-teal py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-deep disabled:opacity-50"
                    >
                      Accept {aed(activeDeal.terms.amountAed)}
                    </motion.button>
                  )}
                  {perms?.canCounter && (
                    <button
                      onClick={() => setCountering(true)}
                      disabled={busy}
                      className="flex-1 rounded-full border border-line py-2.5 text-sm font-medium text-ink transition-colors hover:bg-surface-sunk disabled:opacity-50"
                    >
                      Counter
                    </button>
                  )}
                  {perms?.canWithdraw && (
                    <button
                      onClick={() => run(() => dealAction({ action: "withdraw", dealId: activeDeal.id }))}
                      disabled={busy}
                      className="rounded-full px-4 py-2.5 text-sm text-ink-3 transition-colors hover:text-danger disabled:opacity-50"
                    >
                      Withdraw
                    </button>
                  )}
                  {activeDeal.status === "requested" && (
                    <p className="w-full pt-1 text-sm text-ink-3">
                      Waiting for {financier.name} to respond with an offer.
                    </p>
                  )}
                </div>
              )}
            </div>

            <DealTimeline deal={activeDeal} />
          </motion.div>
        )}

        {/* --- agreed, awaiting disbursement --- */}
        {activeDeal && activeDeal.status === "agreed" && (
          <motion.div variants={rise} initial="hidden" animate="show" className="mt-5 space-y-5">
            <div className="rounded-[var(--radius-card)] border border-teal/40 bg-surface p-5">
              <p className="font-medium text-teal-deep">Terms agreed</p>
              <p className="mt-1 text-sm text-ink-3">
                {financier.name} is disbursing {aed(activeDeal.terms.amountAed)} to your wallet.
              </p>
              <div className="mt-4 border-t border-line pt-4">
                <TermsSummary terms={activeDeal.terms} />
              </div>
            </div>
            <DealTimeline deal={activeDeal} />
          </motion.div>
        )}

        {/* --- funded: active facility + repay --- */}
        {activeDeal && activeDeal.status === "funded" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={springPop}
            className="mt-5 space-y-5"
          >
            <div className="overflow-hidden rounded-[var(--radius-card)] border border-teal/40 bg-surface">
              <div className="bg-teal-tint px-6 py-6">
                <p className="text-xs uppercase tracking-wide text-teal-deep">Capital landed</p>
                <p className="font-display tnum mt-1 text-5xl tracking-tight text-teal-deep">
                  {aed(activeDeal.terms.amountAed)}
                </p>
                <p className="mt-1 text-sm text-ink-3">Disbursed to {business?.name} by {financier.name}</p>
              </div>
              <div className="px-6">
                <TermsSummary terms={activeDeal.terms} dueAt={activeDeal.dueAt} now={now} />
              </div>
              <div className="px-6 py-5">
                <div className="mb-3 flex items-center justify-between rounded-[var(--radius-card)] bg-surface-sunk px-4 py-3 text-sm">
                  <span className="text-ink-3">Due in</span>
                  <span className="tnum font-medium">
                    {activeDeal.dueAt ? Math.max(0, daysUntil(activeDeal.dueAt, now)) : activeDeal.terms.tenorDays} days
                  </span>
                </div>
                <motion.button
                  {...press}
                  onClick={() => run(() => dealAction({ action: "repay", dealId: activeDeal.id }))}
                  disabled={busy}
                  className="w-full rounded-full bg-ink py-3 text-sm font-medium text-paper transition-colors hover:bg-ink-2 disabled:opacity-50"
                >
                  {busy ? "Repaying…" : `Repay ${aed(totalRepayableAed(activeDeal.terms))}`}
                </motion.button>
                <p className="mt-2 text-center text-xs text-ink-faint">
                  Principal {aed(activeDeal.terms.amountAed)} + fee {aed(feeAed(activeDeal.terms))}
                </p>
              </div>
            </div>
            <DealTimeline deal={activeDeal} />
          </motion.div>
        )}

        {err && <p className="mt-3 text-sm text-danger">{err}</p>}
      </section>

      {/* what the financier sees */}
      <section>
        <p className="text-sm text-ink-3">What {financier.name} sees</p>
        <h2 className="font-display mt-1 text-2xl tracking-tight">
          A borrower banks reject, made legible
        </h2>
        <p className="mt-2 text-ink-2">{financier.blurb}</p>

        <motion.div
          variants={rise}
          initial="hidden"
          animate="show"
          transition={springSoft}
          className="mt-6 rounded-[var(--radius-card)] border border-line bg-surface p-6"
        >
          <div className="flex items-center justify-between border-b border-line pb-4">
            <div className="flex items-center gap-3">
              <Avatar name={business?.name ?? "Business"} size={38} />
              <div>
                <p className="font-medium">{business?.name}</p>
                <p className="text-sm text-ink-3">
                  {business?.city}, {business?.country}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="tnum font-display text-2xl text-teal-deep">{score.score}</p>
              <p className="text-xs text-ink-faint">Credit Score</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 py-4">
            <Metric label="Verified settled volume" value={aed(score.trailingValueAed)} />
            <Metric label="Proof performance" value={`${Math.round(score.proofMetRatio * 100)}% clean`} />
            <Metric label="Avg settlement" value={aed(score.avgCorridorAed)} />
            <Metric label="Data" value="Live on-chain feed" accent />
          </div>

          <p className="border-t border-line pt-4 text-sm text-ink-2">
            Every figure here is a payment Dhow settled and verified on-chain. {financier.name}{" "}
            underwrites the cashflow it can see, not an attestation it has to trust. The feed stays
            live only while {business?.name} keeps settling on Dhow.
          </p>
        </motion.div>
      </section>
    </div>
  );
}

function DealTimeline({ deal }: { deal: ReturnType<typeof useCorridor>["activeDeal"] }) {
  if (!deal) return null;
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
      <p className="mb-4 text-sm font-medium text-ink-2">Negotiation</p>
      <DealThread deal={deal} />
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="text-xs text-ink-faint">{label}</p>
      <p className={`tnum mt-0.5 font-medium ${accent ? "text-teal-deep" : "text-ink"}`}>{value}</p>
    </div>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-ink-3" fill="none">
      <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
