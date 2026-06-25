"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { Drawer } from "@/components/Modal";
import { DealReview } from "@/components/DealReview";

/*
 * Financier overlay manager. A borrower's deal is reviewed in a slide-over
 * drawer opened from any list (Desk / Opportunities / Requests) so the list
 * stays behind it. Mounted once in the financier layout; the /deal/[business]
 * route deep-links by opening it on mount.
 */
interface FinancierOverlays {
  openDeal: (borrowerId: string) => void;
  close: () => void;
}

const Ctx = createContext<FinancierOverlays | null>(null);

export function FinancierOverlayProvider({ children }: { children: React.ReactNode }) {
  const [borrowerId, setBorrowerId] = useState<string | null>(null);

  const openDeal = useCallback((id: string) => setBorrowerId(id), []);
  const close = useCallback(() => setBorrowerId(null), []);

  return (
    <Ctx.Provider value={{ openDeal, close }}>
      {children}
      <Drawer open={!!borrowerId} onClose={close} title="Deal review">
        {borrowerId && <DealReview borrowerId={borrowerId} onClose={close} />}
      </Drawer>
    </Ctx.Provider>
  );
}

export function useFinancierOverlays(): FinancierOverlays {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useFinancierOverlays must be used within FinancierOverlayProvider");
  return ctx;
}
