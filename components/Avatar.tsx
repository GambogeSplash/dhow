import type { CSSProperties } from "react";
import { getCompanyMark } from "./company-marks";

/*
 * Avatar for businesses, suppliers, and borrowers. Known demo counterparties get
 * a bespoke brand mark (see company-marks); anything else falls back to a
 * deterministic monogram in the maritime palette (the Mercury/Ramp pattern).
 */

const PALETTE: Array<{ bg: string; fg: string }> = [
  { bg: "#0c7c66", fg: "#ffffff" }, // verdigris
  { bg: "#11202e", fg: "#faf8f3" }, // indigo ink
  { bg: "#b07d28", fg: "#ffffff" }, // brass
  { bg: "#3a6b7d", fg: "#ffffff" }, // muted teal-blue
  { bg: "#7a5230", fg: "#ffffff" }, // deep brass-brown
];

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function Avatar({
  name,
  size = 36,
  className = "",
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const mark = getCompanyMark(name);
  const c = mark ?? PALETTE[hash(name) % PALETTE.length];
  const style: CSSProperties = {
    width: size,
    height: size,
    backgroundColor: c.bg,
    color: c.fg,
    fontSize: Math.round(size * 0.38),
  };
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-display font-medium tracking-tight tnum ${className}`}
      style={style}
    >
      {mark ? (
        <svg viewBox="0 0 24 24" width={Math.round(size * 0.62)} height={Math.round(size * 0.62)} aria-hidden>
          {mark.node}
        </svg>
      ) : (
        initials(name)
      )}
    </span>
  );
}
