import { NextRequest, NextResponse } from "next/server";
import type { Hex } from "viem";
import { getChainConfig, postScoreOnChain, readScoreOnChain } from "@/lib/chain";

export const runtime = "nodejs";

/*
 * Chain-derived read API. The financier polls this for a business's verified
 * on-chain Credit Score: they underwrite the cashflow they can see on-chain,
 * not an attestation they have to trust. Falls back to mode "sim" when the
 * chain (or registry) isn't wired, so the two-screen demo still runs.
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

/*
 * Post a freshly computed Credit Score for a business to the on-chain
 * registry after a settlement. The score is computed by the pure engine
 * (lib/corridor) on the client that holds the corridor history; this records
 * it on-chain so the financier reads a verifiable number.
 */
export async function POST(req: NextRequest) {
  let body: { business?: string; score?: number; attestationUid?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const { business, score, attestationUid } = body;
  if (!business || typeof score !== "number") {
    return NextResponse.json({ error: "missing business/score" }, { status: 400 });
  }

  const cfg = getChainConfig();
  if (!cfg || !cfg.registry) {
    return NextResponse.json({ mode: "sim", txHash: null, explorerUrl: null });
  }

  try {
    const uid = (attestationUid as Hex) ?? ("0x" + "0".repeat(64));
    const txHash = await postScoreOnChain(cfg, business as Hex, Math.round(score), uid as Hex);
    return NextResponse.json({
      mode: "chain",
      txHash,
      explorerUrl: txHash ? `${cfg.explorerBase}${txHash}` : null,
    });
  } catch (err) {
    console.error("score post failed", err);
    return NextResponse.json({
      mode: "sim",
      txHash: null,
      explorerUrl: null,
      error: err instanceof Error ? err.message : "chain error",
    });
  }
}
