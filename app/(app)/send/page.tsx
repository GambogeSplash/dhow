"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useOverlays } from "@/components/overlays";

/*
 * Send is a modal, not a destination. This route survives as a deep link: it
 * opens the payment composer over the dashboard and lands the user on Overview
 * behind it, so a shared /send URL still does the right thing.
 */
export default function SendPage() {
  const router = useRouter();
  const { openSend } = useOverlays();

  useEffect(() => {
    openSend();
    router.replace("/overview");
  }, [openSend, router]);

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-10">
      <p className="text-sm text-ink-faint">Opening the payment composer…</p>
    </main>
  );
}
