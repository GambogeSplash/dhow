"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useFinancierOverlays } from "@/components/financier-overlays";

/*
 * The deal review is a drawer, not a destination. This route survives as a deep
 * link: it opens the review drawer for the borrower and lands on the Requests
 * desk behind it, so a shared /deal/<borrower> URL still works.
 */
export default function DealPage() {
  const params = useParams<{ business: string }>();
  const router = useRouter();
  const { openDeal } = useFinancierOverlays();

  useEffect(() => {
    if (params.business) openDeal(params.business);
    router.replace("/requests");
  }, [params.business, openDeal, router]);

  return (
    <div className="py-16 text-center">
      <p className="text-sm text-ink-faint">Opening the deal…</p>
    </div>
  );
}
