"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "@/components/CorridorProvider";
import { Sidebar, MobileBar } from "@/components/Sidebar";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { hydrated, isAuthenticated, isOnboarded, isSample, signOut } = useAccount();

  // Gate the product behind a real account. Sample mode counts as onboarded.
  useEffect(() => {
    if (hydrated && (!isAuthenticated || !isOnboarded)) {
      router.replace("/onboarding");
    }
  }, [hydrated, isAuthenticated, isOnboarded, router]);

  if (!hydrated || !isAuthenticated || !isOnboarded) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-10">
        <p className="text-sm text-ink-faint">Loading your workspace…</p>
      </main>
    );
  }

  return (
    <div className="flex flex-1">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileBar />
        {isSample && (
          <div className="border-b border-brass/30 bg-brass-tint/60">
            <div className="flex items-center justify-between gap-3 px-6 py-2 text-sm md:px-10">
              <span className="text-brass-deep">
                You&apos;re exploring sample data as Al Noor Trading.
              </span>
              <button
                onClick={() => {
                  signOut();
                  router.push("/onboarding");
                }}
                className="shrink-0 font-medium text-brass-deep underline underline-offset-2"
              >
                Set up your business →
              </button>
            </div>
          </div>
        )}
        <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8 md:px-10 md:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
