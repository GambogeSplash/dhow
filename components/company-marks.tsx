import type { ReactNode } from "react";

/*
 * Brand marks for the demo's trade counterparties. These businesses are
 * composed for the product, so we draw each a small bespoke logo (in the
 * maritime/ledger palette) instead of a generic monogram — a steel beam for the
 * mill, a blossom for Zarah, a lateen sail for the Creek financier. Avatar falls
 * back to initials for any name not in this registry.
 */

export interface CompanyMark {
  bg: string;
  fg: string;
  node: ReactNode;
}

const VERDIGRIS = "#0c7c66";
const INK = "#11202e";
const BRASS = "#b07d28";
const TEALBLUE = "#3a6b7d";
const BROWN = "#7a5230";

// All marks draw on a 24x24 grid in currentColor (set to `fg`).
const REGISTRY: Record<string, CompanyMark> = {
  // Al Noor Trading — "the light": a radiant lamp/star.
  "al-noor": {
    bg: INK,
    fg: "#e8b54e",
    node: (
      <g stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round">
        <circle cx="12" cy="12" r="3.2" />
        <path d="M12 3.5v2.4M12 18.1v2.4M3.5 12h2.4M18.1 12h2.4M6 6l1.7 1.7M16.3 16.3 18 18M18 6l-1.7 1.7M7.7 16.3 6 18" />
      </g>
    ),
  },
  // Zarah Imports — "Zahra", flower: a six-petal blossom.
  zarah: {
    bg: VERDIGRIS,
    fg: "#ffffff",
    node: (
      <g fill="currentColor">
        <circle cx="12" cy="6.4" r="2.3" />
        <circle cx="17.1" cy="9.2" r="2.3" />
        <circle cx="17.1" cy="14.8" r="2.3" />
        <circle cx="12" cy="17.6" r="2.3" />
        <circle cx="6.9" cy="14.8" r="2.3" />
        <circle cx="6.9" cy="9.2" r="2.3" />
        <circle cx="12" cy="12" r="2.6" fill={VERDIGRIS} />
      </g>
    ),
  },
  // Crescent Foods — a crescent moon over a grain.
  crescent: {
    bg: BRASS,
    fg: "#ffffff",
    node: (
      <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15.5 5.2a7.5 7.5 0 1 0 0 13.6 9 9 0 0 1 0-13.6z" fill="currentColor" stroke="none" />
        <path d="M12 14v5M12 16.5l2-1.2M12 16.5l-2-1.2" />
      </g>
    ),
  },
  // Meridian Components — a globe with a longitude meridian.
  meridian: {
    bg: INK,
    fg: "#3fbfa3",
    node: (
      <g stroke="currentColor" strokeWidth="1.5" fill="none">
        <circle cx="12" cy="12" r="8.2" />
        <ellipse cx="12" cy="12" rx="3.4" ry="8.2" />
        <path d="M3.8 12h16.4" />
      </g>
    ),
  },
  // Al-Faris Textiles — "Faris", interlaced weave.
  "al-faris": {
    bg: BROWN,
    fg: "#f3e3c8",
    node: (
      <g stroke="currentColor" strokeWidth="1.7" fill="none" strokeLinecap="round">
        <path d="M6 8.5c4.5 0 4.5 7 9 7M6 15.5c4.5 0 4.5-7 9-7" />
        <path d="M9 8.5c4.5 0 4.5 7 9 7M9 15.5c4.5 0 4.5-7 9-7" />
      </g>
    ),
  },
  // Gulf Steel Works — an I-beam cross-section.
  "gulf-steel": {
    bg: TEALBLUE,
    fg: "#ffffff",
    node: (
      <g stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round">
        <path d="M6.5 6.5h11M6.5 17.5h11M12 6.5v11" />
      </g>
    ),
  },
  // Creek Capital — a lateen sail on a creek wave (the capital persona).
  creek: {
    bg: BRASS,
    fg: "#ffffff",
    node: (
      <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 4.5v10M12 4.5 6.5 14.5H12z" fill="currentColor" stroke="none" />
        <path d="M12 4.5 17.5 14.5H12z" />
        <path d="M4 18.5c1.4 1 2.7 1 4 0s2.7-1 4 0 2.7 1 4 0" />
      </g>
    ),
  },
};

/** Map a counterparty name to its mark, or null to fall back to a monogram. */
export function getCompanyMark(name: string): CompanyMark | null {
  const s = name.toLowerCase();
  if (s.includes("noor")) return REGISTRY["al-noor"];
  if (s.includes("zarah")) return REGISTRY.zarah;
  if (s.includes("crescent")) return REGISTRY.crescent;
  if (s.includes("meridian")) return REGISTRY.meridian;
  if (s.includes("faris")) return REGISTRY["al-faris"];
  if (s.includes("gulf steel") || s.includes("gulfsteel")) return REGISTRY["gulf-steel"];
  if (s.includes("creek")) return REGISTRY.creek;
  return null;
}
