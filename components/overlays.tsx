"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { Modal } from "@/components/Modal";
import { SendPaymentForm } from "@/components/SendPaymentForm";
import { AddSupplierForm } from "@/components/AddSupplierForm";
import { AttestProofForm } from "@/components/AttestProofForm";
import { RefundDisputeForm } from "@/components/RefundDisputeForm";
import { AcceptOfferForm } from "@/components/AcceptOfferForm";
import { RequestCapitalForm } from "@/components/RequestCapitalForm";

/*
 * Importer overlay manager. Focused tasks (compose a payment, add a supplier)
 * are modals launched from anywhere, so the dashboard stays put behind them
 * instead of a full-page navigation. Mounted once in AppShell; any page calls
 * useOverlays() to open them. The /send and Suppliers routes still deep-link by
 * opening these on mount.
 */
interface Overlays {
  openSend: (supplierId?: string) => void;
  openAddSupplier: () => void;
  openAttest: (corridorId: string) => void;
  openRefund: (corridorId: string) => void;
  openAccept: (dealId: string) => void;
  openRequestCapital: () => void;
  close: () => void;
}

const Ctx = createContext<Overlays | null>(null);

export function OverlayProvider({ children }: { children: React.ReactNode }) {
  const [send, setSend] = useState<{ open: boolean; supplierId?: string }>({ open: false });
  const [addSupplier, setAddSupplier] = useState(false);
  const [attestId, setAttestId] = useState<string | null>(null);
  const [refundId, setRefundId] = useState<string | null>(null);
  const [acceptId, setAcceptId] = useState<string | null>(null);
  const [requestCapital, setRequestCapital] = useState(false);

  const openSend = useCallback((supplierId?: string) => setSend({ open: true, supplierId }), []);
  const openAddSupplier = useCallback(() => setAddSupplier(true), []);
  const openAttest = useCallback((corridorId: string) => setAttestId(corridorId), []);
  const openRefund = useCallback((corridorId: string) => setRefundId(corridorId), []);
  const openAccept = useCallback((dealId: string) => setAcceptId(dealId), []);
  const openRequestCapital = useCallback(() => setRequestCapital(true), []);
  const close = useCallback(() => {
    setSend({ open: false });
    setAddSupplier(false);
    setAttestId(null);
    setRefundId(null);
    setAcceptId(null);
    setRequestCapital(false);
  }, []);

  return (
    <Ctx.Provider value={{ openSend, openAddSupplier, openAttest, openRefund, openAccept, openRequestCapital, close }}>
      {children}

      <Modal open={send.open} onClose={() => setSend({ open: false })} title="Pay a supplier" maxWidth="max-w-2xl">
        {send.open && (
          <SendPaymentForm initialSupplierId={send.supplierId} onClose={() => setSend({ open: false })} />
        )}
      </Modal>

      <Modal open={addSupplier} onClose={() => setAddSupplier(false)} title="Add supplier">
        {addSupplier && <AddSupplierForm onDone={() => setAddSupplier(false)} />}
      </Modal>

      <Modal open={!!attestId} onClose={() => setAttestId(null)} title="Release against shipment proof">
        {attestId && <AttestProofForm corridorId={attestId} onClose={() => setAttestId(null)} />}
      </Modal>

      <Modal open={!!refundId} onClose={() => setRefundId(null)} title="Dispute & refund">
        {refundId && <RefundDisputeForm corridorId={refundId} onClose={() => setRefundId(null)} />}
      </Modal>

      <Modal open={!!acceptId} onClose={() => setAcceptId(null)} title="Accept this offer">
        {acceptId && <AcceptOfferForm dealId={acceptId} onClose={() => setAcceptId(null)} />}
      </Modal>

      <Modal open={requestCapital} onClose={() => setRequestCapital(false)} title="Request working capital">
        {requestCapital && <RequestCapitalForm onClose={() => setRequestCapital(false)} />}
      </Modal>
    </Ctx.Provider>
  );
}

export function useOverlays(): Overlays {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useOverlays must be used within OverlayProvider");
  return ctx;
}
