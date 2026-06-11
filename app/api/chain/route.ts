import { NextRequest, NextResponse } from "next/server";
import {
  ChainAction,
  getChainConfig,
  runChainAction,
} from "@/lib/chain";

export const runtime = "nodejs";

function synthHash(): string {
  const hex = "0123456789abcdef";
  let h = "0x";
  for (let i = 0; i < 6; i++) h += hex[Math.floor(Math.random() * 16)];
  h += "…";
  for (let i = 0; i < 4; i++) h += hex[Math.floor(Math.random() * 16)];
  return h;
}

export async function POST(req: NextRequest) {
  let body: { action?: ChainAction; ref?: string; amountUsdc?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const { action, ref, amountUsdc } = body;
  if (!action || !ref) {
    return NextResponse.json({ error: "missing action/ref" }, { status: 400 });
  }

  const cfg = getChainConfig();

  // Not wired → simulated hash, identical demo flow.
  if (!cfg) {
    return NextResponse.json({
      mode: "sim",
      txHash: synthHash(),
      explorerUrl: null,
    });
  }

  try {
    const txHash = await runChainAction(cfg, action, ref, amountUsdc ?? 0);
    return NextResponse.json({
      mode: "chain",
      txHash,
      explorerUrl: `${cfg.explorerBase}${txHash}`,
    });
  } catch (err) {
    // Fail soft: keep the demo moving even if the RPC hiccups.
    console.error("chain action failed", err);
    return NextResponse.json({
      mode: "sim",
      txHash: synthHash(),
      explorerUrl: null,
      error: err instanceof Error ? err.message : "chain error",
    });
  }
}
