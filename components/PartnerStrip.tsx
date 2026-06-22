import Image from "next/image";

/*
 * The settlement-rail credibility strip. Real marks for the chain and the
 * stablecoin Dhow settles in, so the landing states the substrate plainly:
 * native USDC on Polygon. Logos live in public/logos (real brand SVGs).
 */

const RAILS: Array<{ src: string; label: string }> = [
  { src: "/logos/polygon.svg", label: "Polygon" },
  { src: "/logos/usdc.svg", label: "USDC" },
  { src: "/logos/circle.svg", label: "Circle" },
  { src: "/logos/ethereum.svg", label: "EVM" },
];

export function PartnerStrip({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-8 gap-y-4 ${className}`}>
      {RAILS.map((r) => (
        <span key={r.label} className="inline-flex items-center gap-2 text-ink-3">
          <Image src={r.src} alt={r.label} width={22} height={22} className="opacity-80" />
          <span className="text-sm font-medium">{r.label}</span>
        </span>
      ))}
    </div>
  );
}
