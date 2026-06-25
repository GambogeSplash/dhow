import { Avatar } from "@/components/Avatar";
import { ChainBadge } from "@/components/ChainBadge";

/*
 * Landing hero imagery: a static, on-brand snapshot of the product telling the
 * pay -> score -> capital story in one frame. Server-rendered (no client JS) so
 * the marketing page stays fast. Real company marks and the real Polygon/USDC
 * logos, so it reads as the product, not a stock illustration.
 */
export function HeroVisual() {
  return (
    <div className="relative">
      {/* settlement card */}
      <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="tnum font-mono text-xs text-ink-faint">DHW-0418</span>
          <span className="rounded-full bg-teal-tint px-2 py-0.5 text-[11px] font-medium text-teal-deep">
            Settled
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar name="Meridian Components" size={40} />
            <div>
              <p className="font-medium">Meridian Components</p>
              <p className="text-sm text-ink-3">Shenzhen, China · PCB assemblies</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-display tnum text-xl">AED 240,000</p>
            <p className="tnum font-mono text-xs text-ink-faint">65,350.58 USDC</p>
          </div>
        </div>
        <div className="mt-3 border-t border-line pt-3">
          <ChainBadge label="Released against an attested bill of lading" />
        </div>
      </div>

      {/* score lift */}
      <div className="mt-4 rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-sm">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-faint">Credit Score</p>
            <p className="font-display tnum mt-1 text-4xl leading-none tracking-tight text-teal-deep">85</p>
          </div>
          <span className="rounded-full bg-teal-tint px-2.5 py-1 text-xs font-medium text-teal-deep">Preferred</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-sunk">
          <div className="h-full rounded-full bg-teal" style={{ width: "85%" }} />
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-ink-faint">
          <span>Establishing</span>
          <span>Eligible at 70</span>
        </div>
      </div>

      {/* capital chip */}
      <div className="mt-4 flex items-center justify-between rounded-[var(--radius-card)] border border-brass/40 bg-brass-tint px-5 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Avatar name="Creek Capital" size={36} />
          <div>
            <p className="text-xs uppercase tracking-wide text-brass-deep">Working capital</p>
            <p className="font-medium text-brass-deep">Offer to review</p>
          </div>
        </div>
        <p className="font-display tnum text-2xl text-brass-deep">AED 36,000</p>
      </div>
    </div>
  );
}
