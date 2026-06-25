"use client";

import Link from "next/link";
import { useState } from "react";
import { useCorridor } from "@/components/CorridorProvider";
import { Avatar } from "@/components/Avatar";
import { aed } from "@/lib/corridor";

export default function SuppliersPage() {
  const { suppliers, corridors, addSupplier } = useCorridor();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", city: "", country: "" });

  function save() {
    if (!form.name.trim() || !form.city.trim() || !form.country.trim()) return;
    addSupplier(form);
    setForm({ name: "", city: "", country: "" });
    setAdding(false);
  }

  function totalTo(supplierId: string): number {
    return corridors
      .filter((c) => c.supplier.id === supplierId && c.status === "settled")
      .reduce((s, c) => s + c.amountAed, 0);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-3">Suppliers</p>
          <h1 className="font-display mt-1 text-3xl tracking-tight">Your suppliers</h1>
          <p className="mt-2 max-w-lg text-ink-2">
            The counterparties you pay. Add them once, then settle in a couple of
            clicks.
          </p>
        </div>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-ink-2"
          >
            Add supplier
          </button>
        )}
      </div>

      {adding && (
        <div className="mt-6 rounded-[var(--radius-card)] border border-line bg-surface p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              name="name"
              autoFocus
              placeholder="Supplier name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="rounded-[var(--radius-sm)] border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-teal focus:ring-1 focus:ring-teal sm:col-span-3"
            />
            <input
              name="city"
              placeholder="City"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              className="rounded-[var(--radius-sm)] border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-teal focus:ring-1 focus:ring-teal"
            />
            <input
              name="country"
              placeholder="Country"
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
              className="rounded-[var(--radius-sm)] border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-teal focus:ring-1 focus:ring-teal"
            />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={save}
              className="rounded-full bg-teal px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-deep"
            >
              Save supplier
            </button>
            <button
              onClick={() => setAdding(false)}
              className="text-sm text-ink-faint hover:text-ink-3"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {suppliers.length === 0 && !adding ? (
          <div className="rounded-[var(--radius-card)] border border-dashed border-line-strong bg-surface p-8 text-center">
            <p className="font-medium">No suppliers yet</p>
            <p className="mx-auto mt-1 max-w-xs text-sm text-ink-3">
              Add your first supplier to start paying.
            </p>
            <button
              onClick={() => setAdding(true)}
              className="mt-5 rounded-full bg-teal px-5 py-2.5 text-sm font-medium text-white"
            >
              Add supplier
            </button>
          </div>
        ) : (
          suppliers.map((s) => {
            const total = totalTo(s.id);
            return (
              <div
                key={s.id}
                className="flex items-center justify-between gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-4"
              >
                <div className="flex items-center gap-3">
                  <Avatar name={s.name} size={36} />
                  <div>
                    <p className="font-medium">{s.name}</p>
                    <p className="text-sm text-ink-3">
                      {s.city}, {s.country}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="tnum text-sm font-medium">{aed(total)}</p>
                    <p className="text-xs text-ink-faint">settled to date</p>
                  </div>
                  <Link
                    href="/send"
                    className="rounded-full border border-line px-3.5 py-1.5 text-sm text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
                  >
                    Pay
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
