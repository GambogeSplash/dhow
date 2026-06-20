"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCorridor } from "@/components/CorridorProvider";
import { FaucetCard } from "@/components/FaucetCard";
import {
  aed,
  AED_PER_USD,
  makeCorridorUsdc,
  SettlementMode,
  usdcLabel,
} from "@/lib/corridor";

export default function SendPage() {
  const router = useRouter();
  const { business, suppliers, addSupplier, sendPayment, walletAddress } = useCorridor();

  const [supplierId, setSupplierId] = useState<string>(suppliers[0]?.id ?? "");
  const [goods, setGoods] = useState("");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<SettlementMode>("prooflock");
  const [addingSupplier, setAddingSupplier] = useState(suppliers.length === 0);
  const [newSup, setNewSup] = useState({ name: "", city: "", country: "", walletAddress: "" });

  const amountAed = Number(amount.replace(/[^0-9.]/g, "")) || 0;
  const amountUsdc = amountAed > 0 ? makeCorridorUsdc(amountAed) : 0;
  const canSend = !!supplierId && amountAed > 0 && goods.trim().length > 0;

  function handleAddSupplier() {
    if (!newSup.name.trim() || !newSup.city.trim() || !newSup.country.trim()) return;
    const s = addSupplier({
      name: newSup.name,
      city: newSup.city,
      country: newSup.country,
      walletAddress: newSup.walletAddress.trim() || undefined,
    });
    setSupplierId(s.id);
    setNewSup({ name: "", city: "", country: "", walletAddress: "" });
    setAddingSupplier(false);
  }

  function handleSend() {
    const c = sendPayment({ supplierId, goods, amountAed, mode });
    if (c) router.push("/corridor");
  }

  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-sm text-ink-3">New payment</p>
      <h1 className="font-display mt-1 text-3xl tracking-tight">Pay your supplier</h1>
      <p className="mt-2 max-w-lg text-ink-2">
        Settle cross-border in stablecoin on Polygon. Minutes, not days. The
        record writes itself.
      </p>

      <div className="mt-6">
        <FaucetCard walletAddress={walletAddress} />
      </div>

      <div className="mt-6 overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
        {/* counterparties */}
        <div className="border-b border-line px-6 py-5">
          <div className="flex items-center justify-between gap-4">
            <Party label="From" name={business?.name ?? "Your business"} sub={`${business?.city ?? ""}${business?.city ? ", " : ""}${business?.country ?? ""}`} />
            <Arrow />
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

          {addingSupplier && (
            <div className="mt-4 rounded-[var(--radius-sm)] border border-line bg-surface-sunk p-4">
              <div className="grid gap-2 sm:grid-cols-3">
                <input
                  placeholder="Supplier name"
                  value={newSup.name}
                  onChange={(e) => setNewSup({ ...newSup, name: e.target.value })}
                  className="rounded-[var(--radius-sm)] border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-teal sm:col-span-3"
                />
                <input
                  placeholder="City"
                  value={newSup.city}
                  onChange={(e) => setNewSup({ ...newSup, city: e.target.value })}
                  className="rounded-[var(--radius-sm)] border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-teal"
                />
                <input
                  placeholder="Country"
                  value={newSup.country}
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
                  className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper"
                >
                  Save supplier
                </button>
              </div>
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
              onChange={(e) => setGoods(e.target.value)}
              placeholder="e.g. Auto components, 2 × 40ft"
              className="mt-1.5 w-full rounded-[var(--radius-sm)] border border-line bg-surface px-3.5 py-2.5 text-ink outline-none placeholder:text-ink-faint focus:border-teal focus:ring-1 focus:ring-teal"
            />
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
          <div className="mt-2 flex items-center gap-2 text-sm">
            <span className="tnum font-mono text-teal-deep">{usdcLabel(amountUsdc)}</span>
            <span className="text-ink-faint">
              · settles in USDC at peg {AED_PER_USD.toFixed(4)} AED/USD
            </span>
          </div>
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

        <div className="flex items-center justify-between gap-4 border-t border-line bg-surface-sunk px-6 py-4">
          <p className="max-w-xs text-xs text-ink-3">
            {mode === "prooflock"
              ? "Funds lock in a Polygon escrow and release to the supplier the moment the bill of lading is attested."
              : "A single on-chain transfer settles directly to the supplier."}
          </p>
          <button
            onClick={handleSend}
            disabled={!canSend}
            className="shrink-0 rounded-full bg-teal px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-deep disabled:cursor-not-allowed disabled:opacity-40"
          >
            {mode === "prooflock" ? "Lock & send" : "Send payment"}
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Compare tone="muted" head="Correspondent banking" big="3–5 days" sub=">3% on a quarter of corridors, opaque FX" />
        <Compare tone="teal" head="On Dhow" big="Minutes" sub="~$0.002 settlement on Polygon, FX shown up front" />
      </div>

      <p className="mt-6 text-center text-sm text-ink-faint">
        <Link href="/corridor" className="underline underline-offset-2 hover:text-ink-3">
          View your Cashflow Record
        </Link>
      </p>
    </div>
  );
}

function Party({ label, name, sub }: { label: string; name: string; sub: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-ink-faint">{label}</p>
      <p className="mt-0.5 font-medium">{name}</p>
      <p className="text-sm text-ink-3">{sub}</p>
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
        active
          ? "border-teal bg-teal-tint/60 ring-1 ring-teal"
          : "border-line bg-surface hover:border-line-strong"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="font-medium">{title}</span>
        {badge && (
          <span className="rounded-full bg-brass-tint px-2 py-0.5 text-[11px] font-medium text-brass-deep">
            {badge}
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-ink-3">{desc}</p>
    </button>
  );
}

function Compare({
  tone,
  head,
  big,
  sub,
}: {
  tone: "muted" | "teal";
  head: string;
  big: string;
  sub: string;
}) {
  return (
    <div
      className={`rounded-[var(--radius-card)] border px-5 py-4 ${
        tone === "teal" ? "border-teal/30 bg-teal-tint/50" : "border-line bg-surface"
      }`}
    >
      <p className="text-xs uppercase tracking-wide text-ink-faint">{head}</p>
      <p className={`font-display mt-1 text-2xl ${tone === "teal" ? "text-teal-deep" : "text-ink"}`}>
        {big}
      </p>
      <p className="mt-0.5 text-sm text-ink-3">{sub}</p>
    </div>
  );
}
