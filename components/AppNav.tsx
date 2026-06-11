"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCorridor } from "./CorridorProvider";
import { DhowMark } from "./DhowMark";

const TABS = [
  { href: "/send", label: "Send" },
  { href: "/corridor", label: "Corridor Record" },
  { href: "/capital", label: "Capital" },
];

export function AppNav() {
  const pathname = usePathname();
  const { importer, score, reset } = useCorridor();

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <DhowMark className="h-6 w-6 text-teal" />
          <span className="font-display text-lg font-medium tracking-tight">
            Dhow
          </span>
        </Link>

        <nav className="ml-4 flex items-center gap-1">
          {TABS.map((t) => {
            const active = pathname === t.href;
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
                  active
                    ? "bg-ink text-paper"
                    : "text-ink-2 hover:bg-surface-sunk"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={reset}
            className="text-xs text-ink-faint hover:text-ink-3"
            title="Reset the demo to its starting state"
          >
            Reset
          </button>
          <div className="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5">
            <span className="tnum font-mono text-xs text-ink-3">
              Score {score.score}
            </span>
            <span className="h-3 w-px bg-line" />
            <span className="text-sm text-ink">{importer.name}</span>
            <span className="tnum font-mono text-xs text-ink-faint">
              {importer.walletPreview}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
