"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePrivy, useWallets, getAccessToken } from "@privy-io/react-auth";
import type { EIP1193Provider, Hex } from "viem";
import {
  advanceOffer,
  AED_PER_USD,
  Corridor,
  CorridorScore,
  scoreCorridors,
} from "@/lib/corridor";
import type { Business } from "@/lib/account";
import { apiListFacilities, apiCreateFacility, apiMarkRepaid } from "@/lib/account";
import { FINANCIER } from "@/lib/financier";
import { CHAIN_ID, payOpen } from "@/lib/chain-client";
import { PREVIEW_MODE } from "@/lib/preview";

/*
 * The financier (Creek Capital) side. Borrowers come from the shared database
 * via /api/borrowers (real, cross-machine), with the on-chain verified Credit
 * Score overlaid from the registry. Funding is a REAL on-chain USDC transfer
 * the financier signs from their own Privy wallet to the borrower's wallet; the
 * facility (with its settlement tx) persists in the database.
 */

export interface Borrower {
  id: string;
  name: string;
  city: string;
  country: string;
  wallet?: string;
  corridors: Corridor[];
  score: CorridorScore;
  offerAed: number;
  onchainScore: number | null;
}

export interface Facility {
  borrowerId: string;
  borrowerName: string;
  amountAed: number;
  fundedAt: number;
  txHash?: string;
  explorerUrl?: string;
  repaid: boolean;
}

interface FinancierState {
  financier: typeof FINANCIER;
  borrowers: Borrower[];
  facilities: Facility[];
  deployedAed: number;
  availableAed: number;
  isAuthenticated: boolean;
  walletAddress?: string;
  login: () => void;
  fund: (borrower: Borrower) => Promise<{ ok: boolean; error?: string }>;
  markRepaid: (borrowerId: string) => void;
  refresh: () => void;
}

function isFullAddress(a?: string): boolean {
  return !!a && /^0x[0-9a-fA-F]{40}$/.test(a);
}

function toBorrower(
  business: Business,
  corridors: Corridor[],
  now: number,
  onchainScore: number | null,
): Borrower {
  const score = scoreCorridors(corridors, now);
  return {
    id: business.id,
    name: business.name,
    city: business.city,
    country: business.country,
    wallet: business.walletAddress,
    corridors,
    score,
    offerAed: advanceOffer(score),
    onchainScore,
  };
}

function newFacilityId(): string {
  try {
    return `fac_${crypto.randomUUID().slice(0, 8)}`;
  } catch {
    return `fac_${Math.random().toString(36).slice(2, 10)}`;
  }
}

const Ctx = createContext<FinancierState | null>(null);

export function FinancierProvider({ children }: { children: React.ReactNode }) {
  return PREVIEW_MODE ? (
    <FinancierPreview>{children}</FinancierPreview>
  ) : (
    <FinancierLive>{children}</FinancierLive>
  );
}

