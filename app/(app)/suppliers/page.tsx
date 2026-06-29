"use client";

import { motion } from "motion/react";
import { useCorridor } from "@/components/CorridorProvider";
import { useOverlays } from "@/components/overlays";
import { Avatar } from "@/components/Avatar";
import { aed } from "@/lib/credit";
import { stagger, riseItem } from "@/lib/motion";

export default function SuppliersPage() {
  const { suppliers, corridors } = useCorridor();
  const { openAddSupplier, openSend } = useOverlays();

  function totalTo(supplierId: string): number {
    return corridors
      .filter((c) => c.supplier.id === supplierId && c.status === "settled")
      .reduce((s, c) => s + c.amountAed, 0);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display mt-1 text-3xl tracking-tight">Your suppliers</h1>
          <p className="mt-2 max-w-lg text-ink-2">
            The counterparties you pay. Add them once, then settle in a couple of clicks.
          </p>
        </div>
        <button
          onClick={openAddSupplier}
          className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-ink-2"
        >
          Add supplier
        </button>
      </div>

      <div className="mt-6 space-y-3">
        {suppliers.length === 0 ? (
          <div className="rounded-[var(--radius-card)] border border-dashed border-line-strong bg-surface p-8 text-center">
            <p className="font-medium">No suppliers yet</p>
            <p className="mx-auto mt-1 max-w-xs text-sm text-ink-3">
              Add your first supplier to start paying.
            </p>
            <button
              onClick={openAddSupplier}
              className="mt-5 rounded-full bg-teal px-5 py-2.5 text-sm font-medium text-white"
            >
              Add supplier
            </button>
          </div>
        ) : (
          <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-3">
            {suppliers.map((s) => {
              const total = totalTo(s.id);
              return (
                <motion.div
                  key={s.id}
                  variants={riseItem}
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
                    <button
                      onClick={() => openSend(s.id)}
                      className="rounded-full border border-line px-3.5 py-1.5 text-sm text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
                    >
                      Pay
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>
    </div>
  );
}
