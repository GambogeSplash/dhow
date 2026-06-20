import { NextRequest, NextResponse } from "next/server";
import { getUserId, privyConfigured } from "@/lib/privy-server";
import { dbConfigured } from "@/lib/db";
import { listFacilities, createFacility, markFacilityRepaid } from "@/lib/store-server";

export const runtime = "nodejs";

/*
 * Financier facilities. A facility is created after the financier has signed a
 * real on-chain USDC transfer to the borrower; this persists the commitment +
 * settlement tx. Scoped to the authenticated financier (Privy DID).
 */
function guard() {
  return privyConfigured() && dbConfigured();
}

export async function GET(req: NextRequest) {
  if (!guard()) return NextResponse.json({ facilities: [] });
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  return NextResponse.json({ facilities: await listFacilities(userId) });
}

export async function POST(req: NextRequest) {
  if (!guard()) return NextResponse.json({ error: "server not configured" }, { status: 503 });
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let body: {
    id?: string;
    borrowerId?: string;
    borrowerName?: string;
    amountAed?: number;
    amountUsdc?: number;
    txHash?: string;
    explorerUrl?: string;
    fundedAt?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  if (!body.id || !body.borrowerId || !body.borrowerName || !body.amountAed) {
    return NextResponse.json({ error: "missing facility fields" }, { status: 400 });
  }

  await createFacility(userId, {
    id: body.id,
    borrowerId: body.borrowerId,
    borrowerName: body.borrowerName,
    amountAed: body.amountAed,
    amountUsdc: body.amountUsdc ?? 0,
    txHash: body.txHash,
    explorerUrl: body.explorerUrl,
    fundedAt: body.fundedAt ?? Date.now(),
  });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  if (!guard()) return NextResponse.json({ error: "server not configured" }, { status: 503 });
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let body: { borrowerId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  if (!body.borrowerId) return NextResponse.json({ error: "missing borrowerId" }, { status: 400 });

  await markFacilityRepaid(userId, body.borrowerId);
  return NextResponse.json({ ok: true });
}
