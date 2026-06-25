"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { useCorridor } from "@/components/CorridorProvider";
import { Avatar } from "@/components/Avatar";
import { aed, usdcLabel } from "@/lib/corridor";
import { press } from "@/lib/motion";

const REASONS = [
  "Goods not shipped by the agreed date",
  "Shipment proof never attested",
  "Quantity or quality dispute",
  "Order cancelled by agreement",
];

/*
 * Dispute & refund, made honest. A Proof-Lock holds the buyer's funds in escrow;
 * if the shipment proof is never attested, the buyer reclaims them. The contract
 * gates the refund on the deadline (it reverts early), so this is framed as a
 * claim, not a withdrawal, with a reason on the record and a clear note that it
 * lowers proof performance.
 */
export function RefundDisputeForm({ corridorId, onClose }: { corridorId: string; onClose: () => void }) {
  const { corridors, refund } = useCorridor();
  const c = corridors.find((x) => x.id === corridorId);
  const [reason, setReason] = useState(REASONS[0]);

  if (!c) return <div className="p-6 text-sm text-ink-3">This corridor is no longer open.</div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between rounded-[var(--radius-card)] bg-surface-sunk px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar name={c.supplier.name} size={38} />
          <div>
            <p className="font-medium">{c.supplier.name}</p>
            <p className="text-sm text-ink-3">
              {c.ref} · {c.goods}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-display tnum text-xl">{aed(c.amountAed)}</p>
          <p className="tnum font-mono text-xs text-ink-faint">{usdcLabel(c.amountUsdc)}</p>
        </div>
      </div>

      <label className="mt-4 block">
        <span className="text-xs uppercase tracking-wide text-ink-faint">Reason for the dispute</span>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="mt-1.5 w-full rounded-[var(--radius-sm)] border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-teal"
        >
          {REASONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>

      <p className="mt-4 rounded-[var(--radius-card)] bg-surface-sunk px-4 py-3 text-sm text-ink-2">
        The escrow returns {aed(c.amountAed)} to you because the shipment proof was not attested. On
        chain this is gated on the Proof-Lock deadline, so the funds can only be reclaimed once it
        passes. It marks {c.ref} refunded and lowers your proof performance, since the corridor
        resolved without a clean release.
      </p>

      <div className="mt-5 flex items-center justify-end gap-2">
        <button onClick={onClose} className="rounded-full px-4 py-2 text-sm text-ink-3 hover:text-ink">
          Keep it locked
        </button>
        <motion.button
          {...press}
          onClick={() => {
            refund(corridorId);
            onClose();
          }}
          className="rounded-full border border-danger/40 bg-danger-tint px-5 py-2.5 text-sm font-medium text-danger transition-colors hover:bg-danger-tint/70"
        >
          Refund {aed(c.amountAed)} to me
        </motion.button>
      </div>
    </div>
  );
}
