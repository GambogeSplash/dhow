import type { CSSProperties } from "react";

/*
 * Monogram avatar for businesses, suppliers, and borrowers. These are real
 * trade counterparties without public logos, so we render a deterministic
 * initial-mark in the maritime palette (the Mercury/Ramp pattern) rather than
 * inventing fake brand logos.
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
  const c = PALETTE[hash(name) % PALETTE.length];
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
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-display font-medium tracking-tight tnum ${className}`}
      style={style}
    >
      {initials(name)}
    </span>
  );
}