/** Empty, unauthenticated state for local preview (no Privy, no database). */
function FinancierPreview({ children }: { children: React.ReactNode }) {
  return (
    <Ctx.Provider
      value={{
        financier: FINANCIER,
        borrowers: [],
        facilities: [],
        deployedAed: 0,
        availableAed: FINANCIER.appetiteAed,
        isAuthenticated: false,
        walletAddress: undefined,
        login: () => {},
        fund: async () => ({ ok: false, error: "Preview mode: funding is disabled." }),
        markRepaid: () => {},
        refresh: () => {},
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

function FinancierLive({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);

  const walletsRef = useRef(wallets);
  walletsRef.current = wallets;
  const embedded = wallets.find((w) => w.walletClientType === "privy") ?? wallets[0];
  const isAuthenticated = ready && authenticated;

  const token = useCallback(async () => (await getAccessToken()) ?? "", []);

  const signer = useCallback(async (): Promise<{ provider: EIP1193Provider; from: Hex }> => {
    const w = walletsRef.current.find((x) => x.walletClientType === "privy") ?? walletsRef.current[0];
    if (!w) throw new Error("Connect a wallet to fund.");
    try {
      await w.switchChain(CHAIN_ID);
    } catch {
      /* already on chain */
    }
    return { provider: (await w.getEthereumProvider()) as EIP1193Provider, from: w.address as Hex };
  }, []);

  const loadFacilities = useCallback(async () => {
    if (!authenticated) return setFacilities([]);
    try {
      const t = await token();
      if (!t) return;
      const rows = await apiListFacilities(t);
      setFacilities(
        rows.map((f) => ({
          borrowerId: f.borrowerId,
          borrowerName: f.borrowerName,
          amountAed: f.amountAed,
          fundedAt: f.fundedAt,
          txHash: f.txHash,
          explorerUrl: f.explorerUrl,
          repaid: f.repaid,
        })),
      );
    } catch {
      /* not configured / unauthenticated */
    }
  }, [authenticated, token]);

  const refresh = useCallback(() => {
    void (async () => {
      const now = Date.now();
      let records: Array<{ business: Business; corridors: Corridor[] }> = [];
      try {
        const res = await fetch("/api/borrowers");
        const data = await res.json();
        records = Array.isArray(data.borrowers) ? data.borrowers : [];
      } catch {
        return;
      }
      const base = records.map((r) => toBorrower(r.business, r.corridors, now, null));
      setBorrowers(base);

      base.forEach(async (b, i) => {
        if (!isFullAddress(b.wallet)) return;
        try {
          const res = await fetch(`/api/score?business=${b.wallet}`);
          const data = await res.json();
          if (typeof data?.score === "number") {
            setBorrowers((prev) => {
              const next = [...prev];
              if (next[i]) next[i] = { ...next[i], onchainScore: data.score };
              return next;
            });
          }
        } catch {
          /* registry not wired */
        }
      });
    })();
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 4000);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    void loadFacilities();
  }, [loadFacilities]);

  const fund = useCallback(
    async (borrower: Borrower): Promise<{ ok: boolean; error?: string }> => {
      if (!authenticated) {
        login();
        return { ok: false, error: "Connect your financier wallet to fund." };
      }
      if (!isFullAddress(borrower.wallet)) {
        return { ok: false, error: "Borrower has no settlement wallet address yet." };
      }
      if (borrower.offerAed <= 0) return { ok: false, error: "No eligible offer." };

      const amountUsdc = Math.round((borrower.offerAed / AED_PER_USD) * 100) / 100;
      try {
        const { provider, from } = await signer();
        const res = await payOpen(provider, from, borrower.wallet as Hex, amountUsdc);
        const facility: Facility = {
          borrowerId: borrower.id,
          borrowerName: borrower.name,
          amountAed: borrower.offerAed,
          fundedAt: Date.now(),
          txHash: res.txHash,
          explorerUrl: res.explorerUrl,
          repaid: false,
        };
        setFacilities((prev) => [...prev.filter((f) => f.borrowerId !== borrower.id), facility]);
        const t = await token();
        if (t)
          await apiCreateFacility(t, {
            id: newFacilityId(),
            borrowerId: borrower.id,
            borrowerName: borrower.name,
            amountAed: borrower.offerAed,
            amountUsdc,
            txHash: res.txHash,
            explorerUrl: res.explorerUrl,
            fundedAt: facility.fundedAt,
          }).catch(() => {});
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "funding failed" };
      }
    },
    [authenticated, login, signer, token],
  );

  const markRepaid = useCallback(
    (borrowerId: string) => {
      setFacilities((prev) =>
        prev.map((f) => (f.borrowerId === borrowerId ? { ...f, repaid: true } : f)),
      );
      void (async () => {
        const t = await token();
        if (t) await apiMarkRepaid(t, borrowerId).catch(() => {});
      })();
    },
    [token],
  );

  const deployedAed = facilities.filter((f) => !f.repaid).reduce((s, f) => s + f.amountAed, 0);
  const availableAed = Math.max(0, FINANCIER.appetiteAed - deployedAed);

  return (
    <Ctx.Provider
      value={{
        financier: FINANCIER,
        borrowers,
        facilities,
        deployedAed,
        availableAed,
        isAuthenticated,
        walletAddress: embedded?.address,
        login,
        fund,
        markRepaid,
        refresh,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useFinancier(): FinancierState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useFinancier must be used within FinancierProvider");
  return ctx;
}
