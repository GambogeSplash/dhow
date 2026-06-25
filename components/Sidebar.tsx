"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useWorkspace } from "./CorridorProvider";
import { useOverlays } from "./overlays";
import { DhowMark } from "./DhowMark";

type NavItem = {
  href?: string;
  action?: "send";
  label: string;
  icon: (p: { className?: string }) => React.ReactElement;
};

// "Send payment" is a task, not a destination, so it opens the composer modal
// rather than navigating. Everything else is a place you go and dwell.
const NAV: NavItem[] = [
  { href: "/overview", label: "Overview", icon: GridIcon },
  { action: "send", label: "Send payment", icon: SendIcon },
  { href: "/corridor", label: "Cashflow Record", icon: LedgerIcon },
  { href: "/capital", label: "Capital", icon: CoinIcon },
  { href: "/suppliers", label: "Suppliers", icon: UsersIcon },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { business, score, walletAddress, signOut } = useWorkspace();
  const { openSend } = useOverlays();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const initials = (business?.name ?? "?")
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-paper/60 md:flex">
      <div className="flex h-16 items-center px-5">
        <Link href="/overview" className="flex items-center gap-2.5">
          <DhowMark className="h-6 w-6 text-teal" />
          <span className="font-display text-lg font-medium tracking-tight">Dhow</span>
        </Link>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-2">
        {NAV.map((item) => {
          const active = !!item.href && pathname === item.href;
          const Icon = item.icon;
          const cls = `flex w-full items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2 text-sm transition-colors ${
            active ? "bg-surface font-medium text-ink shadow-sm" : "text-ink-2 hover:bg-surface-sunk"
          }`;
          const inner = (
            <>
              <Icon className={`h-4 w-4 ${active ? "text-teal" : "text-ink-faint"}`} />
              {item.label}
            </>
          );
          return item.action === "send" ? (
            <button key="send" onClick={() => openSend()} className={cls}>
              {inner}
            </button>
          ) : (
            <Link key={item.href} href={item.href!} className={cls}>
              {inner}
            </Link>
          );
        })}
      </nav>

      {/* score chip */}
      <div className="px-3 pb-2">
        <Link
          href="/corridor"
          className="flex items-center justify-between rounded-[var(--radius-sm)] border border-line bg-surface px-3 py-2.5 transition-colors hover:border-line-strong"
        >
          <span className="text-xs text-ink-3">Credit Score</span>
          <span className="tnum font-display text-lg leading-none text-ink">
            {score.score}
            <span className="text-xs text-ink-faint">/100</span>
          </span>
        </Link>
      </div>

      {/* account */}
      <div className="relative border-t border-line p-3" ref={menuRef}>
        {menuOpen && (
          <div className="absolute bottom-16 left-3 right-3 overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-lg">
            <MenuItem
              onClick={() => {
                signOut();
                router.push("/");
              }}
            >
              Sign out
            </MenuItem>
          </div>
        )}
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-2 py-2 text-left transition-colors hover:bg-surface-sunk"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-tint text-xs font-semibold text-teal-deep">
            {initials}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-ink">
              {business?.name}
            </span>
            <span className="block truncate text-xs text-ink-faint">
              {walletAddress ?? business?.email}
            </span>
          </span>
          <Chevron />
        </button>
      </div>
    </aside>
  );
}

/** Compact top bar for narrow screens (the sidebar is hidden below md). */
export function MobileBar() {
  const pathname = usePathname();
  const { business } = useWorkspace();
  const { openSend } = useOverlays();
  const initials = (business?.name ?? "?")
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur-md md:hidden">
      <div className="flex h-14 items-center gap-3 px-4">
        <Link href="/overview" className="flex items-center gap-2">
          <DhowMark className="h-5 w-5 text-teal" />
          <span className="font-display font-medium">Dhow</span>
        </Link>
        <span className="ml-auto flex h-7 w-7 items-center justify-center rounded-full bg-teal-tint text-[11px] font-semibold text-teal-deep">
          {initials}
        </span>
      </div>
      <nav className="flex gap-1 overflow-x-auto border-t border-line px-3 py-2">
        {NAV.map((item) => {
          const active = !!item.href && pathname === item.href;
          const cls = `shrink-0 rounded-full px-3 py-1.5 text-sm transition-colors ${
            active ? "bg-ink text-paper" : "text-ink-2 hover:bg-surface-sunk"
          }`;
          return item.action === "send" ? (
            <button key="send" onClick={() => openSend()} className={cls}>
              {item.label}
            </button>
          ) : (
            <Link key={item.href} href={item.href!} className={cls}>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

function MenuItem({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="block w-full px-4 py-2.5 text-left text-sm text-ink-2 transition-colors hover:bg-surface-sunk"
    >
      {children}
    </button>
  );
}

function Chevron() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-ink-faint" fill="none">
      <path d="m8 9 4-4 4 4M8 15l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type IconProps = { className?: string };
function GridIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
function SendIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <path d="M5 12h13m0 0-5-5m5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function LedgerIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <rect x="5" y="3" width="14" height="18" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 8h6M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function CoinIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 8v8M9.5 10a2.5 2 0 0 1 5 0c0 1.5-5 .5-5 2.5a2.5 2 0 0 0 5 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
function UsersIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0M16 5.5a3 3 0 0 1 0 5.8M21 20a5 5 0 0 0-3.5-4.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
