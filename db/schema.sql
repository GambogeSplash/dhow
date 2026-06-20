-- Dhow persistence schema (Neon / Vercel Postgres).
-- Run once against your database: `psql "$DATABASE_URL" -f db/schema.sql`
-- (or paste into the Neon SQL editor). Idempotent.

-- One row per onboarded business. Keyed by the Privy user DID so the server is
-- the source of truth for "who owns what" — the client never asserts identity.
CREATE TABLE IF NOT EXISTS businesses (
  id              TEXT PRIMARY KEY,            -- Privy user DID (did:privy:...)
  email           TEXT,
  name            TEXT NOT NULL DEFAULT '',
  city            TEXT NOT NULL DEFAULT '',
  country         TEXT NOT NULL DEFAULT '',
  wallet_address  TEXT,                        -- embedded wallet (lowercased)
  offer_accepted  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      BIGINT NOT NULL              -- ms epoch
);

CREATE TABLE IF NOT EXISTS suppliers (
  id              TEXT PRIMARY KEY,
  business_id     TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  city            TEXT NOT NULL DEFAULT '',
  country         TEXT NOT NULL DEFAULT '',
  wallet_address  TEXT,                        -- where settlements are sent on-chain
  created_at      BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS suppliers_business_idx ON suppliers(business_id);

CREATE TABLE IF NOT EXISTS corridors (
  id                 TEXT PRIMARY KEY,
  business_id        TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  ref                TEXT NOT NULL,            -- DHW-####
  supplier_id        TEXT NOT NULL,
  goods              TEXT NOT NULL DEFAULT '',
  amount_aed         DOUBLE PRECISION NOT NULL,
  amount_usdc        DOUBLE PRECISION NOT NULL,
  mode               TEXT NOT NULL,            -- open | prooflock
  status             TEXT NOT NULL,            -- draft | locked | settled | refunded
  proof_status       TEXT,                     -- awaiting | attested | failed
  proof_label        TEXT,
  proof_attested_by  TEXT,
  created_at         BIGINT NOT NULL,
  settled_at         BIGINT,
  tx_hash            TEXT,
  explorer_url       TEXT,
  tx_state           TEXT                      -- pending | confirmed | failed
);
CREATE INDEX IF NOT EXISTS corridors_business_idx ON corridors(business_id);

-- Working-capital facilities a financier has funded to a borrower. The funding
-- itself is a real on-chain USDC transfer signed by the financier's wallet;
-- this records the commitment and the settlement tx.
CREATE TABLE IF NOT EXISTS facilities (
  id              TEXT PRIMARY KEY,
  financier_id    TEXT NOT NULL,            -- funder's Privy DID
  borrower_id     TEXT NOT NULL,
  borrower_name   TEXT NOT NULL,
  amount_aed      DOUBLE PRECISION NOT NULL,
  amount_usdc     DOUBLE PRECISION NOT NULL,
  tx_hash         TEXT,
  explorer_url    TEXT,
  repaid          BOOLEAN NOT NULL DEFAULT FALSE,
  funded_at       BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS facilities_financier_idx ON facilities(financier_id);
