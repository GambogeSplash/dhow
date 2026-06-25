import { NextRequest, NextResponse } from "next/server";
import { getUserId, privyConfigured } from "@/lib/privy-server";
import { dbConfigured } from "@/lib/db";
import { addSupplier } from "@/lib/store-server";
import { sanitizeSupplier, isValidName } from "@/lib/validate";

export const runtime = "nodejs";

/** Add a supplier to the authenticated business's directory. */
export async function POST(req: NextRequest) {
  if (!privyConfigured() || !dbConfigured()) {
    return NextResponse.json({ error: "server not configured (see docs/SETUP.md)" }, { status: 503 });
  }
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let body: { id?: string; name?: string; city?: string; country?: string; walletAddress?: string; now?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const clean = sanitizeSupplier({
    name: body.name ?? "",
    city: body.city ?? "",
    country: body.country ?? "",
  });
  if (!isValidName(clean.name)) return NextResponse.json({ error: "missing name" }, { status: 400 });

  const supplier = await addSupplier(
    userId,
    {
      id: body.id,
      name: clean.name,
      city: clean.city,
      country: clean.country,
      walletAddress: body.walletAddress?.trim() || undefined,
    },
    body.now ?? Date.now(),
  );
  return NextResponse.json({ supplier });
}
