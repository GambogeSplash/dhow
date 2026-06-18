/*
 * Dhow account layer (simulated infra)
 * ------------------------------------
 * A real product needs identity, a business profile, suppliers and a wallet —
 * per user, persisted, not a single hardcoded importer. This models exactly
 * that, backed by localStorage so a real person can sign up and run their own
 * business through Dhow. The seams (sign-in, account record I/O) are where a
 * real auth provider (Privy) and backend swap in; the shapes don't change.
 */

import { Corridor, Counterparty, makeCorridorUsdc } from "./corridor";

export interface Business {
  id: string;
  email: string;
  name: string;
  city: string;
  country: string;
  walletAddress?: string;
  createdAt: number;
  isSample?: boolean;
}

export type Supplier = Counterparty;

/** Everything that belongs to one account. Persisted as a unit. */
export interface AccountRecord {
  business: Business;
  suppliers: Supplier[];
  corridors: Corridor[];
  offerAccepted: boolean;
  prevScore: number;
}

const SESSION_KEY = "dhow.session.v2";
const DIR_KEY = "dhow.directory.v2";
const SAMPLE_ID = "sample";

const acctKey = (id: string) => `dhow.account.${id}.v2`;

export function isSampleId(id: string | null): boolean {
  return id === SAMPLE_ID;
}
export const SAMPLE_ACCOUNT_ID = SAMPLE_ID;

export function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `acc_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  }
}

export function walletStub(): string {
  const hex = "0123456789abcDEF";
  let a = "0x";
  for (let i = 0; i < 4; i++) a += hex[Math.floor(Math.random() * 16)];
  a += "…";
  for (let i = 0; i < 4; i++) a += hex[Math.floor(Math.random() * 16)];
  return a;
}

// ---- session ----

export function loadSession(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function saveSession(id: string | null): void {
  try {
    if (id) localStorage.setItem(SESSION_KEY, id);
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage blocked — session lives in memory for this tab */
  }
}

// ---- directory (email → account id), for sign-in ----

interface DirEntry {
  email: string;
  id: string;
  name: string;
}

function loadDirectory(): DirEntry[] {
  try {
    const raw = localStorage.getItem(DIR_KEY);
    return raw ? (JSON.parse(raw) as DirEntry[]) : [];
  } catch {
    return [];
  }
}

function saveDirectory(dir: DirEntry[]): void {
  try {
    localStorage.setItem(DIR_KEY, JSON.stringify(dir));
  } catch {
    /* ignore */
  }
}

export function findAccountByEmail(email: string): string | null {
  const e = email.trim().toLowerCase();
  return loadDirectory().find((d) => d.email === e)?.id ?? null;
}

function upsertDirectory(entry: DirEntry): void {
  const dir = loadDirectory().filter((d) => d.id !== entry.id);
  dir.push({ ...entry, email: entry.email.trim().toLowerCase() });
  saveDirectory(dir);
}

// ---- account records ----

export function loadAccount(id: string): AccountRecord | null {
  if (id === SAMPLE_ID) return loadSampleAccount();
  try {
    const raw = localStorage.getItem(acctKey(id));
    return raw ? (JSON.parse(raw) as AccountRecord) : null;
  } catch {
    return null;
  }
}

export function saveAccount(rec: AccountRecord): void {
  try {
    localStorage.setItem(acctKey(rec.business.id), JSON.stringify(rec));
    if (!rec.business.isSample) {
      upsertDirectory({
        email: rec.business.email,
        id: rec.business.id,
        name: rec.business.name,
      });
    }
  } catch {
    /* ignore — in-memory state still drives the session */
  }
}

/** Create a fresh, empty account for a newly onboarded business. */
export function createAccount(
  email: string,
  now: number,
): AccountRecord {
  const business: Business = {
    id: newId(),
    email: email.trim().toLowerCase(),
    name: "",
    city: "",
    country: "",
    createdAt: now,
  };
  return { business, suppliers: [], corridors: [], offerAccepted: false, prevScore: 0 };
}

// ---- sample account (the "explore with sample data" path) ----

const DAY = 86_400_000;

function corridor(c: Omit<Corridor, "amountUsdc">): Corridor {
  return { ...c, amountUsdc: makeCorridorUsdc(c.amountAed) };
}

const SAMPLE_SUPPLIER: Supplier = {
  id: "sup_meridian",
  name: "Meridian Components",
  city: "Shenzhen",
  country: "China",
};

/** Pre-seeded demo workspace: a real-looking importer mid-flywheel, so a judge
 *  sees the whole loop in one click. Rebuilt fresh each time it's entered. */
export function loadSampleAccount(now: number = Date.now()): AccountRecord {
  const business: Business = {
    id: SAMPLE_ID,
    email: "sample@dhow.network",
    name: "Al Noor Trading",
    city: "Dubai",
    country: "UAE",
    walletAddress: "0x9F4c…2A1b",
    createdAt: now - 90 * DAY,
    isSample: true,
  };

  const corridors: Corridor[] = [
    corridor({
      id: "cor_0312",
      ref: "DHW-0312",
      supplier: SAMPLE_SUPPLIER,
      goods: "Auto components, 1 × 40ft",
      amountAed: 312_000,
      mode: "prooflock",
      status: "settled",
      proof: {
        status: "attested",
        label: "Bill of lading · Jebel Ali inbound",
        attestedBy: "Gulf Inspectorate",
      },
      createdAt: now - 31 * DAY,
      settledAt: now - 28 * DAY,
      txHash: "0x7d1a…e4c0",
      txState: "confirmed",
    }),
    corridor({
      id: "cor_0268",
      ref: "DHW-0268",
      supplier: SAMPLE_SUPPLIER,
      goods: "Bearings & fasteners",
      amountAed: 268_000,
      mode: "open",
      status: "settled",
      createdAt: now - 12 * DAY,
      settledAt: now - 11 * DAY,
      txHash: "0x3b9f…81aa",
      txState: "confirmed",
    }),
  ];

  return {
    business,
    suppliers: [SAMPLE_SUPPLIER],
    corridors,
    offerAccepted: false,
    prevScore: 0,
  };
}

export function clearSampleAccount(): void {
  try {
    localStorage.removeItem(acctKey(SAMPLE_ID));
  } catch {
    /* ignore */
  }
}
