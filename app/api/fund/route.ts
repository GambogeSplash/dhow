import { NextRequest, NextResponse } from "next/server";
import type { Hex } from "viem";
import { getChainConfig, transferUsdc } from "@/lib/chain";

export const runtime = "nodejs";

function synthHash(): string {
  const hex = "0123456789abcdef";
  let h = "0x";
  for (let i = 0; i < 6; i++) h += hex[Math.floor(Math.random() * 16)];
  h += "…";
  for (let i = 0; i < 4; i++) h += hex[Math.floor(Math.random() * 16)];
  return h;
}

/*
 * Financier funding. A real USDC transfer from the Dhow burner to the SME's
 * wallet when the chain is wired; a simulated hash otherwise so the two-screen
 * demo always completes the loop.
 */
export async function POST(req: NextRequest) {
  let body: { business?: string; amountUsdc?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const { business, amountUsdc } = body;
  if (!business || !amountUsdc) {
    return NextResponse.json({ error: "missing business/amountUsdc" }, { status: 400 });
  }

  const cfg = getChainConfig();
  if (!cfg) {
    return NextResponse.json({ mode: "sim", txHash: synthHash(), explorerUrl: null });
  }

  try {
    const txHash = await transferUsdc(cfg, business as Hex, amountUsdc);
    return NextResponse.json({ mode: "chain", txHash, explorerUrl: `${cfg.explorerBase}${txHash}` });
  } catch (err) {
    console.error("fund failed", err);
    return NextResponse.json({
      mode: "sim",
      txHash: synthHash(),
      explorerUrl: null,
      error: err instanceof Error ? err.message : "chain error",
    });
  }
}
