import type { Financier } from "./corridor";

/*
 * Launch financier on the Dhow network — the demand side of the marketplace.
 * A single configured working-capital provider for now; this becomes a
 * DB-backed, multi-financier directory as the financier product surface grows.
 */
export const FINANCIER: Financier = {
  id: "fin_creek",
  name: "Creek Capital",
  blurb: "DIFC-based working-capital provider on the Dhow network.",
  appetiteAed: 250_000,
};
