import { NextRequest, NextResponse } from "next/server";
import type { Hex } from "viem";
import { getChainConfig, fundTestWallet } from "@/lib/chain";
import { getUserId, privyConfigured } from "@/lib/privy-server";

export const runtime = "nodejs";

/*
 * In-memory rate limit. One successful tap per (userId, address) every
 * FAUCET_WINDOW_MS. Lives in module scope so it persists across requests in a
 * single server instance (best-effort; not durable across deploys/instances).
 */
const FAUCET_WINDOW_MS = 60_000;
const lastTap = new Map<string, number>();

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

  const key = `${userId}:${address.toLowerCase()}`;
  const last = lastTap.get(key);
  if (last !== undefined) {
    const elapsed = Date.now() - last;
    if (elapsed < FAUCET_WINDOW_MS) {
      const secs = Math.ceil((FAUCET_WINDOW_MS - elapsed) / 1000);
      return NextResponse.json(
        { error: `Faucet was used recently. Try again in ${secs}s.` },
        { status: 429 },
      );
    }
  }

  try {
    const result = await fundTestWallet(cfg, address as Hex);
    lastTap.set(key, Date.now());
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
