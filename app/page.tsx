import { DhowMark } from "@/components/DhowMark";
import { LandingCta, LandingHeaderCta } from "@/components/LandingCta";

export default function Home() {
  return (
    <div className="paper-grain flex flex-1 flex-col">
      {/* top bar */}
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-2.5">
          <DhowMark className="h-6 w-6 text-teal" />
          <span className="font-display text-lg font-medium tracking-tight">
            Dhow
          </span>
        </div>
        <LandingHeaderCta />
      </header>

      {/* hero */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-16 pt-16 sm:pt-24">
        <p className="flex items-center gap-2 text-sm text-teal-deep">
          <span className="h-1.5 w-1.5 rounded-full bg-teal" />
          Cross-border settlement on Polygon · DIFC
        </p>
        <h1 className="font-display mt-5 max-w-3xl text-5xl leading-[1.05] tracking-tight sm:text-6xl">
          Settlement that makes the{" "}
          <span className="italic text-teal-deep">unfundable</span> legible.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-ink-2">
          Dhow settles supplier payments in stablecoin in minutes, not days.
          Every settlement writes a verified on-chain cashflow record that turns
          a trade history into creditworthiness.
        </p>
        <p className="mt-4 max-w-xl text-ink-3">
          We don&apos;t ask anyone to digitise trade. We pay their suppliers,
          and the ledger falls out.
        </p>
        <LandingCta />
        <p className="mt-3 text-sm text-ink-faint">
          Pay → settle → score → capital. Sign up, or explore with sample data
          first.
        </p>
      </section>

      {/* the loop */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto grid w-full max-w-6xl gap-px bg-line sm:grid-cols-3">
          <Step
            n="01"
            title="Pay the supplier"
            body="Open settlement or a Proof-Lock that escrows on-chain and releases when shipment proof is attested."
          />
          <Step
            n="02"
            title="The record writes itself"
            body="Each settlement lifts a Credit Score, a transparent function of volume, proof performance and cadence."
          />
          <Step
            n="03"
            title="Capital unlocks"
            body="Cross the threshold and Dhow surfaces you to financiers. They fund the cashflow they can see, not an attestation they must trust."
          />
        </div>
      </section>

      {/* moats */}
      <section className="mx-auto w-full max-w-6xl px-6 py-16">
        <h2 className="font-display text-2xl tracking-tight">
          Why this holds where others didn&apos;t
        </h2>
        <p className="mt-2 max-w-2xl text-ink-2">
          The bank consortia died asking corporates to change behaviour with no
          payment hook. The flywheel works because the payment comes first.
        </p>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Moat
            head="Wedge inversion"
            body="Lead with the payment; the verified ledger is exhaust, not a product we sell."
          />
          <Moat
            head="Cashflow as the primitive"
            body="We underwrite on payments we settled ourselves. Data no one can fabricate or source."
          />
          <Moat
            head="Marketplace, not balance sheet"
            body="We match de-risked SMEs to financiers and take a fee. Capital-light, and the banks become our demand side."
          />
          <Moat
            head="Compliant perimeter"
            body="DIFC-domiciled settlement in native USDC on a sub-cent chain, over an under-served trade route."
          />
        </div>
      </section>

      {/* figures */}
      <section className="border-t border-line bg-surface">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-px bg-line sm:grid-cols-4">
          <Figure big="$2.5T" sub="global trade-finance gap (ADB)" />
          <Figure big="41%" sub="SME applications rejected, vs 7% for multinationals" />
          <Figure big="~51%" sub="of UAE crypto activity is stablecoins" />
          <Figure big="~$0.002" sub="to settle a payment on Polygon" />
        </div>
      </section>

      <footer className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="flex items-center gap-2 text-sm text-ink-3">
          <DhowMark className="h-4 w-4 text-ink-faint" />
          Dhow · built for the Smart Commerce Infrastructure Challenge
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

function Moat({ head, body }: { head: string; body: string }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
      <p className="font-medium">{head}</p>
      <p className="mt-2 text-sm text-ink-3">{body}</p>
    </div>
  );
}

function Figure({ big, sub }: { big: string; sub: string }) {
  return (
    <div className="bg-surface px-6 py-8">
      <p className="font-display tnum text-3xl tracking-tight text-ink">
        {big}
      </p>
      <p className="mt-1 text-sm text-ink-3">{sub}</p>
    </div>
  );
}
