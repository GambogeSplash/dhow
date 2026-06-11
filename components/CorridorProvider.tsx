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
  scoreCorridors,
} from "@/lib/corridor";
import {
  demoDraft,
  FINANCIER,
  IMPORTER,
  initialCorridors,
} from "@/lib/seed";

interface CorridorState {
  importer: typeof IMPORTER;
  financier: typeof FINANCIER;
  corridors: Corridor[];
  score: CorridorScore;
  prevScore: number; // score before the last settlement, for the tick-up animation
  offerAed: number;
  offerAccepted: boolean;
  draft: Corridor;
  // actions
  send: (c: Corridor) => void;
  attest: (id: string) => void;
  acceptOffer: () => void;
  reset: () => void;
}

const Ctx = createContext<CorridorState | null>(null);

/* Session-scoped persistence so a refresh or a deep-link mid-flow keeps the
 * walked state instead of snapping back to seed. Cleared on Reset and when the
 * tab closes. This is demo-resilience only; the chain/server seams are unchanged. */
const STORE_KEY = "dhow.corridor.v1";

interface PersistShape {
  corridors: Corridor[];
  draft: Corridor;
  offerAccepted: boolean;
  prevScore: number;
}

type ChainAction = "pay" | "lock" | "attest";

/** Calls the server chain route. Returns a real tx hash on-chain, or a
 *  simulated one when the chain isn't configured. Never throws — the demo
 *  must keep moving. */
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
    const data = await res.json();
    return { txHash: data.txHash, explorerUrl: data.explorerUrl ?? undefined };
  } catch {
    return {};
  }
}

export function CorridorProvider({ children }: { children: React.ReactNode }) {
  const [now] = useState(() => Date.now());
  const [corridors, setCorridors] = useState<Corridor[]>(() =>
    initialCorridors(now),
  );
  const [draft, setDraft] = useState<Corridor>(() => demoDraft(now));
  const [prevScore, setPrevScore] = useState<number>(
    () => scoreCorridors(initialCorridors(now), now).score,
  );
  const [offerAccepted, setOfferAccepted] = useState(false);

  // keep a ref in sync so actions can read the latest pre-mutation corridors
  const corridorsRef = useRef<Corridor[]>(corridors);
  corridorsRef.current = corridors;

  // Rehydrate once from sessionStorage. Runs after the first paint so server and
  // client first-render both use seed (no hydration mismatch); `hydrated` then
  // gates the persist effect below so it never clobbers stored state with seed.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORE_KEY);
      if (raw) {
        const s = JSON.parse(raw) as Partial<PersistShape>;
        if (Array.isArray(s.corridors)) {
          corridorsRef.current = s.corridors;
          setCorridors(s.corridors);
        }
        if (s.draft) setDraft(s.draft);
        if (typeof s.offerAccepted === "boolean") setOfferAccepted(s.offerAccepted);
        if (typeof s.prevScore === "number") setPrevScore(s.prevScore);
      }
    } catch {
      // corrupt/unavailable storage → fall through to seed
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      const payload: PersistShape = { corridors, draft, offerAccepted, prevScore };
      sessionStorage.setItem(STORE_KEY, JSON.stringify(payload));
    } catch {
      // storage full/blocked → demo still runs from in-memory state
    }
  }, [hydrated, corridors, draft, offerAccepted, prevScore]);

  const score = useMemo(() => scoreCorridors(corridors, now), [corridors, now]);
  const offerAed = useMemo(() => advanceOffer(score), [score]);

  const patch = useCallback((id: string, fields: Partial<Corridor>) => {
    setCorridors((prev) => {
      const updated = prev.map((c) => (c.id === id ? { ...c, ...fields } : c));
      corridorsRef.current = updated;
      return updated;
    });
  }, []);

  const send = useCallback(
    (c: Corridor) => {
      setPrevScore(scoreCorridors(corridorsRef.current, now).score);
      const t = Date.now();
      const settledImmediately = c.mode === "open";
      // optimistic: show state instantly, patch the real tx hash when it lands
      const next: Corridor = settledImmediately
        ? { ...c, status: "settled", settledAt: t }
        : { ...c, status: "locked" };
      setCorridors((prev) => {
        const updated = [...prev, next];
        corridorsRef.current = updated;
        return updated;
      });
      postChain(settledImmediately ? "pay" : "lock", c.ref, c.amountUsdc).then(
        ({ txHash, explorerUrl }) => patch(c.id, { txHash, explorerUrl }),
      );
    },
    [now, patch],
  );

  const attest = useCallback(
    (id: string) => {
      const target = corridorsRef.current.find((c) => c.id === id);
      setPrevScore(scoreCorridors(corridorsRef.current, now).score);
      const t = Date.now();
      patch(id, {
        status: "settled",
        settledAt: t,
        txHash: undefined,
        explorerUrl: undefined,
        proof: target?.proof
          ? { ...target.proof, status: "attested", attestedBy: "Gulf Inspectorate" }
          : undefined,
      });
      if (target) {
        postChain("attest", target.ref, target.amountUsdc).then(
          ({ txHash, explorerUrl }) => patch(id, { txHash, explorerUrl }),
        );
      }
    },
    [now, patch],
  );

  const acceptOffer = useCallback(() => setOfferAccepted(true), []);

  const reset = useCallback(() => {
    const init = initialCorridors(now);
    corridorsRef.current = init;
    setCorridors(init);
    setDraft(demoDraft(now));
    setPrevScore(scoreCorridors(init, now).score);
    setOfferAccepted(false);
    try {
      sessionStorage.removeItem(STORE_KEY);
    } catch {
      // ignore — the persist effect will rewrite seed state on next tick
    }
  }, [now]);

  const value: CorridorState = {
    importer: IMPORTER,
    financier: FINANCIER,
    corridors,
    score,
    prevScore,
    offerAed,
    offerAccepted,
    draft,
    send,
    attest,
    acceptOffer,
    reset,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCorridor(): CorridorState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCorridor must be used within CorridorProvider");
  return v;
}
