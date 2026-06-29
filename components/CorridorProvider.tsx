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
  Counterparty,
  CorridorScore,
  makeCorridorUsdc,
  scoreCorridors,
  SettlementMode,
} from "@/lib/credit";
import { assessCredit, type CreditAssessment, type Receivable } from "@/lib/credit";
import type { Business as BizForCredit } from "@/lib/account";
import {
  AccountRecord,
  Business,
  Supplier,
  DealActionInput,
  apiEnsureAccount,
  apiSaveProfile,
  apiSetWallet,
  apiSetOfferAccepted,
  apiAddSupplier,
  apiCreateCorridor,
  apiPatchCorridor,
  apiCreateReceivable,
  apiVerifyReceivable,
  apiBorrowerDeals,
  apiRequestDeal,
  apiDealAction,
} from "@/lib/account";
import {
  applyAction,
  openRequest,
  newDealId,
  totalRepayableAed,
  dealUsdc,
  OPEN_STATUSES,
  ACTIVE_STATUSES,
  type Deal,
  type DealTerms,
} from "@/lib/deal";
import {
  CHAIN_ID,
  payOpen,
  lockProoflock,
  releaseCorridor,
  refundCorridor,
} from "@/lib/chain-client";
import { FINANCIER } from "@/lib/financier";
import { PREVIEW_MODE } from "@/lib/preview";
import {
  SEED_NOW,
  seedBusiness,
  seedSuppliers,
  seedCorridors,
  seedReceivables,
  seedImporterDeals,
  previewTx,
} from "@/lib/preview-seed";

/** Working-capital headroom a borrower can request, sized from their record. */
function requestHeadroom(score: CorridorScore): number {
  if (!score.eligible) return 0;
  const base = score.avgCorridorAed * (score.tier === "preferred" ? 0.6 : 0.4);
  return Math.max(5_000, Math.round(base / 1_000) * 1_000);
}

/** v2 credit assessment (lib/credit.ts) from the workspace's own facts. KYB is
 *  treated as complete once a business has onboarded; the fund-flow graph is not
 *  wired client-side, so no counterparties are flagged here. */
function creditFor(
  business: BizForCredit | null,
  corridors: Corridor[],
  receivables: Receivable[],
  now: number,
): CreditAssessment {
  return assessCredit({
    profile: {
      kybVerified: !!business,
      onboardedAt: business?.createdAt ?? now,
    },
    corridors,
    receivables,
    now,
  });
}

/** A bytes32-shaped sim attestation uid for preview (no chain). */
function simUid(): string {
  let s = "0x";
  for (let i = 0; i < 64; i++) s += Math.floor(Math.random() * 16).toString(16);
  return s;
}

function newReceivableId(): string {
  try {
    return `rcv_${crypto.randomUUID().slice(0, 8)}`;
  } catch {
    return `rcv_${Math.random().toString(36).slice(2, 10)}`;
  }
}

/** Build a fresh, unverified receivable from a borrower's form input. */
function makeReceivable(input: {
  debtorName: string;
  debtorCity?: string;
  amountAed: number;
  dueAt: number;
}): Receivable {
  const debtor: Counterparty = {
    id: `dbt_${input.debtorName.toLowerCase().replace(/\s+/g, "-").slice(0, 16)}`,
    name: input.debtorName,
    city: input.debtorCity ?? "—",
    country: "AE",
  };
  return {
    id: newReceivableId(),
    debtor,
    amountAed: input.amountAed,
    dueAt: input.dueAt,
    status: "expected",
  };
}

