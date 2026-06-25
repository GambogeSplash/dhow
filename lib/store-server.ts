import "server-only";
import { db } from "./db";
import type { Business, Supplier, AccountRecord } from "./account";
import type { Corridor, SettlementMode, SettlementStatus, ProofStatus, TxState } from "./corridor";
import { makeCorridorUsdc } from "./corridor";
import type { Deal, DealEvent } from "./deal";

/*
 * Server-authoritative data access. All functions are scoped by businessId
 * (the verified Privy DID) — a caller can only ever read or mutate their own
 * rows. This replaces the old localStorage account layer.
 */

// ---- row → domain mappers ----

type BusinessRow = {
  id: string;
  email: string | null;
  name: string;
  city: string;
  country: string;
  wallet_address: string | null;
  offer_accepted: boolean;
  created_at: string | number;
};

type SupplierRow = {
  id: string;
  name: string;
  city: string;
  country: string;
  wallet_address: string | null;
  created_at: string | number;
};

type CorridorRow = {
  id: string;
  ref: string;
  supplier_id: string;
  goods: string;
  amount_aed: number;
  amount_usdc: number;
  mode: string;
  status: string;
  proof_status: string | null;
  proof_label: string | null;
  proof_attested_by: string | null;
  created_at: string | number;
  settled_at: string | number | null;
  tx_hash: string | null;
  explorer_url: string | null;
  tx_state: string | null;
};

const num = (v: string | number | null): number => (v == null ? 0 : Number(v));

function toBusiness(r: BusinessRow): Business {
  return {
    id: r.id,
    email: r.email ?? "",
    name: r.name,
    city: r.city,
    country: r.country,
    walletAddress: r.wallet_address ?? undefined,
    createdAt: num(r.created_at),
  };
}

function toSupplier(r: SupplierRow): Supplier {
  return {
    id: r.id,
    name: r.name,
    city: r.city,
    country: r.country,
    walletAddress: r.wallet_address ?? undefined,
  };
}

function toCorridor(r: CorridorRow, suppliers: Supplier[]): Corridor {
  const supplier =
    suppliers.find((s) => s.id === r.supplier_id) ??
    ({ id: r.supplier_id, name: "Unknown supplier", city: "", country: "" } as Supplier);
  return {
    id: r.id,
    ref: r.ref,
    supplier,
    goods: r.goods,
    amountAed: num(r.amount_aed),
    amountUsdc: num(r.amount_usdc),
    mode: r.mode as SettlementMode,
    status: r.status as SettlementStatus,
    proof: r.proof_status
      ? {
          status: r.proof_status as ProofStatus,
          label: r.proof_label ?? "",
          attestedBy: r.proof_attested_by ?? undefined,
        }
      : undefined,
    createdAt: num(r.created_at),
    settledAt: r.settled_at == null ? undefined : num(r.settled_at),
    txHash: r.tx_hash ?? undefined,
    explorerUrl: r.explorer_url ?? undefined,
    txState: (r.tx_state as TxState) ?? undefined,
  };
}

// ---- account ----

/** The full workspace for one business, or null if not onboarded yet. */
export async function getAccount(businessId: string): Promise<AccountRecord | null> {
  const sql = db();
  const rows = (await sql`SELECT * FROM businesses WHERE id = ${businessId}`) as BusinessRow[];
  if (!rows.length) return null;
  const business = toBusiness(rows[0]);

  const supRows = (await sql`
    SELECT * FROM suppliers WHERE business_id = ${businessId} ORDER BY created_at ASC
  `) as SupplierRow[];
  const suppliers = supRows.map(toSupplier);

  const corRows = (await sql`
    SELECT * FROM corridors WHERE business_id = ${businessId} ORDER BY created_at ASC
  `) as CorridorRow[];
  const corridors = corRows.map((c) => toCorridor(c, suppliers));

  return { business, suppliers, corridors, offerAccepted: rows[0].offer_accepted };
}

