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
import { assessCredit, type CreditAssessment } from "@/lib/credit";
import {
  apiListFacilities,
  apiCreateFacility,
  apiMarkRepaid,
  apiFinancierDeals,
  apiDealAction,
  apiOfferToBorrower,
  type DealActionInput,
} from "@/lib/account";
import { FINANCIER } from "@/lib/financier";
import { CHAIN_ID, payOpen } from "@/lib/chain-client";
import {
  applyAction,
  dealUsdc,
  type Deal,
  type DealTerms,
} from "@/lib/deal";
import { PREVIEW_MODE } from "@/lib/preview";
import {
  SEED_NOW,
  seedBorrowers,
  seedFacility,
  seedFinancierDeals,
  previewTx,
} from "@/lib/preview-seed";

/*
 * The financier (Creek Capital) side. Borrowers come from the shared database
 * via /api/borrowers (real, cross-machine), with the on-chain verified Credit
 * Score overlaid from the registry. The working-capital lifecycle runs on the
 * shared deal object (request → offer/counter → accept → fund → repay): the
 * financier negotiates terms and disburses with a REAL on-chain USDC transfer
 * it signs from its own Privy wallet to the borrower's wallet. The funded deal
 * (with its settlement tx) persists in the database.
 */

export interface Borrower {
  id: string;
  name: string;
  city: string;
  country: string;
  wallet?: string;
  corridors: Corridor[];
  score: CorridorScore;
  credit: CreditAssessment;
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
  logout: () => void;
  fund: (borrower: Borrower) => Promise<{ ok: boolean; error?: string }>;
  markRepaid: (borrowerId: string) => void;
  refresh: () => void;

  // A financier with an empty desk (no borrowers, deals or requests yet) sees a
  // labelled sample desk so the console is not dead until real importers arrive.
  isSample: boolean;
  startReal: () => void;

  // working-capital deals (the negotiation, financier side)
  deals: Deal[]; // deals this financier is engaged on
  requests: Deal[]; // open requests on the desk, unclaimed
  dealAction: (input: DealActionInput) => Promise<void>;
  offerToBorrower: (input: {
    borrowerId: string;
    borrowerName: string;
    terms: DealTerms;
    note?: string;
  }) => Promise<void>;
}

function isFullAddress(a?: string): boolean {
  return !!a && /^0x[0-9a-fA-F]{40}$/.test(a);
}

/** Capital deployed = the sum of funded (not yet repaid) deal advances. */
function deployedFromDeals(deals: Deal[]): number {
  return deals.filter((d) => d.status === "funded").reduce((s, d) => s + d.terms.amountAed, 0);
}

