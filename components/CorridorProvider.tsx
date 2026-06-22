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
import { usePrivy, useWallets, getAccessToken } from "@privy-io/react-auth";
import type { EIP1193Provider, Hex } from "viem";
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
  Supplier,
  apiEnsureAccount,
  apiSaveProfile,
  apiSetWallet,
  apiSetOfferAccepted,
  apiAddSupplier,
  apiCreateCorridor,
  apiPatchCorridor,
} from "@/lib/account";
import {
  CHAIN_ID,
  payOpen,
  lockProoflock,
  releaseCorridor,
  refundCorridor,
} from "@/lib/chain-client";
import { FINANCIER } from "@/lib/financier";
import { PREVIEW_MODE } from "@/lib/preview";
import { SEED_NOW, seedBusiness, seedSuppliers, seedCorridors } from "@/lib/preview-seed";

const PROOF_LABEL = "Bill of lading · Jebel Ali inbound";
const INSPECTOR = "Gulf Inspectorate";

interface WorkspaceState {
  hydrated: boolean;

  // account
  business: Business | null;
  suppliers: Supplier[];
  financier: typeof FINANCIER;
  isAuthenticated: boolean;
  isOnboarded: boolean;
  walletAddress?: string;

  // account actions
  login: () => void;
  saveBusiness: (b: { name: string; city: string; country: string }) => void;
  addSupplier: (s: {
    name: string;
    city: string;
    country: string;
    walletAddress?: string;
  }) => Supplier;
  signOut: () => void;

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

/** Inspector signs the shipment-proof attestation server-side; returns its uid. */
async function postAttest(ref: string, supplier?: string): Promise<{ uid?: string }> {
  try {
    const res = await fetch("/api/attest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ref, supplier }),
    });
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}

/** Registry owner posts the freshly lifted Credit Score on-chain (server-side). */
async function postScore(business: string, score: number, attestationUid?: string): Promise<void> {
  try {
    await fetch("/api/score", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ business, score, attestationUid }),
    });
  } catch {
    /* registry not wired; score still reconciles from settled corridors */
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
  return PREVIEW_MODE ? (
    <CorridorPreview>{children}</CorridorPreview>
  ) : (
    <CorridorLive>{children}</CorridorLive>
  );
}

/** Seeded onboarded workspace for local preview (no Privy, no database), so the
 *  importer surfaces render fully populated and never redirect to onboarding. */