/** Create the row for a freshly authenticated user (empty profile). */
export async function ensureBusiness(
  businessId: string,
  email: string,
  walletAddress: string | undefined,
  now: number,
): Promise<AccountRecord> {
  const sql = db();
  await sql`
    INSERT INTO businesses (id, email, wallet_address, created_at)
    VALUES (${businessId}, ${email || null}, ${walletAddress?.toLowerCase() ?? null}, ${now})
    ON CONFLICT (id) DO UPDATE SET
      email = COALESCE(EXCLUDED.email, businesses.email),
      wallet_address = COALESCE(EXCLUDED.wallet_address, businesses.wallet_address)
  `;
  return (await getAccount(businessId))!;
}

/** Save the business profile (onboarding step). */
export async function saveBusinessProfile(
  businessId: string,
  p: { name: string; city: string; country: string; walletAddress?: string },
): Promise<void> {
  const sql = db();
  await sql`
    UPDATE businesses
    SET name = ${p.name}, city = ${p.city}, country = ${p.country},
        wallet_address = COALESCE(${p.walletAddress?.toLowerCase() ?? null}, wallet_address)
    WHERE id = ${businessId}
  `;
}

export async function setWallet(businessId: string, address: string): Promise<void> {
  const sql = db();
  await sql`UPDATE businesses SET wallet_address = ${address.toLowerCase()} WHERE id = ${businessId}`;
}

export async function setOfferAccepted(businessId: string, accepted: boolean): Promise<void> {
  const sql = db();
  await sql`UPDATE businesses SET offer_accepted = ${accepted} WHERE id = ${businessId}`;
}

/**
 * Borrowers for the financier desk: every onboarded business with its corridors.
 * The financier overlays the on-chain verified score; we return the raw corridor
 * history so the score can be derived and shown the same way the importer sees it.
 */
export async function listBorrowers(): Promise<
  Array<{ business: Business; corridors: Corridor[] }>
> {
  const sql = db();
  const bizRows = (await sql`
    SELECT * FROM businesses WHERE name <> '' ORDER BY created_at ASC
  `) as BusinessRow[];

  const out: Array<{ business: Business; corridors: Corridor[] }> = [];
  for (const row of bizRows) {
    const business = toBusiness(row);
    const supRows = (await sql`
      SELECT * FROM suppliers WHERE business_id = ${business.id}
    `) as SupplierRow[];
    const suppliers = supRows.map(toSupplier);
    const corRows = (await sql`
      SELECT * FROM corridors WHERE business_id = ${business.id} ORDER BY created_at ASC
    `) as CorridorRow[];
    out.push({ business, corridors: corRows.map((c) => toCorridor(c, suppliers)) });
  }
  return out;
}

// ---- facilities (financier funding) ----

export interface FacilityRecord {
  id: string;
  borrowerId: string;
  borrowerName: string;
  amountAed: number;
  amountUsdc: number;
  txHash?: string;
  explorerUrl?: string;
  repaid: boolean;
  fundedAt: number;
}

type FacilityRow = {
  id: string;
  borrower_id: string;
  borrower_name: string;
  amount_aed: number;
  amount_usdc: number;
  tx_hash: string | null;
  explorer_url: string | null;
  repaid: boolean;
  funded_at: string | number;
};

function toFacility(r: FacilityRow): FacilityRecord {
  return {
    id: r.id,
    borrowerId: r.borrower_id,
    borrowerName: r.borrower_name,
    amountAed: num(r.amount_aed),
    amountUsdc: num(r.amount_usdc),
    txHash: r.tx_hash ?? undefined,
    explorerUrl: r.explorer_url ?? undefined,
    repaid: r.repaid,
    fundedAt: num(r.funded_at),
  };
}

export async function listFacilities(financierId: string): Promise<FacilityRecord[]> {
  const sql = db();
  const rows = (await sql`
    SELECT * FROM facilities WHERE financier_id = ${financierId} ORDER BY funded_at DESC
  `) as FacilityRow[];
  return rows.map(toFacility);
}

