/*
 * Demo seed for PREVIEW_MODE. Deterministic, dependency-free data so every nav
 * on both the importer and financier surfaces renders populated, without Privy,
 * a database, or a chain. All timestamps derive from a fixed SEED_NOW so server
 * and client render identically (no hydration drift). Local/demo only.
 */
import {
  type Payment,
  type Counterparty,
  type SettlementMode,
  type SettlementStatus,
  type ProofStatus,
  makeUsdc,
} from "./credit";
import type { Business, Supplier } from "./account";
import type { Receivable } from "./credit";
import { type Deal, type DealTerms, dueAt } from "./deal";

export const SEED_NOW = 1_781_913_600_000; // fixed reference instant (~mid 2026)
const DAY = 86_400_000;

export const EXPLORER = "https://amoy.polygonscan.com/tx/";

/** Deterministic 32-byte hex from a seed string (no Math.random). */
function fakeHash(seed: string): `0x${string}` {
  let h = "";
  for (let i = 0; i < 64; i++) {
    h += "0123456789abcdef"[(seed.charCodeAt(i % seed.length) + i * 7) % 16];
  }
  return `0x${h}` as `0x${string}`;
}

/** A fresh synthetic tx for preview-mode actions. Event-handler only (uses
 *  randomness), so it never runs during SSR/hydration. */
export function previewTx(): { txHash: `0x${string}`; explorerUrl: string } {
  const seed = `${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random()}`;
  const txHash = fakeHash(seed);
  return { txHash, explorerUrl: `${EXPLORER}${txHash}` };
}

function wallet(seed: string): string {
  return fakeHash(seed).slice(0, 42);
}

// ---- counterparties ----

export const seedSuppliers: Supplier[] = [
  {
    id: "sup_meridian",
    name: "Meridian Components",
    city: "Shenzhen",
    country: "China",
    walletAddress: wallet("meridian"),
  },
  {
    id: "sup_alfaris",
    name: "Al-Faris Textiles",
    city: "Istanbul",
    country: "Turkey",
    walletAddress: wallet("alfaris"),
  },
  {
    id: "sup_gulfsteel",
    name: "Gulf Steel Works",
    city: "Dammam",
    country: "Saudi Arabia",
    walletAddress: wallet("gulfsteel"),
  },
];

const SUP = Object.fromEntries(seedSuppliers.map((s) => [s.id, s])) as Record<string, Counterparty>;

// ---- payment builder ----

interface Spec {
  ref: string;
  supplierId: string;
  goods: string;
  amountAed: number;
  mode: SettlementMode;
  status: SettlementStatus;
  daysAgo: number; // settled/created offset from SEED_NOW
  proof?: { status: ProofStatus; label: string; attestedBy?: string };
}

function build(spec: Spec): Payment {
  const settled = spec.status === "settled";
  const at = SEED_NOW - spec.daysAgo * DAY;
  const onChain = spec.status !== "draft";
  const hash = onChain ? fakeHash(spec.ref) : undefined;
  return {
    id: spec.ref.toLowerCase(),
    ref: spec.ref,
    supplier: SUP[spec.supplierId],
    goods: spec.goods,
    amountAed: spec.amountAed,
    amountUsdc: makeUsdc(spec.amountAed),
    mode: spec.mode,
    status: spec.status,
    proof: spec.proof,
    createdAt: at - (settled ? 2 * DAY : 0),
    settledAt: settled ? at : undefined,
    txHash: hash,
    explorerUrl: hash ? `${EXPLORER}${hash}` : undefined,
    txState: settled || spec.status === "locked" ? "confirmed" : undefined,
  };
}

function payments(specs: Spec[]): Payment[] {
  return specs.map(build);
}

// ---- the signed-in importer's own payments (rich, eligible) ----

export const seedBusiness: Business = {
  id: "al-noor-trading",
  email: "ops@alnoor.ae",
  name: "Al Noor Trading",
  city: "Dubai",
  country: "UAE",
  walletAddress: wallet("alnoor"),
  createdAt: SEED_NOW - 120 * DAY,
};

