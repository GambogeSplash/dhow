import Link from "next/link";

/*
 * Entry points into the real product. Both sides of the marketplace get a door:
 * an importer starts free (Privy onboarding creates a wallet, then the app), a
 * financier opens the console (connect a wallet to fund). The landing is public
 * and provider-free, so these are plain links into the authenticated flows.
 */
export function LandingCta() {
  return (
    <div className="mt-8 flex flex-wrap items-center gap-3">
      <Link
        href="/onboarding"
        className="rounded-full bg-teal px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-teal-deep"
      >
        Start free →
      </Link>
      <Link
        href="/desk"
        className="rounded-full border border-line bg-surface px-6 py-3 text-sm font-medium text-ink transition-colors hover:border-line-strong"
      >
        Fund trade →
      </Link>
    </div>
  );
}

export function LandingHeaderCta() {
  return (
    <div className="flex items-center gap-4">
      <Link href="/desk" className="text-sm text-ink-2 transition-colors hover:text-ink">
        Financiers
      </Link>
      <Link
        href="/onboarding"
        className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-ink-2"
      >
        Start free
      </Link>
    </div>
  );
}
