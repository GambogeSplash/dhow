import { NextRequest, NextResponse } from "next/server";
import type { Hex } from "viem";
import { getChainConfig } from "@/lib/chain";
import { createShipmentAttestation, easConfigured } from "@/lib/eas";

export const runtime = "nodejs";

/*
 * Create a shipment-proof attestation for a payment. The trusted inspector
 * signs it on-chain (server-side operator key); the returned uid is then passed
 * to the user-signed release. Errors clearly when EAS isn't configured — no
 * fabricated attestations.
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
    return NextResponse.json(
      { error: "attestation service not configured (set DHOW_EAS_ADDRESS / DHOW_SHIPMENT_SCHEMA)" },
      { status: 503 },
    );
  }

  try {
    const recipient = (supplier as Hex) ?? cfg.supplier;
    const result = await createShipmentAttestation(cfg, ref, recipient);
    return NextResponse.json(result);
  } catch (err) {
    console.error("attest failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "attest error" },
      { status: 502 },
    );
  }
}
