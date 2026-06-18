"use client";

import Link from "next/link";
import { useFinancier } from "@/components/FinancierProvider";
import { aed } from "@/lib/corridor";

export default function PortfolioPage() {
  const { facilities, markRepaid } = useFinancier();

  return (
    <div>
      <p className="text-sm text-ink-3">Portfolio</p>
      <h1 className="font-display mt-1 text-3xl tracking-tight">Facilities</h1>
      <p className="mt-2 max-w-xl text-ink-2">
        Capital deployed against verified corridors. The facility stays safe while the borrower keeps
        settling on Dhow: the loan is repaid out of the next settled corridor.
      </p>

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
          {facilities.map((f) => (
            <div
              key={f.borrowerId}
              className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5"
            >
              <div>
                <p className="font-medium">{f.borrowerName}</p>
                <p className="text-sm text-ink-3">
                  Funded {new Date(f.fundedAt).toLocaleDateString()}
                  {f.explorerUrl && (
                    <>
                      {" · "}
                      <a
                        href={f.explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="tnum font-mono text-teal-deep underline decoration-teal/30 underline-offset-2 hover:decoration-teal"
                      >
                        receipt ↗
                      </a>
                    </>
                  )}
                </p>
              </div>
              <div className="text-right">
                <p className="font-display tnum text-xl text-brass-deep">{aed(f.amountAed)}</p>
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
