import type { Financier } from "./credit";

/*
 * The financiers on the Dhow network — the demand side of the marketplace. A
 * borrower's request fans out to all of them, and they compete with offers, so
 * the SME gets a market rather than a single take-it-or-leave-it quote. The
 * signed-in financier surface runs as `FINANCIER` (Creek Capital); the others
 * compete on the borrower's side. This becomes a DB-backed directory in time.
 */
export const FINANCIERS: Financier[] = [
  {
    id: "fin_creek",
    name: "Creek Capital",
    blurb: "DIFC-based working-capital provider on the Dhow network.",
    appetiteAed: 250_000,
  },
  {
    id: "fin_dunes",
    name: "Dunes Trade Credit",
    blurb: "Abu Dhabi trade-finance desk, fast on clean payments.",
    appetiteAed: 180_000,
  },
  {
    id: "fin_levant",
    name: "Levant Working Capital",
    blurb: "Cross-Gulf invoice financier, keen on textile and steel flows.",
    appetiteAed: 120_000,
  },
];

/** The financier whose console this is (the signed-in side). */
export const FINANCIER: Financier = FINANCIERS[0];

export function financierById(id: string | null | undefined): Financier | undefined {
  return FINANCIERS.find((f) => f.id === id);
}
