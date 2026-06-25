"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import type { Hex } from "viem";
import { useCorridor } from "@/components/CorridorProvider";
import { Avatar } from "@/components/Avatar";
import { FaucetCard } from "@/components/FaucetCard";
import { ChainBadge } from "@/components/ChainBadge";
import { AED_PER_USD, makeCorridorUsdc, SettlementMode, usdcLabel } from "@/lib/corridor";
import { press } from "@/lib/motion";
import { chainConfigured, readBalances } from "@/lib/chain-client";
import { cleanText, sanitizeSupplier, GOODS_MAX, NAME_MAX, PLACE_MAX } from "@/lib/validate";

/*
 * The payment composer, extracted so it can live in a modal (the default in-app
 * path) and still back a full-page deep link. `onClose` fires after a send or a
 * cancel; the corridor is created on the provider and the user lands on the
 * Cashflow Record.
 */
export function SendPaymentForm({
  initialSupplierId,
  onClose,
}: {
  initialSupplierId?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const { business, suppliers, addSupplier, sendPayment, walletAddress } = useCorridor();

  const [supplierId, setSupplierId] = useState(initialSupplierId ?? suppliers[0]?.id ?? "");
  const [goods, setGoods] = useState("");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<SettlementMode>("prooflock");
  const [addingSupplier, setAddingSupplier] = useState(suppliers.length === 0);
  const [newSup, setNewSup] = useState({ name: "", city: "", country: "", walletAddress: "" });

  // Live USDC balance for a pre-flight check. Null until a real balance is read
  // (preview mode / unconfigured chain / no wallet leave it null, which skips
  // the check so the happy path is never blocked on an unknown balance).
  const [usdcBalance, setUsdcBalance] = useState<number | null>(null);

  const refreshBalance = useCallback(async () => {
    if (!walletAddress || !chainConfigured()) {
      setUsdcBalance(null);
      return;
    }
    try {
      const bal = await readBalances(walletAddress as Hex);
      setUsdcBalance(bal ? bal.usdc : null);
    } catch {
      setUsdcBalance(null);
    }
  }, [walletAddress]);

  useEffect(() => {
    void refreshBalance();
  }, [refreshBalance]);

  const amountAed = Number(amount.replace(/[^0-9.]/g, "")) || 0;
  const amountUsdc = amountAed > 0 ? makeCorridorUsdc(amountAed) : 0;
  const goodsOver = goods.trim().length > GOODS_MAX;
  const overBalance = usdcBalance !== null && amountUsdc > usdcBalance;
  const canSend = !!supplierId && amountAed > 0 && goods.trim().length > 0 && !goodsOver && !overBalance;
  const selectedSupplier = suppliers.find((s) => s.id === supplierId);
  const newSupOver =
    newSup.name.trim().length > NAME_MAX ||
    newSup.city.trim().length > PLACE_MAX ||
    newSup.country.trim().length > PLACE_MAX;

  function handleAddSupplier() {
    if (!newSup.name.trim() || !newSup.city.trim() || !newSup.country.trim() || newSupOver) return;
    const s = addSupplier({
      ...sanitizeSupplier({ name: newSup.name, city: newSup.city, country: newSup.country }),
      walletAddress: newSup.walletAddress.trim() || undefined,
    });
    setSupplierId(s.id);
    setNewSup({ name: "", city: "", country: "", walletAddress: "" });
    setAddingSupplier(false);
  }

  function handleSend() {
    if (!canSend) return;
    const c = sendPayment({ supplierId, goods: cleanText(goods, GOODS_MAX), amountAed, mode });
    if (c) {
      onClose();
      router.push("/corridor");
    }
  }

  return (
    <div>
      <div className="px-6 pt-5">
        <FaucetCard walletAddress={walletAddress} />
      </div>

      {/* counterparties */}
      <div className="border-b border-line px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <Party
            label="From"
            name={business?.name ?? "Your business"}
            sub={`${business?.city ?? ""}${business?.city ? ", " : ""}${business?.country ?? ""}`}
          />
          <Arrow />
          <div className="flex items-center gap-3">
            {!addingSupplier && selectedSupplier && <Avatar name={selectedSupplier.name} size={36} />}
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-ink-faint">To</p>
              {addingSupplier ? (
                <p className="mt-0.5 text-sm text-ink-3">New supplier</p>
              ) : (
                <select
                  value={supplierId}
                  onChange={(e) => {
                    if (e.target.value === "__add") setAddingSupplier(true);
                    else setSupplierId(e.target.value);
                  }}
                  className="mt-0.5 rounded-[var(--radius-sm)] border border-line bg-surface px-2 py-1 text-right text-sm font-medium text-ink outline-none focus:border-teal"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} · {s.city}
                    </option>
                  ))}
                  <option value="__add">+ Add supplier…</option>
                </select>
              )}
            </div>
          </div>
        </div>

        {addingSupplier && (
          <div className="mt-4 rounded-[var(--radius-sm)] border border-line bg-surface-sunk p-4">
            <div className="grid gap-2 sm:grid-cols-3">
              <input
                placeholder="Supplier name"
                value={newSup.name}
                maxLength={NAME_MAX}
                onChange={(e) => setNewSup({ ...newSup, name: e.target.value })}
                className="rounded-[var(--radius-sm)] border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-teal sm:col-span-3"
              />
              <input
                placeholder="City"
                value={newSup.city}
                maxLength={PLACE_MAX}
                onChange={(e) => setNewSup({ ...newSup, city: e.target.value })}
                className="rounded-[var(--radius-sm)] border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-teal"
              />
              <input
                placeholder="Country"
                value={newSup.country}
                maxLength={PLACE_MAX}
                onChange={(e) => setNewSup({ ...newSup, country: e.target.value })}
                className="rounded-[var(--radius-sm)] border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-teal"
              />
              <input
                placeholder="Wallet address 0x… (where USDC settles)"
                value={newSup.walletAddress}
                onChange={(e) => setNewSup({ ...newSup, walletAddress: e.target.value })}
                className="col-span-2 rounded-[var(--radius-sm)] border border-line bg-surface px-3 py-2 font-mono text-sm outline-none focus:border-teal"
              />
              <button
                onClick={handleAddSupplier}
                disabled={newSupOver}
                className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper disabled:cursor-not-allowed disabled:opacity-40"
              >
                Save supplier
              </button>
            </div>
            {newSupOver && (
              <p className="mt-2 text-xs text-danger">Name under {NAME_MAX} characters, city and country under {PLACE_MAX}.</p>
            )}
            {suppliers.length > 0 && (
              <button
                onClick={() => setAddingSupplier(false)}
                className="mt-2 text-xs text-ink-faint hover:text-ink-3"
              >
                Cancel
              </button>
            )}
          </div>
        )}
      </div>

      {/* goods + amount */}
      <div className="border-b border-line px-6 py-7">
        <label className="block">
          <span className="text-sm text-ink-3">What are you paying for?</span>
          <input
            name="goods"
            value={goods}
            maxLength={GOODS_MAX}
            onChange={(e) => setGoods(e.target.value)}
            placeholder="e.g. Auto components, 2 x 40ft"
            className="mt-1.5 w-full rounded-[var(--radius-sm)] border border-line bg-surface px-3.5 py-2.5 text-ink outline-none placeholder:text-ink-faint focus:border-teal focus:ring-1 focus:ring-teal"
          />
          {goodsOver && (
            <span className="mt-1 block text-xs text-danger">Keep this under {GOODS_MAX} characters.</span>
          )}
        </label>

        <label className="mt-5 block">
          <span className="text-sm text-ink-3">Amount (AED)</span>
          <div className="mt-1.5 flex items-baseline gap-2 rounded-[var(--radius-sm)] border border-line bg-surface px-3.5 py-2 focus-within:border-teal focus-within:ring-1 focus-within:ring-teal">
            <span className="font-display text-2xl text-ink-faint">AED</span>
            <input
              inputMode="decimal"
              name="amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="412,000"
              className="tnum w-full bg-transparent font-display text-3xl tracking-tight outline-none placeholder:text-ink-faint"
            />
          </div>
        </label>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
          <span className="tnum font-mono text-teal-deep">{usdcLabel(amountUsdc)}</span>
          <span className="text-ink-faint">· peg {AED_PER_USD.toFixed(4)} AED/USD</span>
          <ChainBadge />
        </div>
        {overBalance && usdcBalance !== null && (
          <p className="tnum mt-2 text-sm text-danger">
            Amount exceeds your USDC balance ({usdcBalance.toLocaleString()} available)
          </p>
        )}
      </div>

      {/* mode */}
      <div className="px-6 py-6">
        <p className="mb-3 text-sm font-medium text-ink-2">Settlement</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <ModeCard
            active={mode === "open"}
            onClick={() => setMode("open")}
            title="Open settlement"
            desc="Pay now. Funds reach the supplier in minutes."
          />
          <ModeCard
            active={mode === "prooflock"}
            onClick={() => setMode("prooflock")}
            title="Proof-Lock"
            desc="Escrow on-chain. Releases automatically when shipment proof is attested."
            badge="Conditional"
          />
        </div>
      </div>

      <div className="sticky bottom-0 flex items-center justify-between gap-4 border-t border-line bg-surface-sunk px-6 py-4">
        <p className="max-w-xs text-xs text-ink-3">
          {mode === "prooflock"
            ? "Funds lock in a Polygon escrow and release the moment the bill of lading is attested."
            : "A single on-chain transfer settles directly to the supplier."}
        </p>
        <motion.button
          {...press}
          onClick={handleSend}
          disabled={!canSend}
          className="shrink-0 rounded-full bg-teal px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-deep disabled:cursor-not-allowed disabled:opacity-40"
        >
          {mode === "prooflock" ? "Lock & send" : "Send payment"}
        </motion.button>
      </div>
    </div>
  );
}

function Party({ label, name, sub }: { label: string; name: string; sub: string }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar name={name} size={36} />
      <div>
        <p className="text-xs uppercase tracking-wide text-ink-faint">{label}</p>
        <p className="mt-0.5 font-medium">{name}</p>
        <p className="text-sm text-ink-3">{sub}</p>
      </div>
    </div>
  );
}

function Arrow() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-ink-faint" fill="none">
      <path d="M4 12h15m0 0-5-5m5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ModeCard({
  active,
  onClick,
  title,
  desc,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  desc: string;
  badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-[var(--radius-card)] border px-4 py-4 text-left transition-all ${
        active ? "border-teal bg-teal-tint/60 ring-1 ring-teal" : "border-line bg-surface hover:border-line-strong"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="font-medium">{title}</span>
        {badge && (
          <span className="rounded-full bg-brass-tint px-2 py-0.5 text-[11px] font-medium text-brass-deep">{badge}</span>
        )}
      </div>
      <p className="mt-1 text-sm text-ink-3">{desc}</p>
    </button>
  );
}