/** The deal that matters now: an open negotiation or live facility, newest first. */
function pickActiveDeal(deals: Deal[]): Deal | null {
  const live = deals
    .filter((d) => OPEN_STATUSES.includes(d.status) || ACTIVE_STATUSES.includes(d.status))
    .sort((a, b) => b.updatedAt - a.updatedAt);
  return live[0] ?? null;
}

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
  credit: CreditAssessment;
  prevScore: number;
  offerAed: number;
  offerAccepted: boolean;

  // receivables (the inflow side — secures the working-capital line)
  receivables: Receivable[];
  addReceivable: (input: {
    debtorName: string;
    debtorCity?: string;
    amountAed: number;
    dueAt: number;
  }) => void;
  verifyReceivable: (id: string) => Promise<void>;

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

  // working-capital deals
  deals: Deal[];
  activeDeal: Deal | null;
  maxAdvanceAed: number;
  requestCapital: (input: { terms: DealTerms; purpose?: string }) => Promise<void>;
  dealAction: (input: DealActionInput) => Promise<void>;

  // a funded facility can be cleared from a fresh settlement: when the borrower
  // settles while a deal is funded, this prompt offers a one-tap repayment, so
  // "repaid from your next settlement" is a real action, not just copy.
  repayPrompt: { dealId: string; financierName: string; amountAed: number; corridorRef: string } | null;
  dismissRepayPrompt: () => void;

  // A freshly onboarded, empty account shows a labelled sample workspace (so the
  // dashboard is not dead) until the user takes their first real action.
  isSample: boolean;
  startReal: () => void;
}