function toBorrower(
  business: Business,
  corridors: Corridor[],
  now: number,
  onchainScore: number | null,
): Borrower {
  const score = scoreCorridors(corridors, now);
  const credit = assessCredit({
    profile: { kybVerified: true, onboardedAt: business.createdAt },
    corridors,
    now,
  });
  return {
    id: business.id,
    name: business.name,
    city: business.city,
    country: business.country,
    wallet: business.walletAddress,
    corridors,
    score,
    credit,
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

/** Seeded, INTERACTIVE financier state for local preview (no Privy, no
 *  database). Negotiation and funding mutate local state so the buttons work;
 *  nothing is signed or persisted. */
function FinancierPreview({ children }: { children: React.ReactNode }) {
  const borrowers = seedBorrowers.map((r) =>
    toBorrower(r.business, r.corridors, SEED_NOW, scoreCorridors(r.corridors, SEED_NOW).score),
  );
  const [facilities, setFacilities] = useState<Facility[]>([seedFacility]);
  const [deals, setDeals] = useState<Deal[]>(() =>
    seedFinancierDeals.filter((d) => d.financierId),
  );
  const [requests, setRequests] = useState<Deal[]>(() =>
    seedFinancierDeals.filter((d) => !d.financierId),
  );

  const fund = useCallback(
    async (borrower: Borrower): Promise<{ ok: boolean; error?: string }> => {
      if (borrower.offerAed <= 0) return { ok: false, error: "No eligible offer." };
      const tx = previewTx();
      setFacilities((prev) => [
        ...prev.filter((f) => f.borrowerId !== borrower.id),
        {
          borrowerId: borrower.id,
          borrowerName: borrower.name,
          amountAed: borrower.offerAed,
          fundedAt: SEED_NOW,
          txHash: tx.txHash,
          explorerUrl: tx.explorerUrl,
          repaid: false,
        },
      ]);
      return { ok: true };
    },
    [],
  );

  const markRepaid = useCallback((borrowerId: string) => {
    setFacilities((prev) =>
      prev.map((f) => (f.borrowerId === borrowerId ? { ...f, repaid: true } : f)),
    );
  }, []);

  // Preview deal actions mutate local state through the same pure state machine
  // the server uses, so the negotiation behaves identically without a backend.
  // A requested deal the financier engages (offer/counter/decline) graduates
  // from the open-requests inbox into the financier's engaged deals.
  const dealAction = useCallback<FinancierState["dealAction"]>(async (input) => {
    const apply = (d: Deal): Deal => {
      switch (input.action) {
        case "offer":
          return applyAction(
            d,
            {
              kind: "offer",
              by: "financier",
              financierId: FINANCIER.id,
              financierName: FINANCIER.name,
              terms: input.terms,
              note: input.note,
            },
            SEED_NOW,
          );
        case "counter":
          return applyAction(d, { kind: "counter", by: "financier", terms: input.terms, note: input.note }, SEED_NOW);
        case "accept":
          return applyAction(d, { kind: "accept", by: "financier" }, SEED_NOW);
        case "decline":
          return applyAction(d, { kind: "decline", by: "financier", note: input.note }, SEED_NOW);
        case "fund": {
          const tx = previewTx();
          return applyAction(
            d,
            { kind: "fund", by: "financier", txHash: tx.txHash, explorerUrl: tx.explorerUrl, financierWallet: PREVIEW_WALLET },
            SEED_NOW,
          );
        }
        default:
          return d;
      }
    };

    // Acting on an unclaimed request claims it onto the desk.
    const request = requests.find((d) => d.id === input.dealId);
    if (request) {
      const next = apply(request);
      setRequests((prev) => prev.filter((d) => d.id !== input.dealId));
      setDeals((prev) => [next, ...prev]);
      return;
    }
    setDeals((prev) => prev.map((d) => (d.id === input.dealId ? apply(d) : d)));
  }, [requests]);

  const offerToBorrower = useCallback<FinancierState["offerToBorrower"]>(
    async ({ borrowerId, borrowerName, terms, note }) => {
      const deal = openOfferLocal({ borrowerId, borrowerName, terms, note });
      setDeals((prev) => [deal, ...prev]);
    },
    [],
  );

  const deployedAed = deployedFromDeals(deals);
  return (
    <Ctx.Provider
      value={{
        financier: FINANCIER,
        borrowers,
        facilities,
        deployedAed,
        availableAed: Math.max(0, FINANCIER.appetiteAed - deployedAed),
        isAuthenticated: true,
        walletAddress: PREVIEW_WALLET,
        login: () => {},
        logout: () => {},
        fund,
        markRepaid,
        refresh: () => {},
        isSample: false,
        startReal: () => {},
        deals,
        requests,
        dealAction,
        offerToBorrower,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

const PREVIEW_WALLET = "0xf15a9c1e000000000000000000000000000000ca";

/** Build a proactive offer locally (preview), mirroring openOffer on the server. */
function openOfferLocal(args: {
  borrowerId: string;
  borrowerName: string;
  terms: DealTerms;
  note?: string;
}): Deal {
  const ev = {
    id: `ev_${Math.random().toString(36).slice(2, 14)}`,
    actor: "financier" as const,
    kind: "offered" as const,
    terms: args.terms,
    note: args.note,
    createdAt: SEED_NOW,
  };
  return {
    id: `deal_${Math.random().toString(36).slice(2, 14)}`,
    borrowerId: args.borrowerId,
    borrowerName: args.borrowerName,
    financierId: FINANCIER.id,
    financierName: FINANCIER.name,
    status: "offered",
    turn: "borrower",
    terms: args.terms,
    createdAt: SEED_NOW,
    updatedAt: SEED_NOW,
    events: [ev],
  };
}

function FinancierLive({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { wallets } = useWallets();
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [requests, setRequests] = useState<Deal[]>([]);
  const [sampleDismissed, setSampleDismissed] = useState(false);

  const walletsRef = useRef(wallets);
  walletsRef.current = wallets;
  const borrowersRef = useRef<Borrower[]>(borrowers);
  borrowersRef.current = borrowers;
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

  const loadDeals = useCallback(async () => {
    if (!authenticated) {
      setDeals([]);
      setRequests([]);
      return;
    }
    try {
      const t = await token();
      if (!t) return;
      const { deals: engaged, requests: open } = await apiFinancierDeals(t);
      setDeals(engaged);
      setRequests(open);
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

  // The borrower may act between the financier's visits; poll so an incoming
  // counter/accept and fresh requests land without a manual refresh.
  useEffect(() => {
    void loadDeals();
    if (!authenticated) return;
    const iv = setInterval(() => void loadDeals(), 6000);
    return () => clearInterval(iv);
  }, [loadDeals, authenticated]);

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

  // ---- working-capital deal actions ----

  const dealAction = useCallback<FinancierState["dealAction"]>(
    async (input) => {
      const t = await token();
      if (!t) return;
      // Funding is a REAL on-chain USDC transfer the financier signs to the
      // borrower's wallet, then we record the state transition with that tx.
      if (input.action === "fund") {
        const deal = [...deals, ...requests].find((d) => d.id === input.dealId);
        const borrower = borrowersRef.current.find((b) => b.id === deal?.borrowerId);
        if (!deal) throw new Error("Deal not found.");
        if (!isFullAddress(borrower?.wallet)) {
          throw new Error("Borrower has no settlement wallet address yet.");
        }
        const { provider, from } = await signer();
        const res = await payOpen(provider, from, borrower!.wallet as Hex, dealUsdc(deal.terms.amountAed));
        input = { ...input, txHash: res.txHash, explorerUrl: res.explorerUrl, financierWallet: from };
      }
      const updated = await apiDealAction(t, input);
      // Engaging an open request moves it from the inbox onto the desk.
      setRequests((prev) => prev.filter((d) => d.id !== updated.id));
      setDeals((prev) =>
        prev.some((d) => d.id === updated.id)
          ? prev.map((d) => (d.id === updated.id ? updated : d))
          : [updated, ...prev],
      );
    },
    [token, signer, deals, requests],
  );

  const offerToBorrower = useCallback<FinancierState["offerToBorrower"]>(
    async (input) => {
      const t = await token();
      if (!t) return;
      const deal = await apiOfferToBorrower(t, input);
      setDeals((prev) => [deal, ...prev.filter((d) => d.id !== deal.id)]);
    },
    [token],
  );

  // Sample desk: a financier whose console is empty (no real borrowers, deals or
  // requests yet) sees seeded borrowers and a live negotiation, until a real one
  // arrives or they dismiss it. Only the read views are seeded; funding still
  // signs from their real wallet.
  const accountEmpty =
    isAuthenticated && borrowers.length === 0 && deals.length === 0 && requests.length === 0;
  const sampleMode = accountEmpty && !sampleDismissed;

  useEffect(() => {
    if (!user?.id) return;
    try {
      if (localStorage.getItem(`dhow.fin.sample.dismissed.${user.id}`) === "1") setSampleDismissed(true);
    } catch {
      /* storage unavailable */
    }
  }, [user?.id]);

  const startReal = useCallback(() => {
    setSampleDismissed(true);
    try {
      if (user?.id) localStorage.setItem(`dhow.fin.sample.dismissed.${user.id}`, "1");
    } catch {
      /* storage unavailable */
    }
  }, [user?.id]);

  const viewBorrowers = sampleMode
    ? seedBorrowers.map((r) =>
        toBorrower(r.business, r.corridors, SEED_NOW, scoreCorridors(r.corridors, SEED_NOW).score),
      )
    : borrowers;
  const viewDeals = sampleMode ? seedFinancierDeals.filter((d) => d.financierId) : deals;
  const viewRequests = sampleMode ? seedFinancierDeals.filter((d) => !d.financierId) : requests;

  const deployedAed = deployedFromDeals(viewDeals);
  const availableAed = Math.max(0, FINANCIER.appetiteAed - deployedAed);

  return (
    <Ctx.Provider
      value={{
        financier: FINANCIER,
        borrowers: viewBorrowers,
        facilities,
        deployedAed,
        availableAed,
        isAuthenticated,
        walletAddress: embedded?.address,
        login,
        logout,
        fund,
        markRepaid,
        refresh,
        isSample: sampleMode,
        startReal,
        deals: viewDeals,
        requests: viewRequests,
        dealAction,
        offerToBorrower,
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
