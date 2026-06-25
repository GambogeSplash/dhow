import { NextRequest, NextResponse } from "next/server";
import { getUserId, privyConfigured } from "@/lib/privy-server";
import { dbConfigured } from "@/lib/db";
import {
  getAccount,
  ensureBusiness,
  saveBusinessProfile,
  setWallet,
  setOfferAccepted,
} from "@/lib/store-server";
import { sanitizeBusiness, isValidName } from "@/lib/validate";

export const runtime = "nodejs";

function notConfigured() {
  return NextResponse.json(
    {
      error:
        "Server not configured. Set NEXT_PUBLIC_PRIVY_APP_ID, PRIVY_APP_SECRET and DATABASE_URL (see docs/SETUP.md).",
    },
    { status: 503 },
  );
}

/** The authenticated business's full workspace (business + suppliers + corridors). */
export async function GET(req: NextRequest) {
  if (!privyConfigured() || !dbConfigured()) return notConfigured();
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const account = await getAccount(userId);
  return NextResponse.json({ account });
}

/** Mutations, dispatched by `action`. All scoped to the verified caller. */
export async function POST(req: NextRequest) {
  if (!privyConfigured() || !dbConfigured()) return notConfigured();
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let body: {
    action?: string;
    email?: string;
    walletAddress?: string;
    name?: string;
    city?: string;
    country?: string;
    accepted?: boolean;
    now?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const now = body.now ?? Date.now();

  switch (body.action) {
    case "ensure": {
      const account = await ensureBusiness(userId, body.email ?? "", body.walletAddress, now);
      return NextResponse.json({ account });
    }
    case "profile": {
      const clean = sanitizeBusiness({
        name: body.name ?? "",
        city: body.city ?? "",
        country: body.country ?? "",
      });
      if (!isValidName(clean.name)) {
        return NextResponse.json({ error: "missing business name" }, { status: 400 });
      }
      await saveBusinessProfile(userId, {
        ...clean,
        walletAddress: body.walletAddress,
      });
      return NextResponse.json({ account: await getAccount(userId) });
    }
    case "wallet": {
      if (!body.walletAddress) return NextResponse.json({ error: "missing walletAddress" }, { status: 400 });
      await setWallet(userId, body.walletAddress);
      return NextResponse.json({ account: await getAccount(userId) });
    }
    case "offer": {
      await setOfferAccepted(userId, !!body.accepted);
      return NextResponse.json({ ok: true });
    }
    default:
      return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }
}
