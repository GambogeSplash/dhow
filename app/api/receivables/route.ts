import { NextRequest, NextResponse } from "next/server";
import { getUserId, privyConfigured } from "@/lib/privy-server";
import { dbConfigured } from "@/lib/db";
import { createReceivable, verifyReceivable } from "@/lib/store-server";
import { cleanText } from "@/lib/validate";

export const runtime = "nodejs";

/*
 * Receivables — the inflow side of the credit model. A business records what it
 * is owed; verifying attaches an on-chain attestation uid which secures a
 * larger, cheaper working-capital line. Every call is scoped to the verified
 * Privy DID, so a caller only ever touches their own receivables.
 */

function guard() {
  return privyConfigured() && dbConfigured();
}

export async function POST(req: NextRequest) {
  if (!guard()) return NextResponse.json({ error: "server not configured" }, { status: 503 });
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let body: {
    id?: string;
    debtorId?: string;
    debtorName?: string;
    debtorCity?: string;
    amountAed?: number;
    dueAt?: number;
    createdAt?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  if (!body.id || !body.debtorId || !body.debtorName || !body.amountAed || !body.dueAt) {
    return NextResponse.json({ error: "missing receivable fields" }, { status: 400 });
  }

  await createReceivable(userId, {
    id: body.id,
    debtorId: body.debtorId,
    debtorName: cleanText(body.debtorName, 80),
    debtorCity: cleanText(body.debtorCity ?? "", 60),
    amountAed: body.amountAed,
    dueAt: body.dueAt,
    createdAt: body.createdAt ?? Date.now(),
  });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  if (!guard()) return NextResponse.json({ error: "server not configured" }, { status: 503 });
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let body: { id?: string; attestationUid?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  if (!body.id || !body.attestationUid) {
    return NextResponse.json({ error: "missing id/attestationUid" }, { status: 400 });
  }

  await verifyReceivable(userId, body.id, body.attestationUid);
  return NextResponse.json({ ok: true });
}
