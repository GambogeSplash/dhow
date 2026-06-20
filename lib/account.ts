/*
 * Dhow account layer (client).
 * ----------------------------
 * Identity comes from Privy (a verified DID + a non-custodial embedded wallet);
 * persistence is server-authoritative in Neon Postgres. This module is the thin
 * typed client over the /api/account, /api/suppliers and /api/corridors routes.
 * Every call carries the caller's Privy access token, which the server verifies
 * before touching any row — the client is never trusted to assert identity.
 */

import type {
  Corridor,
  Counterparty,
  SettlementMode,
  SettlementStatus,
  ProofStatus,
  TxState,
} from "./corridor";

export interface Business {
  id: string; // Privy user DID
  email: string;
  name: string;
  city: string;
  country: string;
  walletAddress?: string;
  createdAt: number;
}

export type Supplier = Counterparty;

/** Everything that belongs to one account. */
export interface AccountRecord {
  business: Business;
  suppliers: Supplier[];
  corridors: Corridor[];
  offerAccepted: boolean;
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

async function call<T>(
  token: string,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(path, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "content-type": "application/json" } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.error ?? `request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

// ---- account ----

export async function apiGetAccount(token: string): Promise<AccountRecord | null> {
  const { account } = await call<{ account: AccountRecord | null }>(token, "/api/account");
  return account;
}

/** Create-or-fetch the row for a freshly authenticated user. */
export async function apiEnsureAccount(
  token: string,
  input: { email?: string; walletAddress?: string },
): Promise<AccountRecord> {
  const { account } = await call<{ account: AccountRecord }>(token, "/api/account", {
    method: "POST",
    body: { action: "ensure", ...input, now: Date.now() },
  });
  return account;
}

export async function apiSaveProfile(
  token: string,
  input: { name: string; city: string; country: string; walletAddress?: string },
): Promise<AccountRecord | null> {
  const { account } = await call<{ account: AccountRecord | null }>(token, "/api/account", {
    method: "POST",
    body: { action: "profile", ...input },
  });
  return account;
}

export async function apiSetWallet(token: string, walletAddress: string): Promise<AccountRecord | null> {
  const { account } = await call<{ account: AccountRecord | null }>(token, "/api/account", {
    method: "POST",
    body: { action: "wallet", walletAddress },
  });
  return account;
}

export async function apiSetOfferAccepted(token: string, accepted: boolean): Promise<void> {
  await call(token, "/api/account", { method: "POST", body: { action: "offer", accepted } });
}

// ---- suppliers ----

export async function apiAddSupplier(
  token: string,
  input: { id?: string; name: string; city: string; country: string; walletAddress?: string },
): Promise<Supplier> {
  const { supplier } = await call<{ supplier: Supplier }>(token, "/api/suppliers", {
    method: "POST",
    body: { ...input, now: Date.now() },
  });
  return supplier;
}

// ---- corridors ----

export async function apiCreateCorridor(
  token: string,
  input: {
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
  await call(token, "/api/corridors", { method: "POST", body: input });
}

export async function apiPatchCorridor(token: string, id: string, patch: CorridorPatch): Promise<void> {
  await call(token, "/api/corridors", { method: "PATCH", body: { id, patch } });
}

// ---- facilities (financier side) ----

export interface FacilityDTO {
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

export async function apiListFacilities(token: string): Promise<FacilityDTO[]> {
  const { facilities } = await call<{ facilities: FacilityDTO[] }>(token, "/api/facilities");
  return facilities;
}

export async function apiCreateFacility(
  token: string,
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
  await call(token, "/api/facilities", { method: "POST", body: f });
}

export async function apiMarkRepaid(token: string, borrowerId: string): Promise<void> {
  await call(token, "/api/facilities", { method: "PATCH", body: { borrowerId } });
}
