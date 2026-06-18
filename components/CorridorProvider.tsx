"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  advanceOffer,
  Corridor,
  CorridorScore,
  makeCorridorUsdc,
  scoreCorridors,
  SettlementMode,
} from "@/lib/corridor";
import {
  AccountRecord,
  Business,
  clearSampleAccount,
  createAccount,
  findAccountByEmail,
  isSampleId,
  loadAccount,
  loadSampleAccount,
  loadSession,
  SAMPLE_ACCOUNT_ID,
  saveAccount,
  saveSession,
  Supplier,
  walletStub,
} from "@/lib/account";
import { FINANCIER } from "@/lib/seed";

interface WorkspaceState {
  hydrated: boolean;

  // account
  business: Business | null;
  suppliers: Supplier[];
  financier: typeof FINANCIER;
  isSample: boolean;
  isAuthenticated: boolean;
  isOnboarded: boolean;

  // account actions
  signIn: (email: string) => { onboarded: boolean };
  saveBusiness: (b: { name: string; city: string; country: string }) => void;
  addSupplier: (s: { name: string; city: string; country: string }) => Supplier;
  connectWallet: (address?: string) => void;
  signOut: () => void;
  enterSample: () => void;

  // corridors
  corridors: Corridor[];
  score: CorridorScore;
  prevScore: number;
  offerAed: number;
  offerAccepted: boolean;

  // corridor actions
  sendPayment: (input: {
    supplierId: string;
    goods: string;
    amountAed: number;
    mode: SettlementMode;
  }) => Corridor | null;
  attest: (id: string) => void;
  refund: (id: string) => void;
  retry: (id: string) => void;
  acceptOffer: () => void;
}

const Ctx = createContext<WorkspaceState | null>(null);

type ChainAction = "pay" | "lock" | "attest" | "refund";

/** Calls the server chain route. Resolves to a tx hash (real on-chain, or a
 *  simulated one when unconfigured). A missing hash means the settlement request
 *  itself failed — the caller surfaces that as a failed write the user can retry. */
async function postChain(
  action: ChainAction,
  ref: string,
  amountUsdc: number,
): Promise<{ txHash?: string; explorerUrl?: string }> {
  try {
    const res = await fetch("/api/chain", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, ref, amountUsdc }),
    });
    if (!res.ok) return {};
    const data = await res.json();
    return { txHash: data.txHash, explorerUrl: data.explorerUrl ?? undefined };
  } catch {
    return {};
  }
}

function nextRef(corridors: Corridor[]): string {
  const nums = corridors
    .map((c) => parseInt(c.ref.replace(/\D/g, ""), 10))
    .filter((n) => !Number.isNaN(n));
  const max = nums.length ? Math.max(...nums) : 400;
  return `DHW-${String(max + 1).padStart(4, "0")}`;
}

