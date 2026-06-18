import { NextRequest, NextResponse } from "next/server";
import type { Hex } from "viem";
import { getChainConfig } from "@/lib/chain";
import { indexCorridors } from "@/lib/indexer";

export const runtime = "nodejs";

/*
 * Chain-derived corridor feed. Lets the financier read a borrower's corridors
 * from escrow events (cross-machine), independent of the importer's browser
 * storage. Sim fallback (empty) when the chain isn't wired.
 */
export async function GET(req: NextRequest) {
  const payer = req.nextUrl.searchParams.get("payer");

  const cfg = getChainConfig();
  if (!cfg) {
    return NextResponse.json({ mode: "sim", corridors: [] });
  }

  try {
    const corridors = await indexCorridors(cfg, payer ? (payer as Hex) : undefined);
    return NextResponse.json({ mode: "chain", corridors });
  } catch (err) {
    console.error("corridors index failed", err);
    return NextResponse.json({
      mode: "sim",
      corridors: [],
      error: err instanceof Error ? err.message : "chain error",
    });
  }
}
