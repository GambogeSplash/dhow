"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "@/components/CorridorProvider";
import { Sidebar, MobileBar } from "@/components/Sidebar";

/** Gates the product behind a real, onboarded account and frames it with nav. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { hydrated, isAuthenticated, isOnboarded } = useAccount();

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
        <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8 md:px-10 md:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