function CorridorPreview({ children }: { children: React.ReactNode }) {
  const score = scoreCorridors(seedCorridors, SEED_NOW);
  const value: WorkspaceState = {
    hydrated: true,
    business: seedBusiness,
    suppliers: seedSuppliers,
    financier: FINANCIER,
    isAuthenticated: true,
    isOnboarded: true,
    walletAddress: seedBusiness.walletAddress,
    login: () => {},
    saveBusiness: () => {},
    addSupplier: (s) => ({ id: "preview", ...s }),
    signOut: () => {},
    corridors: seedCorridors,
    score,
    prevScore: Math.max(0, score.score - 8),
    offerAed: advanceOffer(score),
    offerAccepted: false,
    sendPayment: () => null,
    attest: () => {},
    refund: () => {},
    retry: () => {},
    acceptOffer: () => {},
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function CorridorLive({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const [now] = useState(() => Date.now());

  const [loaded, setLoaded] = useState(false);
  const [business, setBusiness] = useState<Business | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [corridors, setCorridors] = useState<Corridor[]>([]);
  const [offerAccepted, setOfferAccepted] = useState(false);
  const [prevScore, setPrevScore] = useState(0);

  const corridorsRef = useRef<Corridor[]>(corridors);
  corridorsRef.current = corridors;
  const walletsRef = useRef(wallets);
  walletsRef.current = wallets;

  const embedded = wallets.find((w) => w.walletClientType === "privy") ?? wallets[0];
  const walletAddress = business?.walletAddress ?? embedded?.address;

  const isAuthenticated = ready && authenticated;
  const isOnboarded = !!business?.name;
  const hydrated = ready && (loaded || !authenticated);

  const applyRecord = useCallback((rec: AccountRecord) => {
    setBusiness(rec.business);
    setSuppliers(rec.suppliers);
    setCorridors(rec.corridors);
    corridorsRef.current = rec.corridors;
    setOfferAccepted(rec.offerAccepted);
  }, []);

  // Bootstrap: on auth, create-or-load the account from the server (keyed by the
  // verified Privy DID), recording the embedded wallet address as it appears.
  useEffect(() => {
    if (!ready) return;
    if (!authenticated) {
      setBusiness(null);
      setSuppliers([]);
      setCorridors([]);
      setOfferAccepted(false);
      setLoaded(true);
      return;
    }
    let cancelled = false;
    (async () => {
      const tok = await getAccessToken();
      if (!tok || cancelled) return;
      const email =
        user?.email?.address ?? (user?.google?.email as string | undefined) ?? "";
      const wallet = wallets.find((w) => w.walletClientType === "privy")?.address;
      try {
        const rec = await apiEnsureAccount(tok, { email, walletAddress: wallet });
        if (!cancelled) {
          applyRecord(rec);
          setLoaded(true);
        }
      } catch (err) {
        console.error("account load failed", err);
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // re-run when the wallet address materialises so it gets recorded
  }, [ready, authenticated, user?.id, wallets.length, applyRecord, user]);

  const score = useMemo(() => scoreCorridors(corridors, now), [corridors, now]);
  const offerAed = useMemo(() => advanceOffer(score), [score]);

  const patch = useCallback((id: string, fields: Partial<Corridor>) => {
    setCorridors((prev) => {
      const updated = prev.map((c) => (c.id === id ? { ...c, ...fields } : c));
      corridorsRef.current = updated;
      return updated;
    });
  }, []);

  const token = useCallback(async (): Promise<string> => {
    return (await getAccessToken()) ?? "";
  }, []);

  /** The user's embedded wallet as a viem-ready signer, on the right chain. */
  const signer = useCallback(async (): Promise<{ provider: EIP1193Provider; from: Hex }> => {
    const w = walletsRef.current.find((x) => x.walletClientType === "privy") ?? walletsRef.current[0];
    if (!w) throw new Error("No wallet available. Reconnect and try again.");
    try {
      await w.switchChain(CHAIN_ID);
    } catch {
      /* already on chain, or switch unsupported by this wallet */
    }
    const provider = (await w.getEthereumProvider()) as EIP1193Provider;
    return { provider, from: w.address as Hex };
  }, []);

  // ---- account actions ----

  const saveBusiness = useCallback(
    (b: { name: string; city: string; country: string }) => {
      setBusiness((prev) => (prev ? { ...prev, ...b } : prev));
      void (async () => {
        const t = await token();
        if (t) await apiSaveProfile(t, { ...b, walletAddress: embedded?.address }).catch(() => {});
      })();
    },
    [token, embedded],
  );

  const addSupplier = useCallback(
    (s: { name: string; city: string; country: string; walletAddress?: string }) => {
      const supplier: Supplier = { id: newSupplierId(), ...s };
      setSuppliers((prev) => [...prev, supplier]);
      void (async () => {
        const t = await token();
        if (t) await apiAddSupplier(t, supplier).catch(() => {});
      })();
      return supplier;
    },
    [token],
  );

  const signOut = useCallback(() => {
    void logout();
    setBusiness(null);
    setSuppliers([]);
    setCorridors([]);
    corridorsRef.current = [];
    setOfferAccepted(false);
    setPrevScore(0);
  }, [logout]);

  // Keep the recorded wallet address in sync once the embedded wallet exists.
  useEffect(() => {
    if (!authenticated || !business || business.walletAddress || !embedded?.address) return;
    const addr = embedded.address;
    setBusiness((prev) => (prev ? { ...prev, walletAddress: addr } : prev));
    void (async () => {
      const t = await token();
      if (t) await apiSetWallet(t, addr).catch(() => {});
    })();
  }, [authenticated, business, embedded?.address, token]);

  // ---- corridor actions ----

  const sendPayment = useCallback(
    (input: { supplierId: string; goods: string; amountAed: number; mode: SettlementMode }) => {
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
        proof: input.mode === "prooflock" ? { status: "awaiting", label: PROOF_LABEL } : undefined,
        createdAt: t,
        txState: "pending",
      };

      setPrevScore(scoreCorridors(corridorsRef.current, now).score);
      setCorridors((prev) => {
        const updated = [...prev, c];
        corridorsRef.current = updated;
        return updated;
      });

      void (async () => {
        const tok = await token();
        if (tok) {
          await apiCreateCorridor(tok, {
            id: c.id,
            ref: c.ref,
            supplierId: supplier.id,
            goods: c.goods,
            amountAed: c.amountAed,
            mode: c.mode,
            status: c.status,
            proofLabel: c.proof?.label,
            settledAt: c.settledAt,
            txState: "pending",
            createdAt: t,
          }).catch(() => {});
        }
        try {
          if (!supplier.walletAddress) {
            throw new Error("This supplier has no wallet address — add one to settle on-chain.");
          }
          const { provider, from } = await signer();
          const res = settledImmediately
            ? await payOpen(provider, from, supplier.walletAddress as Hex, c.amountUsdc)
            : await lockProoflock(provider, from, c.ref, supplier.walletAddress as Hex, c.amountUsdc);
          patch(c.id, { txHash: res.txHash, explorerUrl: res.explorerUrl, txState: "confirmed" });
          if (tok)
            await apiPatchCorridor(tok, c.id, {
              txHash: res.txHash,
              explorerUrl: res.explorerUrl,
              txState: "confirmed",
            }).catch(() => {});
        } catch (err) {
          console.error("settlement failed", err);
          patch(c.id, { txState: "failed" });
          if (tok) await apiPatchCorridor(tok, c.id, { txState: "failed" }).catch(() => {});
        }
      })();

      return c;
    },
    [suppliers, now, token, signer, patch],
  );

  const attest = useCallback(
    (id: string) => {
      const target = corridorsRef.current.find((c) => c.id === id);
      if (!target) return;
      const settledAt = Date.now();
      setPrevScore(scoreCorridors(corridorsRef.current, now).score);
      patch(id, {
        status: "settled",
        settledAt,
        txHash: undefined,
        explorerUrl: undefined,
        txState: "pending",
        proof: target.proof
          ? { ...target.proof, status: "attested", attestedBy: INSPECTOR }
          : undefined,
      });

      void (async () => {
        const tok = await token();
        if (tok)
          await apiPatchCorridor(tok, id, {
            status: "settled",
            settledAt,
            txState: "pending",
            proofStatus: "attested",
            proofAttestedBy: INSPECTOR,
            txHash: null,
            explorerUrl: null,
          }).catch(() => {});
        try {
          // Inspector attests the shipment proof (server), then the user signs
          // the release of escrowed funds against that real attestation.
          const { uid } = await postAttest(target.ref, target.supplier.walletAddress);
          if (!uid) throw new Error("attestation unavailable");
          const { provider, from } = await signer();
          const res = await releaseCorridor(provider, from, target.ref, uid as Hex);
          patch(id, { txHash: res.txHash, explorerUrl: res.explorerUrl, txState: "confirmed" });
          if (tok)
            await apiPatchCorridor(tok, id, {
              txHash: res.txHash,
              explorerUrl: res.explorerUrl,
              txState: "confirmed",
            }).catch(() => {});
          const wallet = business?.walletAddress;
          if (wallet) {
            const fresh = scoreCorridors(corridorsRef.current, now).score;
            void postScore(wallet, fresh, uid);
          }
        } catch (err) {
          console.error("release failed", err);
          patch(id, { txState: "failed" });
          if (tok) await apiPatchCorridor(tok, id, { txState: "failed" }).catch(() => {});
        }
      })();
    },
    [now, token, signer, patch, business],
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
      void (async () => {
        const tok = await token();
        if (tok)
          await apiPatchCorridor(tok, id, {
            status: "refunded",
            txState: "pending",
            proofStatus: "failed",
            txHash: null,
            explorerUrl: null,
          }).catch(() => {});
        try {
          const { provider, from } = await signer();
          const res = await refundCorridor(provider, from, target.ref);
          patch(id, { txHash: res.txHash, explorerUrl: res.explorerUrl, txState: "confirmed" });
          if (tok)
            await apiPatchCorridor(tok, id, {
              txHash: res.txHash,
              explorerUrl: res.explorerUrl,
              txState: "confirmed",
            }).catch(() => {});
        } catch (err) {
          console.error("refund failed", err);
          patch(id, { txState: "failed" });
          if (tok) await apiPatchCorridor(tok, id, { txState: "failed" }).catch(() => {});
        }
      })();
    },
    [now, token, signer, patch],
  );

  const retry = useCallback(
    (id: string) => {
      const c = corridorsRef.current.find((x) => x.id === id);
      if (!c) return;
      if (c.status === "refunded") return refund(id);
      if (c.status === "settled" && c.mode === "prooflock") return attest(id);
      // open pay or a still-locked prooflock: re-run the settlement sign
      patch(id, { txState: "pending" });
      void (async () => {
        const tok = await token();
        try {
          if (!c.supplier.walletAddress) throw new Error("supplier has no wallet address");
          const { provider, from } = await signer();
          const res =
            c.mode === "open"
              ? await payOpen(provider, from, c.supplier.walletAddress as Hex, c.amountUsdc)
              : await lockProoflock(provider, from, c.ref, c.supplier.walletAddress as Hex, c.amountUsdc);
          patch(id, { txHash: res.txHash, explorerUrl: res.explorerUrl, txState: "confirmed" });
          if (tok)
            await apiPatchCorridor(tok, id, {
              txHash: res.txHash,
              explorerUrl: res.explorerUrl,
              txState: "confirmed",
            }).catch(() => {});
        } catch (err) {
          console.error("retry failed", err);
          patch(id, { txState: "failed" });
          if (tok) await apiPatchCorridor(tok, id, { txState: "failed" }).catch(() => {});
        }
      })();
    },
    [token, signer, patch, refund, attest],
  );

  const acceptOffer = useCallback(() => {
    setOfferAccepted(true);
    void (async () => {
      const t = await token();
      if (t) await apiSetOfferAccepted(t, true).catch(() => {});
    })();
  }, [token]);

  const value: WorkspaceState = {
    hydrated,
    business,
    suppliers,
    financier: FINANCIER,
    isAuthenticated,
    isOnboarded,
    walletAddress,
    login,
    saveBusiness,
    addSupplier,
    signOut,
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
