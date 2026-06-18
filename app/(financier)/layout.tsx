"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DhowMark } from "@/components/DhowMark";
import { FinancierProvider } from "@/components/FinancierProvider";

/*
 * Financier workspace chrome. Same maritime/ledger language as the importer
 * app, leaning on brass (the capital persona) rather than teal. The financier
 * is the demand side of the marketplace: it sees scored, de-risked borrowers
 * and funds them.
 */

const NAV = [
  { href: "/desk", label: "Desk" },
  { href: "/opportunities", label: "Opportunities" },
  { href: "/portfolio", label: "Portfolio" },
];

export default function FinancierLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <FinancierProvider>
      <div className="paper-grain flex min-h-screen flex-col">
        <header className="border-b border-line bg-surface/70 backdrop-blur">
          <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
            <div className="flex items-center gap-6">
              <Link href="/desk" className="flex items-center gap-2.5">
                <DhowMark className="h-6 w-6 text-brass" />
                <span className="font-display text-lg font-medium tracking-tight">Dhow</span>
                <span className="rounded-full bg-brass-tint px-2 py-0.5 text-[11px] font-medium text-brass-deep">
                  Financier
                </span>
              </Link>
              <nav className="hidden items-center gap-1 md:flex">
                {NAV.map((n) => {
                  const active = pathname === n.href || pathname.startsWith(n.href + "/");
                  return (
                    <Link
                      key={n.href}
                      href={n.href}
                      className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
                        active ? "bg-brass-tint text-brass-deep" : "text-ink-3 hover:text-ink"
                      }`}
                    >
                      {n.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium">Creek Capital</p>
              <p className="text-xs text-ink-faint">DIFC working-capital provider</p>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">{children}</main>
      </div>
    </FinancierProvider>
  );
}
