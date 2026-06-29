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

-- Incoming claims a business is owed (the inflow side). A verified receivable
-- (status='verified' with an attestation_uid) secures a larger, cheaper
-- working-capital line — the self-liquidating leg of the credit model.
CREATE TABLE IF NOT EXISTS receivables (
  id               TEXT PRIMARY KEY,
  business_id      TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  debtor_id        TEXT NOT NULL,
  debtor_name      TEXT NOT NULL,
  debtor_city      TEXT NOT NULL DEFAULT '',
  debtor_country   TEXT NOT NULL DEFAULT 'AE',
  amount_aed       DOUBLE PRECISION NOT NULL,
  due_at           BIGINT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'expected',  -- expected | verified | collected | defaulted
  attestation_uid  TEXT,                              -- EAS proof uid once verified
  created_at       BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS receivables_business_idx ON receivables(business_id);

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

-- Working-capital DEALS: the shared negotiation object both sides act on. A deal
-- carries the request, the live terms, the funding tx and the repayment through
-- one lifecycle (requested → offered/countered → agreed → funded → repaid, or
-- declined/withdrawn). The financier_id is null while a request is still open to
-- the desk. This supersedes the one-bit `facilities` table above.
CREATE TABLE IF NOT EXISTS deals (
  id                 TEXT PRIMARY KEY,
  borrower_id        TEXT NOT NULL,               -- importer Privy DID
  borrower_name      TEXT NOT NULL,
  financier_id       TEXT,                         -- funder Privy DID (null = open request)
  financier_name     TEXT,
  status             TEXT NOT NULL,                -- requested|offered|countered|agreed|funded|repaid|declined|withdrawn
  turn               TEXT NOT NULL,                -- borrower | financier (whose move)
  amount_aed         DOUBLE PRECISION NOT NULL,    -- live terms: principal
  rate_pct           DOUBLE PRECISION NOT NULL,    -- live terms: flat financing fee %
  tenor_days         INTEGER NOT NULL,             -- live terms: repayment window
  purpose            TEXT,
  request_id         TEXT,                          -- parent request, on a competing offer
  financier_wallet   TEXT,                          -- funding address (repayment target)
  funded_at          BIGINT,
  tx_hash            TEXT,
  explorer_url       TEXT,
  due_at             BIGINT,
  repaid_at          BIGINT,
  repay_tx_hash      TEXT,
  repay_explorer_url TEXT,
  created_at         BIGINT NOT NULL,
  updated_at         BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS deals_borrower_idx ON deals(borrower_id);
CREATE INDEX IF NOT EXISTS deals_financier_idx ON deals(financier_id);
CREATE INDEX IF NOT EXISTS deals_status_idx ON deals(status);

-- The negotiation timeline: one row per move (request, offer, counter, accept,
-- fund, repay, decline, message). This is what makes a deal feel like a real
-- back-and-forth — both parties read the same thread.
CREATE TABLE IF NOT EXISTS deal_events (
  id          TEXT PRIMARY KEY,
  deal_id     TEXT NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  actor       TEXT NOT NULL,                       -- borrower | financier | system
  kind        TEXT NOT NULL,
  amount_aed  DOUBLE PRECISION,
  rate_pct    DOUBLE PRECISION,
  tenor_days  INTEGER,
  note        TEXT,
  created_at  BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS deal_events_deal_idx ON deal_events(deal_id, created_at);
