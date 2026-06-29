import "server-only";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

/*
 * Neon / Vercel Postgres connection. Lazy + cached so a missing DATABASE_URL
 * only throws when a request actually needs the database (not at import/build
 * time). This is the persistence backbone for real accounts — every business,
 * supplier and payment lives here, scoped to the authenticated Privy user.
 */

let _sql: NeonQueryFunction<false, false> | null = null;

export function db(): NeonQueryFunction<false, false> {
  if (_sql) return _sql;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Create a Neon / Vercel Postgres database and add its " +
        "connection string to DATABASE_URL (see docs/SETUP.md).",
    );
  }
  _sql = neon(url);
  return _sql;
}

export function dbConfigured(): boolean {
  return !!process.env.DATABASE_URL;
}
