"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { useCorridor } from "@/components/CorridorProvider";
import type { Supplier } from "@/lib/account";
import { press } from "@/lib/motion";

/** Add a counterparty. Used in the Suppliers modal and inside the Send flow. */
export function AddSupplierForm({ onDone }: { onDone: (s?: Supplier) => void }) {
  const { addSupplier } = useCorridor();
  const [form, setForm] = useState({ name: "", city: "", country: "", walletAddress: "" });
  const valid = form.name.trim() && form.city.trim() && form.country.trim();

  function save() {
    if (!valid) return;
    const s = addSupplier({
      name: form.name,
      city: form.city,
      country: form.country,
      walletAddress: form.walletAddress.trim() || undefined,
    });
    onDone(s);
  }

  return (
    <div className="p-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          autoFocus
          placeholder="Supplier name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="rounded-[var(--radius-sm)] border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-teal focus:ring-1 focus:ring-teal sm:col-span-2"
        />
        <input
          placeholder="City"
          value={form.city}
          onChange={(e) => setForm({ ...form, city: e.target.value })}
          className="rounded-[var(--radius-sm)] border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-teal focus:ring-1 focus:ring-teal"
        />
        <input
          placeholder="Country"
          value={form.country}
          onChange={(e) => setForm({ ...form, country: e.target.value })}
          className="rounded-[var(--radius-sm)] border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-teal focus:ring-1 focus:ring-teal"
        />
        <input
          placeholder="Wallet address 0x… (where USDC settles)"
          value={form.walletAddress}
          onChange={(e) => setForm({ ...form, walletAddress: e.target.value })}
          className="rounded-[var(--radius-sm)] border border-line bg-surface px-3 py-2.5 font-mono text-sm outline-none focus:border-teal focus:ring-1 focus:ring-teal sm:col-span-2"
        />
      </div>
      <div className="mt-4 flex items-center justify-end gap-2">
        <button onClick={() => onDone()} className="rounded-full px-4 py-2 text-sm text-ink-3 hover:text-ink">
          Cancel
        </button>
        <motion.button
          {...press}
          onClick={save}
          disabled={!valid}
          className="rounded-full bg-teal px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-deep disabled:opacity-40"
        >
          Save supplier
        </motion.button>
      </div>
    </div>
  );
}