// One expected (unverified) receivable so the Capital page can demonstrate the
// flow: verify it → an attested obligation appears → the secured line unlocks.
export const seedReceivables: Receivable[] = [
  {
    id: "rcv_aurora",
    debtor: { id: "dbt_aurora", name: "Aurora Retail Group", city: "Abu Dhabi", country: "AE" },
    amountAed: 300_000,
    dueAt: SEED_NOW + 45 * DAY,
    status: "expected",
  },
];

export const seedPayments: Payment[] = payments([
  {
    ref: "DHW-0419",
    supplierId: "sup_gulfsteel",
    goods: "Cold-rolled steel coil",
    amountAed: 275_000,
    mode: "prooflock",
    status: "locked",
    daysAgo: 1,
    proof: { status: "awaiting", label: "Bill of lading — Jebel Ali inbound" },
  },
  {
    ref: "DHW-0418",
    supplierId: "sup_meridian",
    goods: "PCB assemblies",
    amountAed: 240_000,
    mode: "prooflock",
    status: "settled",
    daysAgo: 3,
    proof: { status: "attested", label: "Bill of lading — Jebel Ali inbound", attestedBy: "Gulf Inspectorate" },
  },
  {
    ref: "DHW-0417",
    supplierId: "sup_alfaris",
    goods: "Cotton roll, 240 GSM",
    amountAed: 180_000,
    mode: "open",
    status: "settled",
    daysAgo: 9,
  },
  {
    ref: "DHW-0416",
    supplierId: "sup_gulfsteel",
    goods: "Galvanised sheet",
    amountAed: 320_000,
    mode: "prooflock",
    status: "settled",
    daysAgo: 15,
    proof: { status: "attested", label: "Inspection cert — Dammam load", attestedBy: "Gulf Inspectorate" },
  },
  {
    ref: "DHW-0415",
    supplierId: "sup_meridian",
    goods: "Connector housings",
    amountAed: 150_000,
    mode: "open",
    status: "settled",
    daysAgo: 24,
  },
  {
    ref: "DHW-0414",
    supplierId: "sup_alfaris",
    goods: "Dyed yarn cones",
    amountAed: 210_000,
    mode: "prooflock",
    status: "settled",
    daysAgo: 33,
    proof: { status: "attested", label: "Bill of lading — Mersin departure", attestedBy: "Gulf Inspectorate" },
  },
  {
    ref: "DHW-0413",
    supplierId: "sup_gulfsteel",
    goods: "Rebar bundles",
    amountAed: 160_000,
    mode: "prooflock",
    status: "settled",
    daysAgo: 41,
    proof: { status: "attested", label: "Inspection cert — Dammam load", attestedBy: "Gulf Inspectorate" },
  },
  {
    ref: "DHW-0412",
    supplierId: "sup_meridian",
    goods: "Sensor modules (disputed)",
    amountAed: 90_000,
    mode: "prooflock",
    status: "refunded",
    daysAgo: 50,
    proof: { status: "failed", label: "Proof not attested before deadline" },
  },
]);

// ---- financier-side borrowers (the demand side reads these) ----

export interface SeedBorrower {
  business: Business;
  payments: Payment[];
}

