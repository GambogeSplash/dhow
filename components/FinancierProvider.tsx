"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  advanceOffer,
  Corridor,
  CorridorScore,
  scoreCorridors,
} from "@/lib/corridor";
import type { Business } from "@/lib/account";
import { FINANCIER } from "@/lib/financier";

/*
 * The financier (Creek Capital) side. Read-mostly: borrowers come from the
 * shared database via /api/borrowers (cross-machine, real), and the on-chain
 * verified Credit Score is overlaid from the registry via /api/score. Funding
 * is recorded as a local commitment ledger for now; financier-wallet-signed
 * on-chain disbursement is the next layer.
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
  onchainScore: number | null; // verified score from the registry, when available
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
  fund: (borrower: Borrower) => Promise<void>;
  markRepaid: (borrowerId: string) => void;
  refresh: () => void;
}

const FACILITIES_KEY = "dhow.financier.facilities.v1";

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

function loadFacilities(): Facility[] {
  try {
    const raw = localStorage.getItem(FACILITIES_KEY);
    return raw ? (JSON.parse(raw) as Facility[]) : [];
  } catch {
    return [];
  }
}

function saveFacilities(f: Facility[]) {
  try {
    localStorage.setItem(FACILITIES_KEY, JSON.stringify(f));
  } catch {
    /* storage blocked; facilities live in memory for this tab */
  }
}

const Ctx = createContext<FinancierState | null>(null);

export function FinancierProvider({ children }: { children: React.ReactNode }) {
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);

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

      // Overlay the on-chain verified score where a real wallet + registry exist.
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
          /* registry not wired; the derived score stands */
        }
      });
    })();
  }, []);

  useEffect(() => {
    setFacilities(loadFacilities());
    refresh();
    const id = setInterval(refresh, 4000);
    const onStorage = () => refresh();
    window.addEventListener("storage", onStorage);
    return () => {
      clearInterval(id);
      window.removeEventListener("storage", onStorage);
    };
  }, [refresh]);

  const fund = useCallback(async (borrower: Borrower) => {
    // Records the financier's commitment. Real financier-wallet-signed USDC
    // disbursement to the borrower is the next layer.
    const facility: Facility = {
      borrowerId: borrower.id,
      borrowerName: borrower.name,
      amountAed: borrower.offerAed,
      fundedAt: Date.now(),
      repaid: false,
    };
    setFacilities((prev) => {
      const next = [...prev.filter((f) => f.borrowerId !== borrower.id), facility];
      saveFacilities(next);
      return next;
    });
  }, []);

  const markRepaid = useCallback((borrowerId: string) => {
    setFacilities((prev) => {
      const next = prev.map((f) => (f.borrowerId === borrowerId ? { ...f, repaid: true } : f));
      saveFacilities(next);
      return next;
    });
  }, []);

  const deployedAed = facilities.filter((f) => !f.repaid).reduce((s, f) => s + f.amountAed, 0);
  const availableAed = Math.max(0, FINANCIER.appetiteAed - deployedAed);

  return (
    <Ctx.Provider
      value={{ financier: FINANCIER, borrowers, facilities, deployedAed, availableAed, fund, markRepaid, refresh }}
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
