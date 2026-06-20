import "server-only";
import { PrivyClient } from "@privy-io/server-auth";
import type { NextRequest } from "next/server";

/*
 * Server-side Privy identity. Every write/read of account data is gated on a
 * verified Privy access token — the client sends its token in the Authorization
 * header, we verify it here, and we only ever touch rows owned by that DID. The
 * client is never trusted to say who it is.
 */

let _client: PrivyClient | null = null;

function client(): PrivyClient | null {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  if (!appId || !appSecret) return null;
  if (!_client) _client = new PrivyClient(appId, appSecret);
  return _client;
}

export function privyConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_PRIVY_APP_ID && process.env.PRIVY_APP_SECRET);
}

/** Returns the verified Privy user DID for the request, or null if unauthenticated. */
export async function getUserId(req: NextRequest): Promise<string | null> {
  const c = client();
  if (!c) return null;
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
  if (!token) return null;
  try {
    const claims = await c.verifyAuthToken(token);
    return claims.userId;
  } catch {
    return null;
  }
}
