import { Corridor, Financier, Importer, makeCorridorUsdc } from "./corridor";

export const IMPORTER: Importer = {
  id: "imp_alnoor",
  name: "Al Noor Trading",
  city: "Dubai",
  country: "UAE",
  walletPreview: "0x9F4c…2A1b",
};

export const FINANCIER: Financier = {
  id: "fin_creek",
  name: "Creek Capital",
  blurb: "DIFC-based working-capital provider on the Dhow network.",
  appetiteAed: 250_000,
};

export const SUPPLIER_MERIDIAN = {
  id: "sup_meridian",
  name: "Meridian Components",
  city: "Shenzhen",
  country: "China",
};

const DAY = 86_400_000;

function corridor(c: Omit<Corridor, "amountUsdc">): Corridor {
  return { ...c, amountUsdc: makeCorridorUsdc(c.amountAed) };
}

/** Initial ledger: two prior settled corridors. `now` injected for stable timing. */
export function initialCorridors(now: number): Corridor[] {
  return [
    corridor({
      id: "cor_0312",
      ref: "DHW-0312",
      supplier: SUPPLIER_MERIDIAN,
      goods: "Auto components — 1 × 40ft",
      amountAed: 312_000,
      mode: "prooflock",
      status: "settled",
      proof: {
        status: "attested",
        label: "Bill of lading — Jebel Ali inbound",
        attestedBy: "Gulf Inspectorate",
      },
      createdAt: now - 31 * DAY,
      settledAt: now - 28 * DAY,
      txHash: "0x7d1a…e4c0",
    }),
    corridor({
      id: "cor_0268",
      ref: "DHW-0268",
      supplier: SUPPLIER_MERIDIAN,
      goods: "Bearings & fasteners",
      amountAed: 268_000,
      mode: "open",
      status: "settled",
      createdAt: now - 12 * DAY,
      settledAt: now - 11 * DAY,
      txHash: "0x3b9f…81aa",
    }),
  ];
}

/** The corridor the demo composes and sends (kept separate so it's easy to reset). */
export function demoDraft(now: number): Corridor {
  return corridor({
    id: "cor_0412",
    ref: "DHW-0412",
    supplier: SUPPLIER_MERIDIAN,
    goods: "Auto components — 2 × 40ft",
    amountAed: 412_000,
    mode: "prooflock",
    status: "draft",
    proof: {
      status: "awaiting",
      label: "Bill of lading — Jebel Ali inbound",
    },
    createdAt: now,
  });
}