export const seedBorrowers: SeedBorrower[] = [
  // The signed-in importer, surfaced as an eligible borrower.
  { business: seedBusiness, payments: seedPayments },
  // A second eligible borrower.
  {
    business: {
      id: "zarah-imports",
      email: "finance@zarah.ae",
      name: "Zarah Imports",
      city: "Sharjah",
      country: "UAE",
      walletAddress: wallet("zarah"),
      createdAt: SEED_NOW - 90 * DAY,
    },
    payments: payments([
      { ref: "ZRH-0220", supplierId: "sup_alfaris", goods: "Linen bolts", amountAed: 190_000, mode: "prooflock", status: "settled", daysAgo: 5, proof: { status: "attested", label: "Bill of lading", attestedBy: "Gulf Inspectorate" } },
      { ref: "ZRH-0219", supplierId: "sup_alfaris", goods: "Cotton roll", amountAed: 140_000, mode: "open", status: "settled", daysAgo: 18 },
      { ref: "ZRH-0218", supplierId: "sup_meridian", goods: "Trim hardware", amountAed: 120_000, mode: "prooflock", status: "settled", daysAgo: 30, proof: { status: "attested", label: "Inspection cert", attestedBy: "Gulf Inspectorate" } },
      { ref: "ZRH-0217", supplierId: "sup_alfaris", goods: "Dyed yarn", amountAed: 110_000, mode: "open", status: "settled", daysAgo: 44 },
    ]),
  },
  // A borrower still establishing (shows in Opportunities, not the Desk).
  {
    business: {
      id: "crescent-foods",
      email: "ap@crescentfoods.ae",
      name: "Crescent Foods",
      city: "Abu Dhabi",
      country: "UAE",
      walletAddress: wallet("crescent"),
      createdAt: SEED_NOW - 40 * DAY,
    },
    payments: payments([
      { ref: "CRS-0107", supplierId: "sup_gulfsteel", goods: "Canning line spares", amountAed: 95_000, mode: "open", status: "settled", daysAgo: 7 },
      { ref: "CRS-0106", supplierId: "sup_meridian", goods: "Label printers", amountAed: 60_000, mode: "prooflock", status: "settled", daysAgo: 26, proof: { status: "attested", label: "Bill of lading", attestedBy: "Gulf Inspectorate" } },
    ]),
  },
];

// ---- one already-funded facility (populates the financier Portfolio) ----

export const seedFacility = {
  borrowerId: "zarah-imports",
  borrowerName: "Zarah Imports",
  amountAed: 24_000,
  fundedAt: SEED_NOW - 6 * DAY,
  txHash: fakeHash("facility-zarah"),
  explorerUrl: `${EXPLORER}${fakeHash("facility-zarah")}`,
  repaid: false,
};

// ---- seed deals (the working-capital negotiation, both sides) ----
// Deterministic event ids/timestamps so preview renders identically on server
// and client (no hydration drift). The same al-Noor deal appears to the importer
// (their offer to act on) and to the financier (an offer they've sent).

const REQ_TERMS: DealTerms = { amountAed: 40_000, ratePct: 1.5, tenorDays: 30 };
const REQ_PURPOSE = "Bridge the Gulf Steel shipment while Jebel Ali clears.";

/** Al Noor's open request — it fans out to every financier on the network. */
export const seedImporterRequest: Deal = {
  id: "deal_alnoor_req",
  borrowerId: "al-noor-trading",
  borrowerName: "Al Noor Trading",
  financierId: null,
  financierName: null,
  status: "requested",
  turn: "financier",
  terms: REQ_TERMS,
  purpose: REQ_PURPOSE,
  createdAt: SEED_NOW - 2 * DAY,
  updatedAt: SEED_NOW - 2 * DAY,
  events: [
    { id: "ev_alnoor_req", actor: "borrower", kind: "requested", terms: REQ_TERMS, note: REQ_PURPOSE, createdAt: SEED_NOW - 2 * DAY },
  ],
};

/** A competing bid against Al Noor's request (deterministic ids, no hydration drift). */
function seedBid(args: {
  id: string;
  financierId: string;
  financierName: string;
  terms: DealTerms;
  note: string;
  offeredAt: number;
}): Deal {
  return {
    id: args.id,
    borrowerId: "al-noor-trading",
    borrowerName: "Al Noor Trading",
    financierId: args.financierId,
    financierName: args.financierName,
    status: "offered",
    turn: "borrower",
    terms: args.terms,
    purpose: REQ_PURPOSE,
    requestId: seedImporterRequest.id,
    createdAt: args.offeredAt,
    updatedAt: args.offeredAt,
    events: [
      { id: `${args.id}_req`, actor: "borrower", kind: "requested", terms: REQ_TERMS, note: REQ_PURPOSE, createdAt: SEED_NOW - 2 * DAY },
      { id: `${args.id}_off`, actor: "financier", kind: "offered", terms: args.terms, note: args.note, createdAt: args.offeredAt },
    ],
  };
}

