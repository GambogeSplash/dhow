"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { Modal } from "@/components/Modal";
import { SendPaymentForm } from "@/components/SendPaymentForm";
import { AddSupplierForm } from "@/components/AddSupplierForm";

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
  close: () => void;
}

const Ctx = createContext<Overlays | null>(null);

export function OverlayProvider({ children }: { children: React.ReactNode }) {
  const [send, setSend] = useState<{ open: boolean; supplierId?: string }>({ open: false });
  const [addSupplier, setAddSupplier] = useState(false);

  const openSend = useCallback((supplierId?: string) => setSend({ open: true, supplierId }), []);
  const openAddSupplier = useCallback(() => setAddSupplier(true), []);
  const close = useCallback(() => {
    setSend({ open: false });
    setAddSupplier(false);
  }, []);

  return (
    <Ctx.Provider value={{ openSend, openAddSupplier, close }}>
      {children}

      <Modal open={send.open} onClose={() => setSend({ open: false })} title="Pay a supplier" maxWidth="max-w-2xl">
        {send.open && (
          <SendPaymentForm initialSupplierId={send.supplierId} onClose={() => setSend({ open: false })} />
        )}
      </Modal>

      <Modal open={addSupplier} onClose={() => setAddSupplier(false)} title="Add supplier">
        {addSupplier && <AddSupplierForm onDone={() => setAddSupplier(false)} />}
      </Modal>
    </Ctx.Provider>
  );
}

export function useOverlays(): Overlays {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useOverlays must be used within OverlayProvider");
  return ctx;
}
