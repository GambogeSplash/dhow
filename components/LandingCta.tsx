"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAccount } from "./CorridorProvider";

/** Hero call-to-action: real sign-up vs one-click sample exploration. */
export function LandingCta() {
  const router = useRouter();
  const { enterSample } = useAccount();

  function explore() {
    enterSample();
    router.push("/overview");
  }

  return (
    <div className="mt-8 flex flex-wrap items-center gap-3">
      <Link
        href="/onboarding"
        className="rounded-full bg-teal px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-teal-deep"
      >
        Start free →
      </Link>
      <button
        onClick={explore}
        className="rounded-full border border-line bg-surface px-6 py-3 text-sm font-medium text-ink transition-colors hover:border-line-strong"
      >
        Explore with sample data
      </button>
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