const bidCreek = seedBid({
  id: "deal_alnoor_creek",
  financierId: "fin_creek",
  financierName: "Creek Capital",
  terms: { amountAed: 36_000, ratePct: 1.5, tenorDays: 30 },
  note: "Sized to your average payment. Happy to revisit on a clean release.",
  offeredAt: SEED_NOW - 1 * DAY,
});
const bidDunes = seedBid({
  id: "deal_alnoor_dunes",
  financierId: "fin_dunes",
  financierName: "Dunes Trade Credit",
  terms: { amountAed: 38_000, ratePct: 1.8, tenorDays: 45 },
  note: "A little more, a little longer to repay.",
  offeredAt: SEED_NOW - 20 * 3_600_000,
});
const bidLevant = seedBid({
  id: "deal_alnoor_levant",
  financierId: "fin_levant",
  financierName: "Levant Working Capital",
  terms: { amountAed: 34_000, ratePct: 1.3, tenorDays: 30 },
  note: "Our keenest rate on steel flows.",
  offeredAt: SEED_NOW - 16 * 3_600_000,
});

/** A live facility Al Noor already drew — funds the auto-repay prompt + facility view. */
export const seedImporterFunded: Deal = {
  id: "deal_alnoor_funded",
  borrowerId: "al-noor-trading",
  borrowerName: "Al Noor Trading",
  financierId: "fin_creek",
  financierName: "Creek Capital",
  status: "funded",
  turn: "borrower",
  terms: { amountAed: 30_000, ratePct: 1.5, tenorDays: 30 },
  purpose: "Earlier steel payment.",
  financierWallet: wallet("creek-capital"),
  fundedAt: SEED_NOW - 12 * DAY,
  txHash: fakeHash("facility-alnoor"),
  explorerUrl: `${EXPLORER}${fakeHash("facility-alnoor")}`,
  dueAt: dueAt(SEED_NOW - 12 * DAY, 30),
  createdAt: SEED_NOW - 14 * DAY,
  updatedAt: SEED_NOW - 12 * DAY,
  events: [
    { id: "ev_alf_req", actor: "borrower", kind: "requested", terms: { amountAed: 30_000, ratePct: 1.5, tenorDays: 30 }, createdAt: SEED_NOW - 14 * DAY },
    { id: "ev_alf_off", actor: "financier", kind: "offered", terms: { amountAed: 30_000, ratePct: 1.5, tenorDays: 30 }, createdAt: SEED_NOW - 13 * DAY },
    { id: "ev_alf_agr", actor: "borrower", kind: "agreed", terms: { amountAed: 30_000, ratePct: 1.5, tenorDays: 30 }, createdAt: SEED_NOW - 12 * DAY - 3_600_000 },
    { id: "ev_alf_fund", actor: "financier", kind: "funded", terms: { amountAed: 30_000, ratePct: 1.5, tenorDays: 30 }, createdAt: SEED_NOW - 12 * DAY },
  ],
};

/** A closed, repaid facility — populates the importer's deal history. */
export const seedImporterClosed: Deal = {
  id: "deal_alnoor_closed",
  borrowerId: "al-noor-trading",
  borrowerName: "Al Noor Trading",
  financierId: "fin_creek",
  financierName: "Creek Capital",
  status: "repaid",
  turn: "borrower",
  terms: { amountAed: 22_000, ratePct: 1.5, tenorDays: 30 },
  fundedAt: SEED_NOW - 60 * DAY,
  dueAt: dueAt(SEED_NOW - 60 * DAY, 30),
  repaidAt: SEED_NOW - 33 * DAY,
  txHash: fakeHash("facility-alnoor-old"),
  explorerUrl: `${EXPLORER}${fakeHash("facility-alnoor-old")}`,
  repayTxHash: fakeHash("repay-alnoor-old"),
  repayExplorerUrl: `${EXPLORER}${fakeHash("repay-alnoor-old")}`,
  createdAt: SEED_NOW - 62 * DAY,
  updatedAt: SEED_NOW - 33 * DAY,
  events: [
    { id: "ev_alc_off", actor: "financier", kind: "offered", terms: { amountAed: 22_000, ratePct: 1.5, tenorDays: 30 }, createdAt: SEED_NOW - 61 * DAY },
    { id: "ev_alc_agr", actor: "borrower", kind: "agreed", terms: { amountAed: 22_000, ratePct: 1.5, tenorDays: 30 }, createdAt: SEED_NOW - 60 * DAY },
    { id: "ev_alc_fund", actor: "financier", kind: "funded", terms: { amountAed: 22_000, ratePct: 1.5, tenorDays: 30 }, createdAt: SEED_NOW - 60 * DAY },
    { id: "ev_alc_repaid", actor: "borrower", kind: "repaid", terms: { amountAed: 22_000, ratePct: 1.5, tenorDays: 30 }, createdAt: SEED_NOW - 33 * DAY },
  ],
};

