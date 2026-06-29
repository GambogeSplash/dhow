import { NextResponse } from "next/server";
import { dbConfigured } from "@/lib/db";
import { listBorrowers } from "@/lib/store-server";

export const runtime = "nodejs";

/*
 * Financier-facing borrower feed: onboarded businesses with their settled
 * payment history, read from the database. The financier derives the Credit
 * Score from this the same way the importer sees it, and overlays the on-chain
 * verified score from the registry via /api/score.
 */
export async function GET() {
  if (!dbConfigured()) return NextResponse.json({ borrowers: [] });
  try {
    const borrowers = await listBorrowers();
    return NextResponse.json({ borrowers });
  } catch (err) {
    console.error("borrowers feed failed", err);
    return NextResponse.json(
      { borrowers: [], error: err instanceof Error ? err.message : "db error" },
      { status: 502 },
    );
  }
}
