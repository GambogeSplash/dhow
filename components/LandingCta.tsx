import Link from "next/link";

/** Hero call-to-action. The landing is public and provider-free, so these are
 *  plain links into the onboarding flow. */
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
        href="/onboarding"
        className="rounded-full border border-line bg-surface px-6 py-3 text-sm font-medium text-ink transition-colors hover:border-line-strong"
      >
        Sign in
      </Link>
    </div>
  );
}

export function LandingHeaderCta() {
  return (
    <Link
      href="/onboarding"
      className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-ink-2"
    >
      Start free
    </Link>
  );
}