export async function createFacility(
  financierId: string,
  f: {
    id: string;
    borrowerId: string;
    borrowerName: string;
    amountAed: number;
    amountUsdc: number;
    txHash?: string;
    explorerUrl?: string;
    fundedAt: number;
  },
): Promise<void> {
  const sql = db();
  // One live facility per borrower per financier; re-funding replaces it.
  await sql`DELETE FROM facilities WHERE financier_id = ${financierId} AND borrower_id = ${f.borrowerId} AND repaid = FALSE`;
  await sql`
    INSERT INTO facilities (
      id, financier_id, borrower_id, borrower_name, amount_aed, amount_usdc,
      tx_hash, explorer_url, repaid, funded_at
    ) VALUES (
      ${f.id}, ${financierId}, ${f.borrowerId}, ${f.borrowerName}, ${f.amountAed}, ${f.amountUsdc},
      ${f.txHash ?? null}, ${f.explorerUrl ?? null}, FALSE, ${f.fundedAt}
    )
  `;
}

export async function markFacilityRepaid(financierId: string, borrowerId: string): Promise<void> {
  const sql = db();
  await sql`
    UPDATE facilities SET repaid = TRUE
    WHERE financier_id = ${financierId} AND borrower_id = ${borrowerId}
  `;
}

// ---- deals (the working-capital negotiation lifecycle) ----

type DealRow = {
  id: string;
  borrower_id: string;
  borrower_name: string;
  financier_id: string | null;
  financier_name: string | null;
  status: string;
  turn: string;
  amount_aed: number;
  rate_pct: number;
  tenor_days: number;
  purpose: string | null;
  financier_wallet: string | null;
  funded_at: string | number | null;
  tx_hash: string | null;
  explorer_url: string | null;
  due_at: string | number | null;
  repaid_at: string | number | null;
  repay_tx_hash: string | null;
  repay_explorer_url: string | null;
  created_at: string | number;
  updated_at: string | number;
};

type DealEventRow = {
  id: string;
  actor: string;
  kind: string;
  amount_aed: number | null;
  rate_pct: number | null;
  tenor_days: number | null;
  note: string | null;
  created_at: string | number;
};

function toDealEvent(r: DealEventRow): DealEvent {
  const hasTerms = r.amount_aed != null && r.rate_pct != null && r.tenor_days != null;
  return {
    id: r.id,
    actor: r.actor as DealEvent["actor"],
    kind: r.kind as DealEvent["kind"],
    terms: hasTerms
      ? { amountAed: num(r.amount_aed), ratePct: num(r.rate_pct), tenorDays: Number(r.tenor_days) }
      : undefined,
    note: r.note ?? undefined,
    createdAt: num(r.created_at),
  };
}

function toDeal(r: DealRow, events: DealEvent[]): Deal {
  return {
    id: r.id,
    borrowerId: r.borrower_id,
    borrowerName: r.borrower_name,
    financierId: r.financier_id,
    financierName: r.financier_name,
    status: r.status as Deal["status"],
    turn: r.turn as Deal["turn"],
    terms: { amountAed: num(r.amount_aed), ratePct: num(r.rate_pct), tenorDays: Number(r.tenor_days) },
    purpose: r.purpose ?? undefined,
    financierWallet: r.financier_wallet ?? undefined,
    fundedAt: r.funded_at == null ? undefined : num(r.funded_at),
    txHash: r.tx_hash ?? undefined,
    explorerUrl: r.explorer_url ?? undefined,
    dueAt: r.due_at == null ? undefined : num(r.due_at),
    repaidAt: r.repaid_at == null ? undefined : num(r.repaid_at),
    repayTxHash: r.repay_tx_hash ?? undefined,
    repayExplorerUrl: r.repay_explorer_url ?? undefined,
    createdAt: num(r.created_at),
    updatedAt: num(r.updated_at),
    events,
  };
}

async function loadEvents(dealId: string): Promise<DealEvent[]> {
  const sql = db();
  const rows = (await sql`
    SELECT * FROM deal_events WHERE deal_id = ${dealId} ORDER BY created_at ASC
  `) as DealEventRow[];
  return rows.map(toDealEvent);
}

