"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useFinancier } from "@/components/FinancierProvider";
import { ScoreCard } from "@/components/score-viz";
import { aed, usdcLabel } from "@/lib/corridor";

export default function DealPage() {
  const params = useParams<{ business: string }>();
  const router = useRouter();
  const { borrowers, facilities, fund } = useFinancier();
  const [funding, setFunding] = useState(false);

  const borrower = borrowers.find((b) => b.id === params.business);
  const facility = facilities.find((f) => f.borrowerId === params.business);

  if (!borrower) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <p className="font-medium">Borrower not found</p>
        <p className="mt-1 text-sm text-ink-3">It may not have settled a corridor in this session yet.</p>
        <Link href="/opportunities" className="mt-5 inline-block text-sm text-brass-deep underline underline-offset-2">
          Back to opportunities
        </Link>
      </div>
    );
  }

  const settled = borrower.corridors.filter((c) => c.status === "settled");

  async function onFund() {
    if (!borrower) return;
    setFunding(true);
    await fund(borrower);
    setFunding(false);
    router.push("/portfolio");
  }

  return (
    <div>
      <Link href="/opportunities" className="text-sm text-ink-3 hover:text-ink">
        ← Opportunities
      </Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-tight">{borrower.name}</h1>
          <p className="mt-1 text-ink-3">
            {borrower.city}, {borrower.country}
            {borrower.wallet ? ` · ${borrower.wallet.slice(0, 6)}…${borrower.wallet.slice(-4)}` : ""}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_1.1fr]">
        <section>
          <h2 className="mb-3 text-sm font-medium text-ink-2">Corridor Score</h2>
          <ScoreCard score={borrower.score} verifiedOnChain={borrower.onchainScore !== null} />

          <div className="mt-4 rounded-[var(--radius-card)] border border-line bg-surface p-5">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-ink-faint">Advance offer</p>
                <p className="font-display tnum mt-1 text-3xl text-brass-deep">{aed(borrower.offerAed)}</p>
                <p className="mt-1 text-sm text-ink-3">
                  Against {aed(borrower.score.avgCorridorAed)} avg corridor · {borrower.score.tier}
                </p>
              </div>
              {facility ? (
                <span className="rounded-full bg-brass-tint px-4 py-2 text-sm font-medium text-brass-deep">
                  {facility.repaid ? "Repaid" : "Funded"}
                </span>
              ) : (
                <button
                  onClick={onFund}
                  disabled={funding || borrower.offerAed === 0}
                  className="rounded-full bg-brass px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brass-deep disabled:opacity-50"
                >
                  {funding ? "Funding…" : `Fund ${aed(borrower.offerAed)} →`}
                </button>
              )}
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-medium text-ink-2">Verified corridors</h2>
          <div className="space-y-3">
            {settled.map((c) => (
              <div key={c.id} className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="tnum font-mono text-xs text-ink-faint">{c.ref}</span>
                    <p className="mt-1 font-medium">{c.supplier.name}</p>
                    <p className="text-sm text-ink-3">{c.goods}</p>
                  </div>
                  <div className="text-right">
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
                    {c.explorerUrl && (
                      <a
                        href={c.explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="tnum font-mono text-teal-deep underline decoration-teal/30 underline-offset-2 hover:decoration-teal"
                      >
                        receipt ↗
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-ink-3">
            Every figure is a payment Dhow settled and verified on-chain. {borrower.name} was a borrower
            banks reject, made legible.
          </p>
        </section>
      </div>
    </div>
  );
}
