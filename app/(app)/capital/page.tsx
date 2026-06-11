"use client";

import Link from "next/link";
import { useCorridor } from "@/components/CorridorProvider";
import { aed, ELIGIBLE_THRESHOLD } from "@/lib/corridor";

export default function CapitalPage() {
  const { score, offerAed, offerAccepted, acceptOffer, financier, importer } =
    useCorridor();

  if (!score.eligible) {
    return (
      <div className="mx-auto max-w-xl">
        <p className="text-sm text-ink-3">Capital</p>
        <h1 className="font-display mt-1 text-3xl tracking-tight">
          Working capital
        </h1>
        <div className="mt-6 rounded-[var(--radius-card)] border border-line bg-surface p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface-sunk">
            <LockIcon />
          </div>
          <p className="mt-4 font-medium">Not yet unlocked</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-ink-3">
            Capital unlocks once your Corridor Score crosses{" "}
            {ELIGIBLE_THRESHOLD}. You&apos;re at {score.score} — settle another
            corridor to get there.
          </p>
          <Link
            href="/corridor"
            className="mt-5 inline-block rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper"
          >
            View Corridor Record →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* offer / importer side */}
      <section>
        <p className="text-sm text-ink-3">Capital</p>
        <h1 className="font-display mt-1 text-3xl tracking-tight">
          {offerAccepted ? "Capital landed" : "Your offer"}
        </h1>
        <p className="mt-2 text-ink-2">
          Sized to bridge one shipment&apos;s cash gap, against your settled
          corridor history.
        </p>

        <div className="mt-6 overflow-hidden rounded-[var(--radius-card)] border border-brass/40 bg-surface">
          <div className="bg-brass-tint px-6 py-6">
            <p className="text-xs uppercase tracking-wide text-brass-deep">
              Working capital available
            </p>
            <p className="font-display tnum mt-1 text-5xl tracking-tight text-brass-deep">
              {aed(offerAed)}
            </p>
            <p className="mt-1 text-sm text-ink-3">
              Offered by {financier.name}
            </p>
          </div>

          <dl className="divide-y divide-line px-6">
            <Term k="Facility" v="Single-shipment advance" />
            <Term k="Against" v={`${score.settledCount} settled corridors`} />
            <Term k="Fee" v="1.5% on draw · repaid from next settlement" />
            <Term k="Risk" v="Carried by Creek Capital, not Dhow" />
          </dl>

          <div className="px-6 py-5">
            {offerAccepted ? (
              <div className="rise flex items-center gap-3 rounded-[var(--radius-card)] bg-teal-tint px-4 py-3">
                <CheckIcon />
                <div>
                  <p className="font-medium text-teal-deep">
                    {aed(offerAed)} disbursed to {importer.name}
                  </p>
                  <p className="text-sm text-ink-3">
                    Settled on Polygon · repays from corridor DHW-0412
                  </p>
                </div>
              </div>
            ) : (
              <button
                onClick={acceptOffer}
                className="w-full rounded-full bg-brass py-3 text-sm font-medium text-white transition-colors hover:bg-brass-deep"
              >
                Accept {aed(offerAed)}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* financier side */}
      <section>
        <p className="text-sm text-ink-3">What {financier.name} sees</p>
        <h2 className="font-display mt-1 text-2xl tracking-tight">
          A borrower banks reject — made legible
        </h2>
        <p className="mt-2 text-ink-2">{financier.blurb}</p>

        <div className="mt-6 rounded-[var(--radius-card)] border border-line bg-surface p-6">
          <div className="flex items-center justify-between border-b border-line pb-4">
            <div>
              <p className="font-medium">{importer.name}</p>
              <p className="text-sm text-ink-3">
                {importer.city}, {importer.country}
              </p>
            </div>
            <div className="text-right">
              <p className="tnum font-display text-2xl text-teal-deep">
                {score.score}
              </p>
              <p className="text-xs text-ink-faint">Corridor Score</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 py-4">
            <Metric
              label="Verified settled volume"
              value={aed(score.trailingValueAed)}
            />
            <Metric
              label="Proof performance"
              value={`${Math.round(score.proofMetRatio * 100)}% clean`}
            />
            <Metric
              label="Avg corridor"
              value={aed(score.avgCorridorAed)}
            />
            <Metric
              label="Data"
              value="Live on-chain feed"
              accent
            />
          </div>

          <p className="border-t border-line pt-4 text-sm text-ink-2">
            Every figure here is a payment Dhow settled and verified on-chain.
            Creek Capital underwrites the cashflow it can see, not an
            attestation it has to trust. The feed stays live only while Al Noor
            keeps settling on Dhow.
          </p>
        </div>
      </section>
    </div>
  );
}

function Term({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between py-3 text-sm">
      <dt className="text-ink-3">{k}</dt>
      <dd className="font-medium text-ink">{v}</dd>
    </div>
  );
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-ink-faint">{label}</p>
      <p
        className={`tnum mt-0.5 font-medium ${
          accent ? "text-teal-deep" : "text-ink"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-ink-3" fill="none">
      <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0 text-teal" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="m8.5 12 2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
