import { NextRequest, NextResponse } from "next/server";
import type { Hex } from "viem";
import { getChainConfig } from "@/lib/chain";
import { indexPayments } from "@/lib/indexer";
import { getUserId, privyConfigured } from "@/lib/privy-server";
import { dbConfigured } from "@/lib/db";
import { createPayment, updatePayment, type PaymentPatch } from "@/lib/store-server";
import type { SettlementMode, SettlementStatus, TxState } from "@/lib/credit";
import { cleanText, GOODS_MAX } from "@/lib/validate";

export const runtime = "nodejs";

/*
 * GET  — public chain-derived payment feed (by payer address) from escrow
 *        events, so a financier can read a borrower's payments cross-machine.
 * POST — create a payment for the authenticated business after it has been
 *        signed on-chain by the user's own wallet.
 * PATCH — update a payment's settlement lifecycle (status / txHash / proof).
 */

export async function GET(req: NextRequest) {
  const payer = req.nextUrl.searchParams.get("payer");
  const cfg = getChainConfig();
  if (!cfg) return NextResponse.json({ payments: [] });
  try {
    const payments = await indexPayments(cfg, payer ? (payer as Hex) : undefined);
    return NextResponse.json({ payments });
  } catch (err) {
    console.error("payments index failed", err);
    return NextResponse.json(
      { payments: [], error: err instanceof Error ? err.message : "chain error" },
      { status: 502 },
    );
  }
}

function guard() {
  return privyConfigured() && dbConfigured();
}

export async function POST(req: NextRequest) {
  if (!guard()) return NextResponse.json({ error: "server not configured" }, { status: 503 });
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let body: {
    id?: string;
    ref?: string;
    supplierId?: string;
    goods?: string;
    amountAed?: number;
    mode?: SettlementMode;
    status?: SettlementStatus;
    proofLabel?: string;
    settledAt?: number;
    txHash?: string;
    explorerUrl?: string;
    txState?: TxState;
    createdAt?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  if (!body.id || !body.ref || !body.supplierId || !body.mode || !body.status || !body.amountAed) {
    return NextResponse.json({ error: "missing payment fields" }, { status: 400 });
  }

  await createPayment(userId, {
    id: body.id,
    ref: body.ref,
    supplierId: body.supplierId,
    goods: cleanText(body.goods ?? "", GOODS_MAX),
    amountAed: body.amountAed,
    mode: body.mode,
    status: body.status,
    proofLabel: body.proofLabel,
    settledAt: body.settledAt,
    txHash: body.txHash,
    explorerUrl: body.explorerUrl,
    txState: body.txState,
    createdAt: body.createdAt ?? Date.now(),
  });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  if (!guard()) return NextResponse.json({ error: "server not configured" }, { status: 503 });
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let body: { id?: string; patch?: PaymentPatch };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  if (!body.id || !body.patch) return NextResponse.json({ error: "missing id/patch" }, { status: 400 });

  await updatePayment(userId, body.id, body.patch);
  return NextResponse.json({ ok: true });
}
