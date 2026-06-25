/*
 * Real brand imagery for the settlement rail. The infrastructure is named, not
 * implied: the actual Polygon and USDC marks (public/logos, real SVGs) appear
 * wherever money settles, so "settles in USDC on Polygon" is shown, not just
 * asserted. Kept tiny and inline so it reads as a trust mark, not decoration.
 */
export function ChainBadge({ label = "Settles in USDC on Polygon", className = "" }: { label?: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className="inline-flex items-center -space-x-1">
        <img src="/logos/usdc.svg" alt="USDC" width={16} height={16} className="rounded-full ring-1 ring-paper" />
        <img src="/logos/polygon.svg" alt="Polygon" width={16} height={16} className="rounded-full ring-1 ring-paper" />
      </span>
      {label && <span className="text-xs text-ink-faint">{label}</span>}
    </span>
  );
}
