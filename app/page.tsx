import Link from "next/link";
import { DhowMark } from "@/components/DhowMark";
import { LandingCta, LandingHeaderCta } from "@/components/LandingCta";
import { PartnerStrip } from "@/components/PartnerStrip";
import { HeroVisual } from "@/components/HeroVisual";

export default function Home() {
  return (
    <div className="paper-grain flex flex-1 flex-col">
      {/* top bar */}
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-2.5">
          <DhowMark className="h-6 w-6 text-teal" />
          <span className="font-display text-lg font-medium tracking-tight">Dhow</span>
        </div>
        <LandingHeaderCta />
      </header>

      {/* hero */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-16 pt-16 sm:pt-20">
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="flex items-center gap-2 text-sm text-teal-deep">
              <span className="h-1.5 w-1.5 rounded-full bg-teal" />
              Cross-border settlement on Polygon · DIFC
            </p>
            <h1 className="font-display mt-5 max-w-2xl text-5xl leading-[1.05] tracking-tight sm:text-6xl">
              Pay your suppliers today. Earn the credit to grow.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-ink-2">
              Dhow settles supplier payments in stablecoin in minutes, not days. Every settlement writes
              a verified on-chain cashflow record, and that record is what unlocks working capital.
            </p>
            <p className="mt-4 max-w-xl text-ink-3">
              We don&apos;t ask anyone to digitise trade. We pay their suppliers, and the ledger falls out.
            </p>
            <LandingCta />
            <p className="mt-3 text-sm text-ink-faint">
              Pay, settle, score, raise capital. A secure wallet is created for you on sign-up.
            </p>
          </div>
          <HeroVisual />
        </div>

        <div className="mt-14 border-t border-line pt-6">
          <p className="text-xs uppercase tracking-wide text-ink-faint">Settles in native USDC on Polygon</p>
          <PartnerStrip className="mt-4" />
        </div>
      </section>

      {/* the loop */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto grid w-full max-w-6xl gap-px bg-line sm:grid-cols-3">
          <Step
            n="01"
            title="Pay the supplier"
            body="Open settlement, or a Proof-Lock that escrows on-chain and releases when shipment proof is attested."
          />
          <Step
            n="02"
            title="The record writes itself"
            body="Each settlement lifts a Credit Score: a transparent function of volume, proof performance and cadence."
          />
          <Step
            n="03"
            title="Capital unlocks"
            body="Cross the threshold and financiers compete to fund you. They back the cashflow they can see, not an attestation they must trust."
          />
        </div>
      </section>

      {/* two sides of the marketplace — each a real door */}
      <section className="mx-auto w-full max-w-6xl px-6 py-16">
        <h2 className="font-display text-2xl tracking-tight">Two sides, one ledger</h2>
        <p className="mt-2 max-w-2xl text-ink-2">
          Importers settle and build a record. Financiers read that record and fund against it. Dhow
          matches them and takes a fee. Capital-light, and the banks become the demand side.
        </p>
        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <SideCard
            tone="teal"
            kicker="For importers"
            title="Settle now, raise capital later"
            points={[
              "Pay suppliers in USDC in minutes, at a sub-cent fee.",
              "Proof-Lock escrow releases only against an attested bill of lading.",
              "A Credit Score builds from real settlements, no paperwork.",
              "Request working capital and let financiers bid for it.",
            ]}
            href="/onboarding"
            cta="Start free →"
          />
          <SideCard
            tone="brass"
            kicker="For financiers"
            title="Underwrite cashflow you can verify"
            points={[
              "See a borrower's settled payments live, on-chain.",
              "Make and counter offers; set your rate and tenor.",
              "Fund from your own wallet, in one signed transfer.",
              "The score moves with the money, so repayment stays in view.",
            ]}
            href="/desk"
            cta="Open the console →"
          />
        </div>
      </section>

      {/* figures */}
      <section className="border-t border-line bg-surface">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-px bg-line sm:grid-cols-4">
          <Figure big="$2.5T" sub="global trade-finance gap (ADB)" />
          <Figure big="41%" sub="of SME trade-finance applications rejected, vs 7% for multinationals" />
          <Figure big="~51%" sub="of UAE crypto activity is stablecoins" />
          <Figure big="~$0.002" sub="to settle a payment on Polygon" />
        </div>
      </section>

      {/* closing entry band */}
      <section className="mx-auto w-full max-w-6xl px-6 py-20 text-center">
        <h2 className="font-display mx-auto max-w-2xl text-3xl tracking-tight sm:text-4xl">
          Settle your first payment, and start building credit that travels.
        </h2>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/onboarding"
            className="rounded-full bg-teal px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-teal-deep"
          >
            Start free →
          </Link>
          <Link
            href="/desk"
            className="rounded-full border border-line bg-surface px-6 py-3 text-sm font-medium text-ink transition-colors hover:border-line-strong"
          >
            I fund trade →
          </Link>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-8 text-sm text-ink-3">
          <div className="flex items-center gap-2">
            <DhowMark className="h-4 w-4 text-ink-faint" />
            Dhow · cross-border trade settlement on Polygon
          </div>
          <div className="flex items-center gap-4">
            <Link href="/onboarding" className="transition-colors hover:text-ink">
              Start free
            </Link>
            <Link href="/desk" className="transition-colors hover:text-ink">
              Financiers
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="bg-surface px-6 py-8">
      <p className="tnum font-mono text-xs text-teal">{n}</p>
      <p className="mt-3 font-display text-lg">{title}</p>
      <p className="mt-2 text-sm text-ink-3">{body}</p>
    </div>
  );
}

function SideCard({
  tone,
  kicker,
  title,
  points,
  href,
  cta,
}: {
  tone: "teal" | "brass";
  kicker: string;
  title: string;
  points: string[];
  href: string;
  cta: string;
}) {
  const accent = tone === "teal" ? "text-teal-deep" : "text-brass-deep";
  const dot = tone === "teal" ? "text-teal" : "text-brass";
  const btn =
    tone === "teal"
      ? "bg-teal text-white hover:bg-teal-deep"
      : "bg-brass text-white hover:bg-brass-deep";
  return (
    <div className="flex flex-col rounded-[var(--radius-card)] border border-line bg-surface p-6">
      <p className={`text-xs uppercase tracking-wide ${accent}`}>{kicker}</p>
      <p className="font-display mt-2 text-xl tracking-tight">{title}</p>
      <ul className="mt-4 flex-1 space-y-2.5">
        {points.map((p) => (
          <li key={p} className="flex gap-2.5 text-sm text-ink-2">
            <CheckIcon className={`mt-0.5 h-4 w-4 shrink-0 ${dot}`} />
            {p}
          </li>
        ))}
      </ul>
      <Link
        href={href}
        className={`mt-6 inline-block w-fit rounded-full px-5 py-2.5 text-sm font-medium transition-colors ${btn}`}
      >
        {cta}
      </Link>
    </div>
  );
}

function Figure({ big, sub }: { big: string; sub: string }) {
  return (
    <div className="bg-surface px-6 py-8">
      <p className="font-display tnum text-3xl tracking-tight text-ink">{big}</p>
      <p className="mt-1 text-sm text-ink-3">{sub}</p>
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <path d="m5 12 4.5 4.5L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
