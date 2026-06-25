"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "motion/react";
import { useCorridor } from "@/components/CorridorProvider";
import { useOverlays } from "@/components/overlays";
import { Avatar } from "@/components/Avatar";
import { ChainBadge } from "@/components/ChainBadge";
import { DealStatusPill, TermsSummary, TermsEditor, DealThread, pct } from "@/components/deal-ui";
import { aed, ELIGIBLE_THRESHOLD } from "@/lib/corridor";
import {
  permissions,
  feeAed,
  totalRepayableAed,
  daysUntil,
  statusLabel,
  type Deal,
  type DealTerms,
} from "@/lib/deal";
import { springPop, springSoft, rise, stagger, riseItem, press } from "@/lib/motion";

export default function CapitalPage() {
  const { score, business, deals, maxAdvanceAed, dealAction } = useCorridor();
  const { openAccept, openRequestCapital } = useOverlays();

  const now = Date.now();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run(fn: () => Promise<void>) {
    setErr(null);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  // Slice the borrower's deals into the things the page shows at once.
  const facility = deals.find((d) => d.status === "funded" || d.status === "agreed") ?? null;
  const request = deals.find((d) => d.status === "requested") ?? null;
  const bids = request
    ? deals
        .filter((d) => d.requestId === request.id && (d.status === "offered" || d.status === "countered"))
        .sort((a, b) => a.terms.ratePct - b.terms.ratePct)
    : [];
  const single =
    bids.length === 0
      ? deals.find((d) => (d.status === "offered" || d.status === "countered") && !d.requestId) ?? null
      : null;
  const closed = deals.filter((d) => ["repaid", "declined", "withdrawn"].includes(d.status));
  const negotiating = !!request || !!single;

  // Nothing at all and not eligible yet: the locked state.
  if (deals.length === 0 && !score.eligible) {
    return (
      <div className="mx-auto max-w-xl">
        <h1 className="font-display text-3xl tracking-tight">Working capital</h1>
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
            You can request working capital once your Credit Score crosses {ELIGIBLE_THRESHOLD}. You&apos;re
            at {score.score}. Settle another corridor to get there.
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

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* borrower side */}
      <section className="space-y-6">
        <h1 className="font-display text-3xl tracking-tight">Working capital</h1>

        {/* active facility */}
        {facility && <FacilityCard deal={facility} now={now} busy={busy} onRepay={() => run(() => dealAction({ action: "repay", dealId: facility.id }))} business={business?.name} />}

        {/* competing offers */}
        {request && bids.length > 0 && (
          <OffersComparison request={request} bids={bids} busy={busy} onAccept={(id) => openAccept(id)} />
        )}

        {/* request submitted, no offers yet */}
        {request && bids.length === 0 && (
          <motion.div variants={rise} initial="hidden" animate="show" className="rounded-[var(--radius-card)] border border-brass/40 bg-surface p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-ink-faint">Request out to the network</p>
              <DealStatusPill deal={request} viewer="borrower" />
            </div>
            <p className="font-display tnum mt-1 text-4xl tracking-tight text-brass-deep">{aed(request.terms.amountAed)}</p>
            <p className="mt-1 text-sm text-ink-3">
              {pct(request.terms.ratePct)} fee · {request.terms.tenorDays} days. Financiers on Dhow are
              reviewing your cashflow; offers land here.
            </p>
            <div className="mt-4 flex gap-2 border-t border-line pt-4">
              <button
                onClick={() => run(() => dealAction({ action: "withdraw", dealId: request.id }))}
                disabled={busy}
                className="rounded-full px-4 py-2 text-sm text-ink-3 transition-colors hover:text-danger disabled:opacity-50"
              >
                Withdraw request
              </button>
            </div>
          </motion.div>
        )}

        {/* a single (non-competitive) negotiation, e.g. a proactive offer */}
        {single && <SingleNegotiation deal={single} maxAdvanceAed={maxAdvanceAed} busy={busy} run={run} dealAction={dealAction} onAccept={openAccept} />}

        {/* request entry when nothing is in negotiation */}
        {!negotiating && score.eligible && (
          <motion.div variants={rise} initial="hidden" animate="show" className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
            <p className="font-medium">{facility ? "Need more capital?" : "Raise working capital"}</p>
            <p className="mt-1 text-sm text-ink-2">
              Send a request and every financier on Dhow competes to fund it. Your headroom is{" "}
              <span className="tnum font-medium text-ink">{aed(maxAdvanceAed)}</span>.
            </p>
            <motion.button
              {...press}
              onClick={openRequestCapital}
              className="mt-4 rounded-full bg-teal px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-deep"
            >
              {facility ? "Request more capital →" : "Request working capital →"}
            </motion.button>
          </motion.div>
        )}

        {/* history */}
        {closed.length > 0 && <DealHistory deals={closed} />}

        {err && <p className="text-sm text-danger">{err}</p>}
      </section>

      {/* what the financier sees */}
      <section>
        <p className="text-sm text-ink-3">What financiers see</p>
        <h2 className="font-display mt-1 text-2xl tracking-tight">A borrower banks reject, made legible</h2>
        <p className="mt-2 text-ink-2">
          Your request fans out to every financier on Dhow. They underwrite the cashflow they can see on
          chain, then compete for it.
        </p>

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
            Every figure here is a payment Dhow settled and verified on-chain. The feed stays live only
            while {business?.name} keeps settling on Dhow.
          </p>
        </motion.div>
      </section>
    </div>
  );
}

/* ---- sections ---- */

function OffersComparison({
  request,
  bids,
  busy,
  onAccept,
}: {
  request: Deal;
  bids: Deal[];
  busy: boolean;
  onAccept: (dealId: string) => void;
}) {
  const best = bids[0]?.id; // lowest fee, pre-sorted
  return (
    <motion.div variants={rise} initial="hidden" animate="show">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-ink-2">
          {bids.length} offer{bids.length === 1 ? "" : "s"} on your {aed(request.terms.amountAed)} request
        </p>
        <span className="text-xs text-ink-faint">sorted by fee</span>
      </div>
      <motion.div variants={stagger} initial="hidden" animate="show" className="mt-3 space-y-3">
        {bids.map((bid) => (
          <motion.div
            key={bid.id}
            variants={riseItem}
            className={`rounded-[var(--radius-card)] border bg-surface p-4 ${
              bid.id === best ? "border-teal/50 ring-1 ring-teal/30" : "border-line"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Avatar name={bid.financierName ?? "Financier"} size={36} />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{bid.financierName}</p>
                    {bid.id === best && (
                      <span className="rounded-full bg-teal-tint px-2 py-0.5 text-[11px] font-medium text-teal-deep">
                        Best rate
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-ink-3">
                    {pct(bid.terms.ratePct)} fee · {bid.terms.tenorDays} days
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-display tnum text-xl text-brass-deep">{aed(bid.terms.amountAed)}</p>
                <p className="tnum text-xs text-ink-faint">repay {aed(totalRepayableAed(bid.terms))}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
              <p className="text-xs text-ink-3">
                Fee {aed(feeAed(bid.terms))}
                {bid.events.at(-1)?.note ? <span className="text-ink-faint"> · “{bid.events.at(-1)!.note}”</span> : null}
              </p>
              <motion.button
                {...press}
                onClick={() => onAccept(bid.id)}
                disabled={busy}
                className="shrink-0 rounded-full bg-teal px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-deep disabled:opacity-50"
              >
                Accept
              </motion.button>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}

function FacilityCard({
  deal,
  now,
  busy,
  onRepay,
  business,
}: {
  deal: Deal;
  now: number;
  busy: boolean;
  onRepay: () => void;
  business?: string;
}) {
  if (deal.status === "agreed") {
    return (
      <motion.div variants={rise} initial="hidden" animate="show" className="rounded-[var(--radius-card)] border border-teal/40 bg-surface p-5">
        <p className="font-medium text-teal-deep">Terms agreed</p>
        <p className="mt-1 text-sm text-ink-3">
          {deal.financierName} is disbursing {aed(deal.terms.amountAed)} to your wallet.
        </p>
        <div className="mt-4 border-t border-line pt-4">
          <TermsSummary terms={deal.terms} />
        </div>
      </motion.div>
    );
  }
  return (
    <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={springPop}>
      <div className="overflow-hidden rounded-[var(--radius-card)] border border-teal/40 bg-surface">
        <div className="bg-teal-tint px-6 py-5">
          <p className="text-xs uppercase tracking-wide text-teal-deep">Live facility</p>
          <p className="font-display tnum mt-1 text-4xl tracking-tight text-teal-deep">{aed(deal.terms.amountAed)}</p>
          <p className="mt-1 text-sm text-ink-3">From {deal.financierName} to {business}</p>
          <ChainBadge className="mt-2" />
        </div>
        <div className="px-6">
          <TermsSummary terms={deal.terms} dueAt={deal.dueAt} now={now} />
        </div>
        <div className="px-6 py-5">
          <div className="mb-3 flex items-center justify-between rounded-[var(--radius-card)] bg-surface-sunk px-4 py-3 text-sm">
            <span className="text-ink-3">Due in</span>
            <span className="tnum font-medium">{deal.dueAt ? Math.max(0, daysUntil(deal.dueAt, now)) : deal.terms.tenorDays} days</span>
          </div>
          <motion.button
            {...press}
            onClick={onRepay}
            disabled={busy}
            className="w-full rounded-full bg-ink py-3 text-sm font-medium text-paper transition-colors hover:bg-ink-2 disabled:opacity-50"
          >
            {busy ? "Repaying…" : `Repay ${aed(totalRepayableAed(deal.terms))}`}
          </motion.button>
          <p className="mt-2 text-center text-xs text-ink-faint">Repays automatically from your next settlement, or clear it now.</p>
        </div>
      </div>
    </motion.div>
  );
}

function SingleNegotiation({
  deal,
  maxAdvanceAed,
  busy,
  run,
  dealAction,
  onAccept,
}: {
  deal: Deal;
  maxAdvanceAed: number;
  busy: boolean;
  run: (fn: () => Promise<void>) => Promise<void>;
  dealAction: ReturnType<typeof useCorridor>["dealAction"];
  onAccept: (dealId: string) => void;
}) {
  const [countering, setCountering] = useState(false);
  const perms = permissions(deal, "borrower");
  return (
    <motion.div variants={rise} initial="hidden" animate="show" className="space-y-4">
      <div className="rounded-[var(--radius-card)] border border-brass/40 bg-surface p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wide text-ink-faint">Offer from {deal.financierName}</p>
          <DealStatusPill deal={deal} viewer="borrower" />
        </div>
        <p className="font-display tnum mt-1 text-4xl tracking-tight text-brass-deep">{aed(deal.terms.amountAed)}</p>
        <p className="mt-1 text-sm text-ink-3">
          {pct(deal.terms.ratePct)} fee · {deal.terms.tenorDays} days · repay {aed(totalRepayableAed(deal.terms))}
        </p>
        {countering ? (
          <div className="mt-4 border-t border-line pt-4">
            <TermsEditor
              initial={deal.terms}
              maxAmountAed={maxAdvanceAed}
              submitLabel="Send counter →"
              busy={busy}
              noteLabel="Add a note (optional)"
              onSubmit={(terms: DealTerms, note) => run(() => dealAction({ action: "counter", dealId: deal.id, terms, note })).then(() => setCountering(false))}
            />
            <button onClick={() => setCountering(false)} className="mt-2 w-full text-center text-sm text-ink-3 hover:text-ink">
              Cancel
            </button>
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
            {perms.canAccept && (
              <motion.button {...press} onClick={() => onAccept(deal.id)} disabled={busy} className="flex-1 rounded-full bg-teal py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-deep disabled:opacity-50">
                Accept {aed(deal.terms.amountAed)}
              </motion.button>
            )}
            {perms.canCounter && (
              <button onClick={() => setCountering(true)} disabled={busy} className="flex-1 rounded-full border border-line py-2.5 text-sm font-medium text-ink transition-colors hover:bg-surface-sunk disabled:opacity-50">
                Counter
              </button>
            )}
            {perms.canWithdraw && (
              <button onClick={() => run(() => dealAction({ action: "withdraw", dealId: deal.id }))} disabled={busy} className="rounded-full px-4 py-2.5 text-sm text-ink-3 transition-colors hover:text-danger disabled:opacity-50">
                Decline
              </button>
            )}
          </div>
        )}
      </div>
      <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
        <p className="mb-4 text-sm font-medium text-ink-2">Negotiation</p>
        <DealThread deal={deal} />
      </div>
    </motion.div>
  );
}

function DealHistory({ deals }: { deals: Deal[] }) {
  return (
    <div>
      <p className="text-sm font-medium text-ink-2">History</p>
      <div className="mt-3 space-y-2">
        {deals
          .slice()
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-line bg-surface px-4 py-3">
              <div className="flex items-center gap-3">
                <Avatar name={d.financierName ?? "Financier"} size={30} />
                <div>
                  <p className="text-sm font-medium">{d.financierName ?? "Working-capital request"}</p>
                  <p className="text-xs text-ink-faint">
                    {aed(d.terms.amountAed)} · {pct(d.terms.ratePct)} · {d.terms.tenorDays}d
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <DealStatusPill deal={d} viewer="borrower" />
                {d.repayExplorerUrl && d.repayTxHash && (
                  <a
                    href={d.repayExplorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="tnum font-mono text-xs text-teal-deep underline decoration-teal/30 underline-offset-2 hover:decoration-teal"
                  >
                    {d.repayTxHash.slice(0, 6)}…{d.repayTxHash.slice(-4)} ↗
                  </a>
                )}
              </div>
            </div>
          ))}
      </div>
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
