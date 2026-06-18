"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  advanceOffer,
  Corridor,
  CorridorScore,
  scoreCorridors,
} from "@/lib/corridor";
import {
  AccountRecord,
  loadAccount,
  loadSampleAccount,
  SAMPLE_ACCOUNT_ID,
  loadSession,
} from "@/lib/account";
import { FINANCIER } from "@/lib/seed";

/*
 * The financier (Creek Capital) side. Read-mostly: it derives borrowers from
 * the importer's persisted workspace (same-origin localStorage, so a two-window
 * demo shows live updates) and overlays the on-chain Credit Score from the
 * registry via /api/score when the chain is wired. The only write is funding,
 * which is a real USDC transfer when the chain is configured.
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

const FACILITIES_KEY = "dhow.financier.v1";

function isFullAddress(a?: string): boolean {
  return !!a && /^0x[0-9a-fA-F]{40}$/.test(a);
}

function toBorrower(rec: AccountRecord, now: number, onchainScore: number | null): Borrower {
  const score = scoreCorridors(rec.corridors, now);
  return {
    id: rec.business.id,
    name: rec.business.name,
    city: rec.business.city,
    country: rec.business.country,
    wallet: rec.business.walletAddress,
    corridors: rec.corridors,
    score,
    offerAed: advanceOffer(score),
    onchainScore,
  };
}

/** Gather the SME accounts visible in this browser: the sample plus any signed-in account. */
function loadBorrowerRecords(now: number): AccountRecord[] {
  const records: AccountRecord[] = [];
  const seen = new Set<string>();

  const sample = loadAccount(SAMPLE_ACCOUNT_ID) ?? loadSampleAccount(now);
  records.push(sample);
  seen.add(sample.business.id);

  const sessionId = loadSession();
  if (sessionId && sessionId !== SAMPLE_ACCOUNT_ID) {
    const active = loadAccount(sessionId);
    if (active && !seen.has(active.business.id)) records.push(active);
  }
  return records;
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
    const now = Date.now();
    const records = loadBorrowerRecords(now);
    const base = records.map((r) => toBorrower(r, now, null));
    setBorrowers(base);

    // Overlay the on-chain verified score where a real wallet + chain exist.
    base.forEach(async (b, i) => {
      if (!isFullAddress(b.wallet)) return;
      try {
        const res = await fetch(`/api/score?business=${b.wallet}`);
        const data = await res.json();
        if (data?.mode === "chain" && typeof data.score === "number") {
          setBorrowers((prev) => {
            const next = [...prev];
            if (next[i]) next[i] = { ...next[i], onchainScore: data.score };
            return next;
          });
        }
      } catch {
        /* chain not wired; the derived score stands */
      }
    });
  }, []);

  useEffect(() => {
    setFacilities(loadFacilities());
    refresh();
    // Poll localStorage so the financier sees the importer's live moves (other tab).
    // Tighter in demo mode so the opportunity surfaces almost immediately on stage.
    const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "1";
    const id = setInterval(refresh, demoMode ? 1000 : 2500);
    const onStorage = () => refresh();
    window.addEventListener("storage", onStorage);
    return () => {
      clearInterval(id);
      window.removeEventListener("storage", onStorage);
    };
  }, [refresh]);

  const fund = useCallback(
    async (borrower: Borrower) => {
      let txHash: string | undefined;
      let explorerUrl: string | undefined;
      if (isFullAddress(borrower.wallet)) {
        try {
          const res = await fetch("/api/fund", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ business: borrower.wallet, amountUsdc: borrower.offerAed / 3.6725 }),
          });
          const data = await res.json();
          txHash = data.txHash;
          explorerUrl = data.explorerUrl ?? undefined;
        } catch {
          /* fail soft; record the facility regardless so the demo continues */
        }
      }
      const facility: Facility = {
        borrowerId: borrower.id,
        borrowerName: borrower.name,
        amountAed: borrower.offerAed,
        fundedAt: Date.now(),
        txHash,
        explorerUrl,
        repaid: false,
      };
      setFacilities((prev) => {
        const next = [...prev.filter((f) => f.borrowerId !== borrower.id), facility];
        saveFacilities(next);
        return next;
      });
    },
    [],
  );

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