/** If a funded deal is outstanding, the settlement that just landed can clear it. */
function fundedRepayPrompt(deals: Deal[], corridorRef: string) {
  const funded = deals.find((d) => d.status === "funded");
  if (!funded) return null;
  return {
    dealId: funded.id,
    financierName: funded.financierName ?? "your financier",
    amountAed: totalRepayableAed(funded.terms),
    corridorRef,
  };
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

/** Seeded, INTERACTIVE workspace for local preview (no Privy, no database). All
 *  actions mutate local state so every button works for a walkthrough; nothing
 *  is signed or persisted. Surfaces render fully populated and never redirect. */
function CorridorPreview({ children }: { children: React.ReactNode }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>(seedSuppliers);
  const [corridors, setCorridors] = useState<Corridor[]>(seedCorridors);
  const [offerAccepted, setOfferAccepted] = useState(false);
  const [deals, setDeals] = useState<Deal[]>(seedImporterDeals);
  const [repayPrompt, setRepayPrompt] = useState<WorkspaceState["repayPrompt"]>(null);
  const dealsRef = useRef(deals);
  dealsRef.current = deals;
  const [prevScore, setPrevScore] = useState(() =>
    Math.max(0, scoreCorridors(seedCorridors, SEED_NOW).score - 8),
  );
  const corridorsRef = useRef(corridors);
  corridorsRef.current = corridors;
  const [receivables, setReceivables] = useState<Receivable[]>(seedReceivables);
  const score = scoreCorridors(corridors, SEED_NOW);
  const credit = creditFor(seedBusiness, corridors, receivables, SEED_NOW);

  // Receivables (preview): attestation is simulated locally — verifying flips an
  // expected claim to verified with a sim uid, which unlocks the secured line.
  const addReceivable: WorkspaceState["addReceivable"] = (input) => {
    setReceivables((prev) => [makeReceivable(input), ...prev]);
  };
  const verifyReceivable: WorkspaceState["verifyReceivable"] = async (id) => {
    setReceivables((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "verified", attestationUid: simUid() } : r)),
    );
  };

  // Preview deal actions mutate local state through the same pure state machine
  // the server uses, so the negotiation behaves identically without a backend.
  const requestCapital: WorkspaceState["requestCapital"] = async ({ terms, purpose }) => {
    const deal = openRequest({
      id: newDealId(),
      borrowerId: seedBusiness.id,
      borrowerName: seedBusiness.name,
      terms,
      purpose,
      now: SEED_NOW,
    });
    setDeals((prev) => [deal, ...prev]);
  };

  const dealAction: WorkspaceState["dealAction"] = async (input) => {
    setDeals((prev) => {
      const target = prev.find((d) => d.id === input.dealId);
      if (!target) return prev;
      const step = (d: Deal): Deal => {
        switch (input.action) {
          case "counter":
            return applyAction(d, { kind: "counter", by: "borrower", terms: input.terms, note: input.note }, SEED_NOW);
          case "accept":
            return applyAction(d, { kind: "accept", by: "borrower" }, SEED_NOW);
          case "decline":
            return applyAction(d, { kind: "decline", by: "borrower", note: input.note }, SEED_NOW);
          case "withdraw":
            return applyAction(d, { kind: "withdraw", by: "borrower" }, SEED_NOW);
          case "repay": {
            const tx = previewTx();
            return applyAction(d, { kind: "repay", by: "borrower", txHash: tx.txHash, explorerUrl: tx.explorerUrl }, SEED_NOW);
          }
          default:
            return d;
        }
      };
      let next = prev.map((d) => (d.id === input.dealId ? step(d) : d));
      // Accepting one competing bid closes the parent request and the rivals.
      if (input.action === "accept" && target.requestId) {
        const reqId = target.requestId;
        next = next.map((d) => {
          if (d.id === reqId && d.status === "requested") return { ...d, status: "withdrawn", updatedAt: SEED_NOW };
          if (d.requestId === reqId && d.id !== target.id && (d.status === "offered" || d.status === "countered"))
            return { ...d, status: "declined", updatedAt: SEED_NOW };
          return d;
        });
      }
      return next;
    });
  };

  const newId = (p: string) =>
    `${p}_${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10)}`;

  const addSupplier: WorkspaceState["addSupplier"] = (s) => {
    const sup: Supplier = { id: newId("sup"), ...s };
    setSuppliers((prev) => [...prev, sup]);
    return sup;
  };

  const sendPayment: WorkspaceState["sendPayment"] = (input) => {
    const supplier = suppliers.find((s) => s.id === input.supplierId);
    if (!supplier) return null;
    const settledNow = input.mode === "open";
    const seq = 420 + corridors.filter((c) => c.ref.startsWith("DHW-")).length;
    const tx = previewTx();
    const corridor: Corridor = {
      id: newId("dhw"),
      ref: `DHW-0${seq}`,
      supplier,
      goods: input.goods,
      amountAed: input.amountAed,
      amountUsdc: makeCorridorUsdc(input.amountAed),
      mode: input.mode,
      status: settledNow ? "settled" : "locked",
      proof:
        input.mode === "prooflock" ? { status: "awaiting", label: PROOF_LABEL } : undefined,
      createdAt: SEED_NOW,
      settledAt: settledNow ? SEED_NOW : undefined,
      txHash: tx.txHash,
      explorerUrl: tx.explorerUrl,
      txState: "confirmed",
    };
    setPrevScore(score.score);
    setCorridors((prev) => [corridor, ...prev]);
    if (settledNow) setRepayPrompt(fundedRepayPrompt(dealsRef.current, corridor.ref));
    return corridor;
  };

  const attest: WorkspaceState["attest"] = (id) => {
    setPrevScore(scoreCorridors(corridorsRef.current, SEED_NOW).score);
    const target = corridorsRef.current.find((c) => c.id === id);
    setCorridors((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              status: "settled",
              settledAt: SEED_NOW,
              txState: "confirmed",
              proof: c.proof
                ? { ...c.proof, status: "attested", attestedBy: INSPECTOR }
                : c.proof,
            }
          : c,
      ),
    );
    if (target) setRepayPrompt(fundedRepayPrompt(dealsRef.current, target.ref));
  };

  const refund: WorkspaceState["refund"] = (id) => {
    setPrevScore(scoreCorridors(corridorsRef.current, SEED_NOW).score);
    setCorridors((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              status: "refunded",
              proof: c.proof ? { ...c.proof, status: "failed" } : c.proof,
            }
          : c,
      ),
    );
  };

  const retry: WorkspaceState["retry"] = (id) => {
    const tx = previewTx();
    setCorridors((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              txState: "confirmed",
              status: c.mode === "open" ? "settled" : c.status,
              settledAt: c.mode === "open" ? SEED_NOW : c.settledAt,
              txHash: tx.txHash,
              explorerUrl: tx.explorerUrl,
            }
          : c,
      ),
    );
  };

  const value: WorkspaceState = {
    hydrated: true,
    business: seedBusiness,
    suppliers,
    financier: FINANCIER,
    isAuthenticated: true,
    isOnboarded: true,
    walletAddress: seedBusiness.walletAddress,
    login: () => {},
    saveBusiness: () => {},
    addSupplier,
    signOut: () => {},
    corridors,
    score,
    credit,
    prevScore,
    offerAed: advanceOffer(score),
    offerAccepted,
    receivables,
    addReceivable,
    verifyReceivable,
    sendPayment,
    attest,
    refund,
    retry,
    acceptOffer: () => setOfferAccepted(true),
    isSample: false,
    startReal: () => {},
    deals,
    activeDeal: pickActiveDeal(deals),
    maxAdvanceAed: credit.eligible ? credit.limitAed : requestHeadroom(score),
    requestCapital,
    dealAction,
    repayPrompt,
    dismissRepayPrompt: () => setRepayPrompt(null),
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
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [offerAccepted, setOfferAccepted] = useState(false);
  const [prevScore, setPrevScore] = useState(0);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [repayPrompt, setRepayPrompt] = useState<WorkspaceState["repayPrompt"]>(null);
  const [sampleDismissed, setSampleDismissed] = useState(false);

  const corridorsRef = useRef<Corridor[]>(corridors);
  corridorsRef.current = corridors;
  const dealsRef = useRef<Deal[]>(deals);
  dealsRef.current = deals;
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
    setReceivables(rec.receivables ?? []);
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

  // Sample workspace: a fresh, onboarded, empty account sees seeded activity
  // (suppliers + settled corridors + the resulting score) until it takes its
  // first real action. Dismissal persists per user so it never comes back.
  const accountEmpty = isOnboarded && corridors.length === 0 && suppliers.length === 0;
  const sampleMode = accountEmpty && !sampleDismissed;

  useEffect(() => {
    if (!user?.id) return;
    try {
      if (localStorage.getItem(`dhow.sample.dismissed.${user.id}`) === "1") setSampleDismissed(true);
    } catch {
      /* storage unavailable */
    }
  }, [user?.id]);

  const startReal = useCallback(() => {
    setSampleDismissed(true);
    try {
      if (user?.id) localStorage.setItem(`dhow.sample.dismissed.${user.id}`, "1");
    } catch {
      /* storage unavailable */
    }
  }, [user?.id]);

  // Only the read-only views (settlement history + the score it produces) get the
  // sample overlay. Suppliers and deals stay real and empty, so the Send and
  // Request forms always operate on the user's own data, never sample rows.
  const viewCorridors = sampleMode ? seedCorridors : corridors;
  const realScore = useMemo(() => scoreCorridors(corridors, now), [corridors, now]);
  // Score the sample against its own reference instant so cadence reads fresh.
  const score = sampleMode ? scoreCorridors(seedCorridors, SEED_NOW) : realScore;
  const offerAed = useMemo(() => advanceOffer(score), [score]);
  const credit = useMemo(
    () =>
      sampleMode
        ? creditFor(seedBusiness, seedCorridors, seedReceivables, SEED_NOW)
        : creditFor(business, corridors, receivables, now),
    [sampleMode, business, corridors, receivables, now],
  );

  // Receivables (live): the inspector attests the obligation server-side (real
  // EAS uid); a verified receivable secures the working-capital line. Held in
  // local state for now — persisting to the database is the next step.
  const addReceivable = useCallback<WorkspaceState["addReceivable"]>((input) => {
    const r = makeReceivable(input);
    setReceivables((prev) => [r, ...prev]); // optimistic
    (async () => {
      const tok = await getAccessToken();
      if (tok)
        await apiCreateReceivable(tok, {
          id: r.id,
          debtorId: r.debtor.id,
          debtorName: r.debtor.name,
          debtorCity: r.debtor.city,
          amountAed: r.amountAed,
          dueAt: r.dueAt,
          createdAt: Date.now(),
        }).catch((e) => console.error("receivable persist failed", e));
    })();
  }, []);
  const verifyReceivable = useCallback<WorkspaceState["verifyReceivable"]>(
    async (id) => {
      // The inspector attests the obligation on-chain; the uid is the proof.
      const { uid } = await postAttest(`RCV-${id}`, walletAddress);
      if (!uid) throw new Error("Attestation service unavailable. Try again once chain is configured.");
      setReceivables((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: "verified", attestationUid: uid } : r)),
      );
      const tok = await getAccessToken();
      if (tok) await apiVerifyReceivable(tok, id, uid).catch((e) => console.error("receivable verify persist failed", e));
    },
    [walletAddress],
  );

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
    setDeals([]);
    setRepayPrompt(null);
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
      if (settledImmediately) setRepayPrompt(fundedRepayPrompt(dealsRef.current, c.ref));

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
      setRepayPrompt(fundedRepayPrompt(dealsRef.current, target.ref));
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
          // No score post: the escrow's releaseWithAttestation already recorded
          // this settlement on-chain in the same tx, so the registry score
          // updated atomically. The financier reads it via GET /api/score.
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

  // ---- working-capital deal actions ----

  const loadDeals = useCallback(async () => {
    if (!authenticated) return setDeals([]);
    try {
      const t = await token();
      if (!t) return;
      setDeals(await apiBorrowerDeals(t));
    } catch {
      /* not configured / unauthenticated */
    }
  }, [authenticated, token]);

  useEffect(() => {
    void loadDeals();
    if (!authenticated) return;
    // The financier may act between the borrower's visits; poll so an incoming
    // offer/counter lands without a manual refresh.
    const iv = setInterval(() => void loadDeals(), 6000);
    return () => clearInterval(iv);
  }, [loadDeals, authenticated]);

  const requestCapital = useCallback<WorkspaceState["requestCapital"]>(
    async ({ terms, purpose }) => {
      const t = await token();
      if (!t) return;
      const deal = await apiRequestDeal(t, { terms, purpose });
      setDeals((prev) => [deal, ...prev.filter((d) => d.id !== deal.id)]);
    },
    [token],
  );

  const dealAction = useCallback<WorkspaceState["dealAction"]>(
    async (input) => {
      const t = await token();
      if (!t) return;
      // Repayment is a real on-chain USDC transfer the borrower signs to the
      // financier's funding wallet, then we record the state transition.
      if (input.action === "repay") {
        const deal = deals.find((d) => d.id === input.dealId);
        if (deal?.financierWallet) {
          try {
            const { provider, from } = await signer();
            const res = await payOpen(provider, from, deal.financierWallet as Hex, dealUsdc(totalRepayableAed(deal.terms)));
            input = { ...input, txHash: res.txHash, explorerUrl: res.explorerUrl };
          } catch (err) {
            console.error("repay transfer failed", err);
            throw err;
          }
        }
      }
      const updated = await apiDealAction(t, input);
      setDeals((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    },
    [token, signer, deals],
  );

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
    corridors: viewCorridors,
    score,
    credit,
    prevScore,
    offerAed,
    offerAccepted,
    receivables: sampleMode ? seedReceivables : receivables,
    addReceivable,
    verifyReceivable,
    sendPayment,
    attest,
    refund,
    retry,
    acceptOffer,
    isSample: sampleMode,
    startReal,
    deals,
    activeDeal: pickActiveDeal(deals),
    maxAdvanceAed: credit.eligible ? credit.limitAed : requestHeadroom(score),
    requestCapital,
    dealAction,
    repayPrompt,
    dismissRepayPrompt: () => setRepayPrompt(null),
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
