"use client";

import { useCallback, useEffect, useState } from "react";
import { getAccessToken } from "@privy-io/react-auth";
import type { Hex } from "viem";
import { chainConfigured, readBalances } from "@/lib/chain-client";

/*
 * Testnet wallet funding. A fresh embedded wallet has no gas or USDC, so it
 * can't settle. This reads the balance and, when low, lets the user top up from
 * the operator faucet in one tap — the friction-remover that makes a live demo
 * "sign a real on-chain payment" actually work for a brand-new wallet. Works for
 * both the importer and financier wallets (pass whichever address).
 */
export function FaucetCard({ walletAddress }: { walletAddress?: string }) {
  const [bal, setBal] = useState<{ pol: number; usdc: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!walletAddress || !chainConfigured()) return;
    try {
      setBal(await readBalances(walletAddress as Hex));
    } catch {
      /* RPC hiccup; leave last-known balance */
    }
  }, [walletAddress]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const fund = useCallback(async () => {
    if (!walletAddress) return;
    setBusy(true);
    setMsg(null);
    setLink(null);
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/faucet", {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ address: walletAddress }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "faucet failed");
      setMsg(`Funded ${data.usdcFunded} test USDC + gas.`);
      setLink(data.explorerUrl ?? null);
      await refresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "faucet failed");
    } finally {
      setBusy(false);
    }
  }, [walletAddress, refresh]);

  // Nothing to show until the on-chain layer is configured.
  if (!chainConfigured() || !walletAddress) return null;

  const low = !bal || bal.usdc < 1 || bal.pol < 0.01;

  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-ink">Test wallet</p>
          <p className="tnum mt-0.5 font-mono text-xs text-ink-3">
            {bal ? `${bal.usdc.toLocaleString()} USDC · ${bal.pol.toFixed(3)} POL` : "checking balance…"}
          </p>
        </div>
        {low && (
          <button
            onClick={fund}
            disabled={busy}
            className="shrink-0 rounded-full bg-teal px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-deep disabled:opacity-50"
          >
            {busy ? "Funding…" : "Fund test wallet"}
          </button>
        )}
      </div>
      {msg && (
        <p className="mt-3 text-xs text-ink-3">
          {msg}{" "}
          {link && (
            <a href={link} target="_blank" rel="noreferrer" className="text-teal-deep underline underline-offset-2">
              view tx
            </a>
          )}
        </p>
      )}
    </div>
  );
}
