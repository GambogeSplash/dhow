"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider, createConfig } from "@privy-io/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http } from "viem";
import { CorridorProvider } from "./CorridorProvider";
import { dhowChain } from "@/lib/chain-client";

/*
 * The authenticated stack: Privy (identity + embedded wallet) → Wagmi (chain
 * connection) → React Query → the Dhow workspace. Wraps only the onboarding and
 * app segments; the public landing renders without it. When Privy isn't
 * configured we render a clear setup notice instead of crashing.
 */

const queryClient = new QueryClient();

const wagmiConfig = createConfig({
  chains: [dhowChain],
  transports: { [dhowChain.id]: http() },
});

/** Privy + Wagmi + React Query shell, shared by the importer and financier
 *  surfaces. Renders a setup notice instead of crashing when Privy is unset. */
export function PrivyStack({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  if (!appId) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-20">
        <div className="max-w-md rounded-[var(--radius-card)] border border-line bg-surface p-6 text-center">
          <p className="font-display text-lg text-ink">Almost there</p>
          <p className="mt-2 text-sm text-ink-3">
            Dhow needs a Privy app and a database to run. Add{" "}
            <code className="font-mono text-xs">NEXT_PUBLIC_PRIVY_APP_ID</code>,{" "}
            <code className="font-mono text-xs">PRIVY_APP_SECRET</code> and{" "}
            <code className="font-mono text-xs">DATABASE_URL</code>, then restart.
          </p>
          <p className="mt-3 text-xs text-ink-faint">See docs/SETUP.md.</p>
        </div>
      </main>
    );
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["email", "wallet"],
        embeddedWallets: { ethereum: { createOnLogin: "users-without-wallets" } },
        defaultChain: dhowChain,
        supportedChains: [dhowChain],
        appearance: { theme: "light", accentColor: "#0c7c66" },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}

/** The importer workspace stack. */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyStack>
      <CorridorProvider>{children}</CorridorProvider>
    </PrivyStack>
  );
}
