"use client";

import { motion } from "motion/react";
import { useCredit } from "@/components/CreditProvider";
import { Avatar } from "@/components/Avatar";
import { aed, usdcLabel } from "@/lib/credit";
import { press } from "@/lib/motion";

const INSPECTOR = "Gulf Inspectorate";

/*
 * The Proof-Lock release flow, made legible. A release is not a buyer's whim: a
 * trusted inspector attests the shipment proof on-chain (EAS), and that
 * attestation is the authorization for the escrow to release. This confirms what
 * is being attested, who attests it, and where the money goes before it moves.
 */
export function AttestProofForm({ paymentId, onClose }: { paymentId: string; onClose: () => void }) {
  const { payments, attest } = useCredit();
  const c = payments.find((x) => x.id === paymentId);
  if (!c) return <div className="p-6 text-sm text-ink-3">This payment is no longer open.</div>;

  return (
    <div className="p-6">
      {/* what's being released */}
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

      {/* the proof + attester */}
      <dl className="mt-4 divide-y divide-line">
        <Row k="Shipment proof" v={c.proof?.label ?? "Bill of lading"} />
        <Row k="Attested by" v={INSPECTOR} />
        <Row k="Releases to" v={`${c.supplier.name} · ${c.supplier.city}`} />
      </dl>

      <p className="mt-4 rounded-[var(--radius-card)] bg-teal-tint/50 px-4 py-3 text-sm text-ink-2">
        {INSPECTOR} attests the bill of lading on-chain. That attestation is the authorization, so the
        escrowed {aed(c.amountAed)} releases to {c.supplier.name}. Dhow never releases on its own.
      </p>

      <div className="mt-5 flex items-center justify-end gap-2">
        <button onClick={onClose} className="rounded-full px-4 py-2 text-sm text-ink-3 hover:text-ink">
          Not yet
        </button>
        <motion.button
          {...press}
          onClick={() => {
            attest(paymentId);
            onClose();
          }}
          className="rounded-full bg-teal px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-deep"
        >
          Attest &amp; release {aed(c.amountAed)} →
        </motion.button>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 text-sm">
      <dt className="text-ink-3">{k}</dt>
      <dd className="font-medium text-ink">{v}</dd>
    </div>
  );
}
