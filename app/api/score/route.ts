import { NextRequest, NextResponse } from "next/server";
import type { Hex } from "viem";
import { getChainConfig, readScoreOnChain } from "@/lib/chain";

export const runtime = "nodejs";

/*
 * Chain-derived read API (read-only). The financier polls this for a business's
 * verified on-chain Credit Score: they underwrite the cashflow they can see on
 * chain, not an attestation they have to trust. The score is RECORDED on-chain
 * by the escrow itself, atomically with each settlement — there is no write
 * endpoint and no privileged poster, so this number stays correct even if the
 * Dhow backend is down. Falls back to mode "sim" when the chain (or registry)
 * isn't wired, so the two-screen demo still runs.
 */
export async function GET(req: NextRequest) {
  const business = req.nextUrl.searchParams.get("business");
  if (!business) {
    return NextResponse.json({ error: "missing business" }, { status: 400 });
  }

  const cfg = getChainConfig();
  if (!cfg || !cfg.registry) {
    return NextResponse.json({ mode: "sim", business, score: null, eligible: null });
  }

  try {
    const result = await readScoreOnChain(cfg, business as Hex);
    return NextResponse.json({ mode: "chain", business, ...result });
  } catch (err) {
    console.error("score read failed", err);
    return NextResponse.json({
      mode: "sim",
      business,
      score: null,
      eligible: null,
      error: err instanceof Error ? err.message : "chain error",
    });
  }
}
