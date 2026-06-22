/*
 * Demo seed for PREVIEW_MODE. Deterministic, dependency-free data so every nav
 * on both the importer and financier surfaces renders populated, without Privy,
 * a database, or a chain. All timestamps derive from a fixed SEED_NOW so server
 * and client render identically (no hydration drift). Local/demo only.
 */
import {
  type Corridor,
  type Counterparty,
  type SettlementMode,
  type SettlementStatus,
  type ProofStatus,
  makeCorridorUsdc,
} from "./corridor";
import type { Business, Supplier } from "./account";

export const SEED_NOW = 1_781_913_600_000; // fixed reference instant (~mid 2026)
const DAY = 86_400_000;

const EXPLORER = "https://amoy.polygonscan.com/tx/";

/** Deterministic 32-byte hex from a seed string (no Math.random). */
function fakeHash(seed: string): `0x${string}` {
  let h = "";
  for (let i = 0; i < 64; i++) {
    h += "0123456789abcdef"[(seed.charCodeAt(i % seed.length) + i * 7) % 16];
  }
  return `0x${h}` as `0x${string}`;
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

// ---- corridor builder ----

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

function build(spec: Spec): Corridor {
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
    amountUsdc: makeCorridorUsdc(spec.amountAed),
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

function corridors(specs: Spec[]): Corridor[] {
  return specs.map(build);
}

// ---- the signed-in importer's own corridors (rich, eligible) ----

export const seedBusiness: Business = {
  id: "preview",
  email: "ops@alnoor.ae",
  name: "Al Noor Trading",
  city: "Dubai",
  country: "UAE",
  walletAddress: wallet("alnoor"),
  createdAt: SEED_NOW - 120 * DAY,
};

export const seedCorridors: Corridor[] = corridors([
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
  corridors: Corridor[];
}

export const seedBorrowers: SeedBorrower[] = [
  // The signed-in importer, surfaced as an eligible borrower.
  { business: seedBusiness, corridors: seedCorridors },
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
    corridors: corridors([
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
    corridors: corridors([
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