/** A fresh request on the desk, no financier engaged yet. */
const seedRequestCrescent: Deal = {
  id: "deal_crescent",
  borrowerId: "crescent-foods",
  borrowerName: "Crescent Foods",
  financierId: null,
  financierName: null,
  status: "requested",
  turn: "financier",
  terms: { amountAed: 12_000, ratePct: 1.5, tenorDays: 30 },
  purpose: "Cover the canning-line spares while the season ramps.",
  createdAt: SEED_NOW - 6 * 3_600_000,
  updatedAt: SEED_NOW - 6 * 3_600_000,
  events: [
    {
      id: "ev_crescent_req",
      actor: "borrower",
      kind: "requested",
      terms: { amountAed: 12_000, ratePct: 1.5, tenorDays: 30 },
      note: "Cover the canning-line spares while the season ramps.",
      createdAt: SEED_NOW - 6 * 3_600_000,
    },
  ],
};

/** A funded, live facility — populates the financier portfolio. */
const seedFundedZarah: Deal = {
  id: "deal_zarah",
  borrowerId: "zarah-imports",
  borrowerName: "Zarah Imports",
  financierId: "fin_creek",
  financierName: "Creek Capital",
  status: "funded",
  turn: "borrower",
  terms: { amountAed: 24_000, ratePct: 1.5, tenorDays: 30 },
  purpose: "Bridge linen shipment.",
  fundedAt: SEED_NOW - 6 * DAY,
  txHash: fakeHash("facility-zarah"),
  explorerUrl: `${EXPLORER}${fakeHash("facility-zarah")}`,
  dueAt: dueAt(SEED_NOW - 6 * DAY, 30),
  createdAt: SEED_NOW - 8 * DAY,
  updatedAt: SEED_NOW - 6 * DAY,
  events: [
    { id: "ev_zarah_req", actor: "borrower", kind: "requested", terms: { amountAed: 24_000, ratePct: 1.5, tenorDays: 30 }, createdAt: SEED_NOW - 8 * DAY },
    { id: "ev_zarah_off", actor: "financier", kind: "offered", terms: { amountAed: 24_000, ratePct: 1.5, tenorDays: 30 }, createdAt: SEED_NOW - 7 * DAY },
    { id: "ev_zarah_agr", actor: "borrower", kind: "agreed", terms: { amountAed: 24_000, ratePct: 1.5, tenorDays: 30 }, createdAt: SEED_NOW - 6 * DAY - 3_600_000 },
    { id: "ev_zarah_fund", actor: "financier", kind: "funded", terms: { amountAed: 24_000, ratePct: 1.5, tenorDays: 30 }, createdAt: SEED_NOW - 6 * DAY },
  ],
};

/** Al Noor's competing bids (the multi-financier hero on the importer side). */
export const seedImporterBids: Deal[] = [bidCreek, bidDunes, bidLevant];

/** All deals the financier (Creek Capital) preview surfaces: its own bid on Al
 *  Noor, the funded Zarah facility, and Crescent's open request to bid on. The
 *  rival bids from Dunes/Levant stay on the borrower's side, not Creek's. */
export const seedFinancierDeals: Deal[] = [bidCreek, seedFundedZarah, seedRequestCrescent];

/** The importer (Al Noor) preview's own deals: an open request with three
 *  competing offers, a live facility, and one repaid in the past. */
export const seedImporterDeals: Deal[] = [
  seedImporterRequest,
  ...seedImporterBids,
  seedImporterFunded,
  seedImporterClosed,
];