function newSupplierId(): string {
  try {
    return `sup_${crypto.randomUUID().slice(0, 8)}`;
  } catch {
    return `sup_${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function CorridorProvider({ children }: { children: React.ReactNode }) {
  const [now] = useState(() => Date.now());
  const [hydrated, setHydrated] = useState(false);

  const [accountId, setAccountId] = useState<string | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [corridors, setCorridors] = useState<Corridor[]>([]);
  const [offerAccepted, setOfferAccepted] = useState(false);
  const [prevScore, setPrevScore] = useState(0);

  const corridorsRef = useRef<Corridor[]>(corridors);
  corridorsRef.current = corridors;

  const isSample = isSampleId(accountId);
  const isAuthenticated = !!accountId;
  const isOnboarded = !!business?.name;

  const applyRecord = useCallback((rec: AccountRecord) => {
    setBusiness(rec.business);
    setSuppliers(rec.suppliers);
    setCorridors(rec.corridors);
    corridorsRef.current = rec.corridors;
    setOfferAccepted(rec.offerAccepted);
    setPrevScore(rec.prevScore);
  }, []);

  // hydrate the active session once, post-mount (avoids SSR mismatch)
  useEffect(() => {
    const id = loadSession();
    if (id) {
      const rec = isSampleId(id) ? loadSampleAccount(now) : loadAccount(id);
      if (rec) {
        setAccountId(id);
        applyRecord(rec);
      } else {
        saveSession(null);
      }
    }
    setHydrated(true);
  }, [now, applyRecord]);

  // persist the active account whenever it changes
  useEffect(() => {
    if (!hydrated || !accountId || !business) return;
    saveAccount({ business, suppliers, corridors, offerAccepted, prevScore });
  }, [hydrated, accountId, business, suppliers, corridors, offerAccepted, prevScore]);

  const score = useMemo(() => scoreCorridors(corridors, now), [corridors, now]);
  const offerAed = useMemo(() => advanceOffer(score), [score]);

  const patch = useCallback((id: string, fields: Partial<Corridor>) => {
    setCorridors((prev) => {
      const updated = prev.map((c) => (c.id === id ? { ...c, ...fields } : c));
      corridorsRef.current = updated;
      return updated;
    });
  }, []);

  // ---- account actions ----

  const signIn = useCallback(
    (email: string) => {
      const existingId = findAccountByEmail(email);
      if (existingId) {
        const rec = loadAccount(existingId);
        if (rec) {
          setAccountId(existingId);
          applyRecord(rec);
          saveSession(existingId);
          return { onboarded: !!rec.business.name };
        }
      }
      const rec = createAccount(email, now);
      setAccountId(rec.business.id);
      applyRecord(rec);
      saveSession(rec.business.id);
      saveAccount(rec);
      return { onboarded: false };
    },
    [now, applyRecord],
  );

  const saveBusiness = useCallback(
    (b: { name: string; city: string; country: string }) => {
      setBusiness((prev) => (prev ? { ...prev, ...b } : prev));
    },
    [],
  );

  const addSupplier = useCallback(
    (s: { name: string; city: string; country: string }) => {
      const supplier: Supplier = { id: newSupplierId(), ...s };
      setSuppliers((prev) => [...prev, supplier]);
      return supplier;
    },
    [],
  );

  const connectWallet = useCallback((address?: string) => {
    setBusiness((prev) =>
      prev ? { ...prev, walletAddress: address || walletStub() } : prev,
    );
  }, []);

  const signOut = useCallback(() => {
    saveSession(null);
    setAccountId(null);
    setBusiness(null);
    setSuppliers([]);
    setCorridors([]);
    corridorsRef.current = [];
    setOfferAccepted(false);
    setPrevScore(0);
  }, []);

  const enterSample = useCallback(() => {
    clearSampleAccount();
    const rec = loadSampleAccount(now);
    setAccountId(SAMPLE_ACCOUNT_ID);
    applyRecord(rec);
    saveSession(SAMPLE_ACCOUNT_ID);
  }, [now, applyRecord]);

  // ---- corridor actions ----

  const sendPayment = useCallback(
    (input: {
      supplierId: string;
      goods: string;
      amountAed: number;
      mode: SettlementMode;
    }) => {
      const supplier = suppliers.find((s) => s.id === input.supplierId);
      if (!supplier || input.amountAed <= 0) return null;

      const t = Date.now();
      const settledImmediately = input.mode === "open";
      const c: Corridor = {
        id: `cor_${t}`,
        ref: nextRef(corridorsRef.current),
        supplier,
        goods: input.goods,
        amountAed: input.amountAed,
        amountUsdc: makeCorridorUsdc(input.amountAed),
        mode: input.mode,
        status: settledImmediately ? "settled" : "locked",
        settledAt: settledImmediately ? t : undefined,
        proof:
          input.mode === "prooflock"
            ? { status: "awaiting", label: "Bill of lading · Jebel Ali inbound" }
            : undefined,
        createdAt: t,
        txState: "pending",
      };

      setPrevScore(scoreCorridors(corridorsRef.current, now).score);
      setCorridors((prev) => {
        const updated = [...prev, c];
        corridorsRef.current = updated;
        return updated;
      });
      postChain(settledImmediately ? "pay" : "lock", c.ref, c.amountUsdc).then(
        ({ txHash, explorerUrl }) =>
          patch(c.id, {
            txHash,
            explorerUrl,
            txState: txHash ? "confirmed" : "failed",
          }),
      );
      return c;
    },
    [suppliers, now, patch],
  );

  const attest = useCallback(
    (id: string) => {
      const target = corridorsRef.current.find((c) => c.id === id);
      if (!target) return;
      setPrevScore(scoreCorridors(corridorsRef.current, now).score);
      patch(id, {
        status: "settled",
        settledAt: Date.now(),
        txHash: undefined,
        explorerUrl: undefined,
        txState: "pending",
        proof: target.proof
          ? { ...target.proof, status: "attested", attestedBy: "Gulf Inspectorate" }
          : undefined,
      });
      postChain("attest", target.ref, target.amountUsdc).then(
        ({ txHash, explorerUrl }) =>
          patch(id, { txHash, explorerUrl, txState: txHash ? "confirmed" : "failed" }),
      );
    },
    [now, patch],
  );

  const refund = useCallback(
    (id: string) => {
      const target = corridorsRef.current.find((c) => c.id === id);
      if (!target) return;
      setPrevScore(scoreCorridors(corridorsRef.current, now).score);
      patch(id, {
        status: "refunded",
        txHash: undefined,
        explorerUrl: undefined,
        txState: "pending",
        proof: target.proof ? { ...target.proof, status: "failed" } : undefined,
      });
      postChain("refund", target.ref, target.amountUsdc).then(
        ({ txHash, explorerUrl }) =>
          patch(id, { txHash, explorerUrl, txState: txHash ? "confirmed" : "failed" }),
      );
    },
    [now, patch],
  );

  const retry = useCallback(
    (id: string) => {
      const c = corridorsRef.current.find((x) => x.id === id);
      if (!c) return;
      const action: ChainAction =
        c.status === "refunded"
          ? "refund"
          : c.status === "locked"
            ? "lock"
            : c.mode === "open"
              ? "pay"
              : "attest";
      patch(id, { txState: "pending" });
      postChain(action, c.ref, c.amountUsdc).then(({ txHash, explorerUrl }) =>
        patch(id, { txHash, explorerUrl, txState: txHash ? "confirmed" : "failed" }),
      );
    },
    [patch],
  );

  const acceptOffer = useCallback(() => setOfferAccepted(true), []);

  const value: WorkspaceState = {
    hydrated,
    business,
    suppliers,
    financier: FINANCIER,
    isSample,
    isAuthenticated,
    isOnboarded,
    signIn,
    saveBusiness,
    addSupplier,
    connectWallet,
    signOut,
    enterSample,
    corridors,
    score,
    prevScore,
    offerAed,
    offerAccepted,
    sendPayment,
    attest,
    refund,
    retry,
    acceptOffer,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkspace(): WorkspaceState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWorkspace must be used within CorridorProvider");
  return v;
}

// Surface-facing aliases — same context, named for what each surface needs.
export const useAccount = useWorkspace;
export const useCorridor = useWorkspace;
