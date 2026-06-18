import { NextRequest, NextResponse } from "next/server";
import type { Hex } from "viem";
import { getChainConfig } from "@/lib/chain";
import { createShipmentAttestation, easConfigured } from "@/lib/eas";

export const runtime = "nodejs";

function synthUid(): string {
  const hex = "0123456789abcdef";
  let h = "0x";
  for (let i = 0; i < 12; i++) h += hex[Math.floor(Math.random() * 16)];
  h += "…";
  for (let i = 0; i < 6; i++) h += hex[Math.floor(Math.random() * 16)];
  return h;
}

/*
 * Create a shipment-proof attestation for a corridor. The trusted inspector
 * signs it on-chain; the returned uid is then passed to the release action.
 * Sim fallback (synthetic uid) when EAS isn't wired so the demo flow holds.
 */
export async function POST(req: NextRequest) {
  let body: { ref?: string; supplier?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const { ref, supplier } = body;
  if (!ref) {
    return NextResponse.json({ error: "missing ref" }, { status: 400 });
  }

  const cfg = getChainConfig();
  if (!cfg || !easConfigured(cfg)) {
    return NextResponse.json({ mode: "sim", uid: synthUid(), txHash: null, explorerUrl: null });
  }

  try {
    const recipient = (supplier as Hex) ?? cfg.supplier;
    const result = await createShipmentAttestation(cfg, ref, recipient);
    return NextResponse.json({ mode: "chain", ...result });
  } catch (err) {
    console.error("attest failed", err);
    return NextResponse.json({
      mode: "sim",
      uid: synthUid(),
      txHash: null,
      explorerUrl: null,
      error: err instanceof Error ? err.message : "attest error",
    });
  }
}
