"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DhowMark } from "@/components/DhowMark";
import { PrivyStack } from "@/components/Providers";
import { FinancierProvider, useFinancier } from "@/components/FinancierProvider";
import { FinancierOverlayProvider } from "@/components/financier-overlays";

/*
 * Financier workspace chrome. Same maritime/ledger language as the importer
 * app, leaning on brass (the capital persona). The financier is the demand side
 * of the marketplace: it sees scored, de-risked borrowers and funds them with a
 * real on-chain USDC transfer signed by its own wallet.
 */

const NAV = [
  { href: "/desk", label: "Desk" },
  { href: "/opportunities", label: "Opportunities" },
  { href: "/requests", label: "Requests" },
  { href: "/portfolio", label: "Portfolio" },
];

function FinancierNav() {
  const pathname = usePathname();
  const { requests } = useFinancier();
  return (
    <nav className="hidden items-center gap-1 md:flex">
      {NAV.map((n) => {
        const active = pathname === n.href || pathname.startsWith(n.href + "/");
        const badge = n.href === "/requests" ? requests.length : 0;
        return (
          <Link
            key={n.href}
            href={n.href}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm transition-colors ${
              active ? "bg-brass-tint text-brass-deep" : "text-ink-3 hover:text-ink"
            }`}
          >
            {n.label}
            {badge > 0 && (
              <span className="tnum rounded-full bg-brass px-1.5 py-0.5 text-[10px] font-medium leading-none text-white">
                {badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function AuthChip() {
  const { isAuthenticated, walletAddress, login } = useFinancier();
  if (isAuthenticated && walletAddress) {
    return (
      <div className="text-right">
        <p className="text-sm font-medium">Creek Capital</p>
        <p className="tnum font-mono text-xs text-ink-faint">
          {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}
        </p>
      </div>
    );
  }
  return (
    <button
      onClick={() => login()}
      className="rounded-full bg-brass px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brass-deep"
    >
      Connect to fund
    </button>
  );
}

export default function FinancierLayout({ children }: { children: React.ReactNode }) {
  return (
    <PrivyStack>
      <FinancierProvider>
        <FinancierOverlayProvider>
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
                  <FinancierNav />
                </div>
                <AuthChip />
              </div>
            </header>
            <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">{children}</main>
          </div>
        </FinancierOverlayProvider>
      </FinancierProvider>
    </PrivyStack>
  );
}
