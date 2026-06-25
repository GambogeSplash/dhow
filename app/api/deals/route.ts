import { NextRequest, NextResponse } from "next/server";
import { getUserId, privyConfigured } from "@/lib/privy-server";
import { dbConfigured } from "@/lib/db";
import {
  getDeal,
  getAccount,
  insertDeal,
  saveDealStep,
  listDealsForBorrower,
  listDealsForFinancier,
  listOpenRequests,
} from "@/lib/store-server";
import {
  applyAction,
  openRequest,
  openOffer,
  newDealId,
  clampTerms,
  DealError,
  type Deal,
  type DealParty,
  type DealTerms,
} from "@/lib/deal";
import { FINANCIER } from "@/lib/financier";

export const runtime = "nodejs";

/*
 * The deal desk. One endpoint drives the whole working-capital lifecycle:
 * request → offer/counter → accept → fund → repay (or decline/withdraw). The
 * deal is the shared object — the same row the borrower and the financier both
 * act on — so the API resolves which PARTY the caller is, checks the move is
 * theirs to make (via the pure state machine), applies it, and persists the
 * timeline event. Settlement (fund/repay) is signed client-side; the caller
 * passes the resulting txHash and we record the state transition.
 */
function guard() {
  return privyConfigured() && dbConfigured();
}

/** Which side of the deal this user is, or null if they have no standing. */
function partyFor(deal: Deal, userId: string): DealParty | null {
  if (deal.borrowerId === userId) return "borrower";
  if (deal.financierId === userId) return "financier";
  // An unclaimed request is open to any financier on the desk.
  if (deal.financierId === null && deal.status === "requested") return "financier";
  return null;
}

export async function GET(req: NextRequest) {
  if (!guard()) return NextResponse.json({ deals: [], requests: [] });
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (id) {
    const deal = await getDeal(id);
    if (!deal || !partyFor(deal, userId)) {
      return NextResponse.json({ error: "deal not found" }, { status: 404 });
    }
    return NextResponse.json({ deal });
  }

  const role = req.nextUrl.searchParams.get("role");
  if (role === "financier") {
    // The financier sees deals they're engaged on plus open requests to claim.
    const [engaged, requests] = await Promise.all([listDealsForFinancier(userId), listOpenRequests()]);
    return NextResponse.json({ deals: engaged, requests });
  }
  // Default: the borrower's own deals.
  return NextResponse.json({ deals: await listDealsForBorrower(userId), requests: [] });
}

export async function POST(req: NextRequest) {
  if (!guard()) return NextResponse.json({ error: "server not configured" }, { status: 503 });
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let body: {
    action?: string;
    dealId?: string;
    borrowerId?: string;
    borrowerName?: string;
    terms?: DealTerms;
    purpose?: string;
    note?: string;
    txHash?: string;
    explorerUrl?: string;
    financierWallet?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const now = Date.now();

  // --- open a new request (borrower) ---
  if (body.action === "request") {
    if (!body.terms || !body.terms.amountAed) {
      return NextResponse.json({ error: "missing terms" }, { status: 400 });
    }
    const account = await getAccount(userId);
    if (!account) return NextResponse.json({ error: "no account" }, { status: 400 });
    const deal = openRequest({
      id: newDealId(),
      borrowerId: userId,
      borrowerName: account.business.name || "Importer",
      terms: clampTerms(body.terms),
      purpose: body.purpose,
      now,
    });
    await insertDeal(deal);
    return NextResponse.json({ deal });
  }

  // --- financier opens a deal proactively (offer with no prior request) ---
  if (body.action === "offer" && !body.dealId) {
    if (!body.borrowerId || !body.terms) {
      return NextResponse.json({ error: "missing borrowerId/terms" }, { status: 400 });
    }
    const deal = openOffer({
      id: newDealId(),
      borrowerId: body.borrowerId,
      borrowerName: body.borrowerName || "Importer",
      financierId: userId,
      financierName: FINANCIER.name,
      terms: clampTerms(body.terms),
      note: body.note,
      now,
    });
    await insertDeal(deal);
    return NextResponse.json({ deal });
  }

  // --- act on an existing deal ---
  if (!body.dealId) return NextResponse.json({ error: "missing dealId" }, { status: 400 });
  const deal = await getDeal(body.dealId);
  if (!deal) return NextResponse.json({ error: "deal not found" }, { status: 404 });
  const party = partyFor(deal, userId);
  if (!party) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  try {
    let next: Deal;
    switch (body.action) {
      case "offer":
        if (party !== "financier") throw new DealError("Only a financier can offer.");
        if (!body.terms) throw new DealError("missing terms");
        next = applyAction(
          deal,
          { kind: "offer", by: "financier", financierId: userId, financierName: FINANCIER.name, terms: body.terms, note: body.note },
          now,
        );
        break;
      case "counter":
        if (!body.terms) throw new DealError("missing terms");
        next = applyAction(deal, { kind: "counter", by: party, terms: body.terms, note: body.note }, now);
        break;
      case "accept":
        next = applyAction(deal, { kind: "accept", by: party }, now);
        break;
      case "decline":
        next = applyAction(deal, { kind: "decline", by: party, note: body.note }, now);
        break;
      case "withdraw":
        next = applyAction(deal, { kind: "withdraw", by: "borrower" }, now);
        break;
      case "fund":
        if (party !== "financier") throw new DealError("Only a financier can fund.");
        next = applyAction(
          deal,
          { kind: "fund", by: "financier", txHash: body.txHash, explorerUrl: body.explorerUrl, financierWallet: body.financierWallet },
          now,
        );
        break;
      case "repay":
        if (party !== "borrower") throw new DealError("Only the borrower can repay.");
        next = applyAction(deal, { kind: "repay", by: "borrower", txHash: body.txHash, explorerUrl: body.explorerUrl }, now);
        break;
      default:
        return NextResponse.json({ error: "unknown action" }, { status: 400 });
    }
    await saveDealStep(next, next.events[next.events.length - 1]);
    return NextResponse.json({ deal: next });
  } catch (err) {
    if (err instanceof DealError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error("deal action failed", err);
    return NextResponse.json({ error: "deal action failed" }, { status: 500 });
  }
}