async function hydrate(rows: DealRow[]): Promise<Deal[]> {
  const out: Deal[] = [];
  for (const r of rows) out.push(toDeal(r, await loadEvents(r.id)));
  return out;
}

export async function getDeal(id: string): Promise<Deal | null> {
  const sql = db();
  const rows = (await sql`SELECT * FROM deals WHERE id = ${id}`) as DealRow[];
  if (!rows.length) return null;
  return toDeal(rows[0], await loadEvents(id));
}

/** Every deal this borrower owns, newest first. */
export async function listDealsForBorrower(borrowerId: string): Promise<Deal[]> {
  const sql = db();
  const rows = (await sql`
    SELECT * FROM deals WHERE borrower_id = ${borrowerId} ORDER BY updated_at DESC
  `) as DealRow[];
  return hydrate(rows);
}

/** Deals a financier is engaged on (they've offered / funded), newest first. */
export async function listDealsForFinancier(financierId: string): Promise<Deal[]> {
  const sql = db();
  const rows = (await sql`
    SELECT * FROM deals WHERE financier_id = ${financierId} ORDER BY updated_at DESC
  `) as DealRow[];
  return hydrate(rows);
}

/** Open requests on the desk that no financier has claimed yet. */
export async function listOpenRequests(): Promise<Deal[]> {
  const sql = db();
  const rows = (await sql`
    SELECT * FROM deals WHERE financier_id IS NULL AND status = 'requested' ORDER BY created_at ASC
  `) as DealRow[];
  return hydrate(rows);
}

/** Insert a brand-new deal (request) and its opening event. */
export async function insertDeal(d: Deal): Promise<void> {
  const sql = db();
  await sql`
    INSERT INTO deals (
      id, borrower_id, borrower_name, financier_id, financier_name, status, turn,
      amount_aed, rate_pct, tenor_days, purpose, created_at, updated_at
    ) VALUES (
      ${d.id}, ${d.borrowerId}, ${d.borrowerName}, ${d.financierId}, ${d.financierName}, ${d.status}, ${d.turn},
      ${d.terms.amountAed}, ${d.terms.ratePct}, ${d.terms.tenorDays}, ${d.purpose ?? null}, ${d.createdAt}, ${d.updatedAt}
    )
  `;
  for (const e of d.events) await insertDealEvent(d.id, e);
}

/** Persist the mutable deal fields after an action, and append the new event. */
export async function saveDealStep(d: Deal, newEvent: DealEvent): Promise<void> {
  const sql = db();
  await sql`
    UPDATE deals SET
      financier_id = ${d.financierId},
      financier_name = ${d.financierName},
      status = ${d.status},
      turn = ${d.turn},
      amount_aed = ${d.terms.amountAed},
      rate_pct = ${d.terms.ratePct},
      tenor_days = ${d.terms.tenorDays},
      financier_wallet = ${d.financierWallet ?? null},
      funded_at = ${d.fundedAt ?? null},
      tx_hash = ${d.txHash ?? null},
      explorer_url = ${d.explorerUrl ?? null},
      due_at = ${d.dueAt ?? null},
      repaid_at = ${d.repaidAt ?? null},
      repay_tx_hash = ${d.repayTxHash ?? null},
      repay_explorer_url = ${d.repayExplorerUrl ?? null},
      updated_at = ${d.updatedAt}
    WHERE id = ${d.id}
  `;
  await insertDealEvent(d.id, newEvent);
}

async function insertDealEvent(dealId: string, e: DealEvent): Promise<void> {
  const sql = db();
  await sql`
    INSERT INTO deal_events (id, deal_id, actor, kind, amount_aed, rate_pct, tenor_days, note, created_at)
    VALUES (
      ${e.id}, ${dealId}, ${e.actor}, ${e.kind},
      ${e.terms?.amountAed ?? null}, ${e.terms?.ratePct ?? null}, ${e.terms?.tenorDays ?? null},
      ${e.note ?? null}, ${e.createdAt}
    )
    ON CONFLICT (id) DO NOTHING
  `;
}

// ---- suppliers ----

