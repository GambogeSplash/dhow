"use client";

import Link from "next/link";
import { useFinancier } from "@/components/FinancierProvider";
import { Avatar } from "@/components/Avatar";
import { aed } from "@/lib/corridor";

function shortHash(h: string): string {
  if (h.includes("…")) return h;
  return h.length > 14 ? `${h.slice(0, 6)}…${h.slice(-4)}` : h;
}

export default function PortfolioPage() {
  const { facilities, deployedAed, availableAed, markRepaid } = useFinancier();
  // Active facilities first, then repaid; within each, most recent first.
  const rows = [...facilities].sort(
    (a, b) => Number(a.repaid) - Number(b.repaid) || b.fundedAt - a.fundedAt,
  );
  const activeCount = facilities.filter((f) => !f.repaid).length;
  const repaidCount = facilities.filter((f) => f.repaid).length;

  return (
    <div>
      <p className="text-sm text-ink-3">Portfolio</p>
      <h1 className="font-display mt-1 text-3xl tracking-tight">Facilities</h1>
      <p className="mt-2 max-w-xl text-ink-2">
        Capital deployed against verified settlements. The facility stays safe while the borrower keeps
        settling on Dhow: the loan is repaid out of the next settlement.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Metric label="Deployed" value={aed(deployedAed)} sub={`${activeCount} active`} tone="brass" />
        <Metric label="Available" value={aed(availableAed)} tone="ink" />
        <Metric
          label="Repaid"
          value={`${repaidCount}`}
          sub={repaidCount === 1 ? "facility" : "facilities"}
          tone="ink"
        />
      </div>

      {facilities.length === 0 ? (
        <div className="mt-6 rounded-[var(--radius-card)] border border-dashed border-line-strong bg-surface p-8 text-center">
          <p className="font-medium">No facilities yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-ink-3">
            Fund an eligible borrower from the deal view and it appears here.
          </p>
          <Link href="/opportunities" className="mt-5 inline-block text-sm text-brass-deep underline underline-offset-2">
            View opportunities →
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {rows.map((f) => (
            <div
              key={f.borrowerId}
              className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5"
            >
              <div className="flex min-w-48 items-center gap-3">
                <Avatar name={f.borrowerName} size={40} />
                <div>
                  <p className="font-medium">{f.borrowerName}</p>
                  <p className="text-sm text-ink-3">
                    Funded {new Date(f.fundedAt).toLocaleDateString()}
                    {f.explorerUrl && f.txHash && (
                      <>
                        {" · "}
                        <a
                          href={f.explorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="tnum font-mono text-teal-deep underline decoration-teal/30 underline-offset-2 hover:decoration-teal"
                        >
                          {shortHash(f.txHash)} ↗
                        </a>
                      </>
                    )}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-display tnum text-xl text-brass-deep">{aed(f.amountAed)}</p>
                <p className="text-xs text-ink-faint">{f.repaid ? "repaid" : "deployed"}</p>
              </div>
              {f.repaid ? (
                <span className="rounded-full bg-teal-tint px-4 py-2 text-sm font-medium text-teal-deep">
                  Repaid
                </span>
              ) : (
                <button
                  onClick={() => markRepaid(f.borrowerId)}
                  className="rounded-full border border-line px-4 py-2 text-sm font-medium text-ink-3 transition-colors hover:border-line-strong hover:text-ink"
                >
                  Mark repaid
                </button>
              )}
            </div>
          ))}
        </div>
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
