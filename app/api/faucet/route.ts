import { NextRequest, NextResponse } from "next/server";
import type { Hex } from "viem";
import { getChainConfig, fundTestWallet } from "@/lib/chain";
import { getUserId, privyConfigured } from "@/lib/privy-server";

export const runtime = "nodejs";

/*
 * Testnet faucet. The operator sponsors the authenticated user's embedded
 * wallet with gas (POL) + test USDC so a brand-new user can immediately make a
 * real on-chain settlement. Authenticated so only signed-in users can tap it.
 */
export async function POST(req: NextRequest) {
  if (!privyConfigured()) {
    return NextResponse.json({ error: "auth not configured" }, { status: 503 });
  }
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let body: { address?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const address = body.address?.trim();
  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return NextResponse.json({ error: "missing/invalid address" }, { status: 400 });
  }

  const cfg = getChainConfig();
  if (!cfg) {
    return NextResponse.json({ error: "chain not configured" }, { status: 503 });
  }

  try {
    const result = await fundTestWallet(cfg, address as Hex);
    return NextResponse.json({
      ...result,
      explorerUrl: `${cfg.explorerBase}${result.usdcTx}`,
    });
  } catch (err) {
    console.error("faucet failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "faucet error" },
      { status: 502 },
    );
  }
}