export async function addSupplier(
  businessId: string,
  s: { id?: string; name: string; city: string; country: string; walletAddress?: string },
  now: number,
): Promise<Supplier> {
  const sql = db();
  const id = s.id ?? `sup_${cryptoRandom()}`;
  await sql`
    INSERT INTO suppliers (id, business_id, name, city, country, wallet_address, created_at)
    VALUES (${id}, ${businessId}, ${s.name}, ${s.city}, ${s.country}, ${s.walletAddress?.toLowerCase() ?? null}, ${now})
    ON CONFLICT (id) DO NOTHING
  `;
  return { id, name: s.name, city: s.city, country: s.country, walletAddress: s.walletAddress };
}

// ---- corridors ----

export async function createCorridor(
  businessId: string,
  c: {
    id: string;
    ref: string;
    supplierId: string;
    goods: string;
    amountAed: number;
    mode: SettlementMode;
    status: SettlementStatus;
    proofLabel?: string;
    settledAt?: number;
    txHash?: string;
    explorerUrl?: string;
    txState?: TxState;
    createdAt: number;
  },
): Promise<void> {
  const sql = db();
  const amountUsdc = makeCorridorUsdc(c.amountAed);
  const proofStatus = c.mode === "prooflock" ? "awaiting" : null;
  await sql`
    INSERT INTO corridors (
      id, business_id, ref, supplier_id, goods, amount_aed, amount_usdc, mode, status,
      proof_status, proof_label, created_at, settled_at, tx_hash, explorer_url, tx_state
    ) VALUES (
      ${c.id}, ${businessId}, ${c.ref}, ${c.supplierId}, ${c.goods}, ${c.amountAed}, ${amountUsdc},
      ${c.mode}, ${c.status}, ${proofStatus}, ${c.proofLabel ?? null}, ${c.createdAt},
      ${c.settledAt ?? null}, ${c.txHash ?? null}, ${c.explorerUrl ?? null}, ${c.txState ?? null}
    )
  `;
}

export interface CorridorPatch {
  status?: SettlementStatus;
  settledAt?: number | null;
  txHash?: string | null;
  explorerUrl?: string | null;
  txState?: TxState | null;
  proofStatus?: ProofStatus | null;
  proofAttestedBy?: string | null;
}

/**
 * Read-merge-write update. A key present in `fields` is applied (including an
 * explicit null to clear, e.g. resetting txHash on retry); an absent key is
 * left untouched. Scoped to the owning business.
 */
export async function updateCorridor(
  businessId: string,
  id: string,
  fields: CorridorPatch,
): Promise<void> {
  const sql = db();
  const rows = (await sql`
    SELECT * FROM corridors WHERE id = ${id} AND business_id = ${businessId}
  `) as CorridorRow[];
  if (!rows.length) return;
  const r = rows[0];

  const pick = <T>(key: keyof CorridorPatch, current: T): T =>
    key in fields ? ((fields[key] as unknown) as T) : current;

  const status = pick("status", r.status);
  const settledAt = pick<number | null>("settledAt", r.settled_at == null ? null : num(r.settled_at));
  const txHash = pick<string | null>("txHash", r.tx_hash);
  const explorerUrl = pick<string | null>("explorerUrl", r.explorer_url);
  const txState = pick<string | null>("txState", r.tx_state);
  const proofStatus = pick<string | null>("proofStatus", r.proof_status);
  const proofAttestedBy = pick<string | null>("proofAttestedBy", r.proof_attested_by);

  await sql`
    UPDATE corridors SET
      status = ${status},
      settled_at = ${settledAt},
      tx_hash = ${txHash},
      explorer_url = ${explorerUrl},
      tx_state = ${txState},
      proof_status = ${proofStatus},
      proof_attested_by = ${proofAttestedBy}
    WHERE id = ${id} AND business_id = ${businessId}
  `;
}

function cryptoRandom(): string {
  try {
    return crypto.randomUUID().slice(0, 8);
  } catch {
    return Math.random().toString(36).slice(2, 10);
  }
}
