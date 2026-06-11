"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAccount } from "@/components/CorridorProvider";
import { DhowMark } from "@/components/DhowMark";

type Step = "signin" | "business" | "supplier" | "wallet";

export default function OnboardingPage() {
  const router = useRouter();
  const {
    hydrated,
    isAuthenticated,
    isOnboarded,
    business,
    signIn,
    saveBusiness,
    addSupplier,
    connectWallet,
  } = useAccount();

  const [step, setStep] = useState<Step>("signin");

  // If an already-onboarded account is restored on arrival, skip straight into
  // the app. Gated to the signin step so completing the business step mid-flow
  // doesn't short-circuit the remaining supplier/wallet steps.
  useEffect(() => {
    if (hydrated && isAuthenticated && isOnboarded && step === "signin") {
      router.replace("/overview");
    }
  }, [hydrated, isAuthenticated, isOnboarded, step, router]);

  // form state
  const [email, setEmail] = useState("");
  const [bizName, setBizName] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [supName, setSupName] = useState("");
  const [supCity, setSupCity] = useState("");
  const [supCountry, setSupCountry] = useState("");

  function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    const { onboarded } = signIn(email);
    if (onboarded) router.replace("/overview");
    else setStep("business");
  }

  function handleBusiness(e: React.FormEvent) {
    e.preventDefault();
    saveBusiness({ name: bizName, city, country });
    setStep("supplier");
  }

  function handleSupplier(e: React.FormEvent) {
    e.preventDefault();
    addSupplier({ name: supName, city: supCity, country: supCountry });
    setStep("wallet");
  }

  function handleConnect() {
    connectWallet();
  }

  const steps: Step[] = ["signin", "business", "supplier", "wallet"];
  const stepIndex = steps.indexOf(step);

  return (
    <div className="paper-grain flex flex-1 flex-col">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <DhowMark className="h-6 w-6 text-teal" />
          <span className="font-display text-lg font-medium tracking-tight">Dhow</span>
        </Link>
        <span className="text-sm text-ink-faint">Set up your business</span>
      </header>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
        {/* progress */}
        {step !== "signin" && (
          <div className="mb-6 flex items-center gap-1.5">
            {steps.slice(1).map((s, i) => (
              <span
                key={s}
                className={`h-1 flex-1 rounded-full ${
                  i <= stepIndex - 1 ? "bg-teal" : "bg-surface-sunk"
                }`}
              />
            ))}
          </div>
        )}

        {step === "signin" && (
          <form onSubmit={handleSignIn}>
            <h1 className="font-display text-3xl tracking-tight">Start with Dhow</h1>
            <p className="mt-2 text-ink-2">
              Pay your suppliers in stablecoin and build a cashflow record that
              unlocks working capital. Use your work email to begin.
            </p>
            <Field
              label="Work email"
              type="email"
              required
              value={email}
              onChange={setEmail}
              placeholder="you@yourcompany.com"
              autoFocus
            />
            <Submit disabled={!email.trim()}>Continue</Submit>
            <p className="mt-4 text-center text-xs text-ink-faint">
              New here or returning — we&apos;ll take you to the right place.
            </p>
            <p className="mt-6 text-center text-sm text-ink-3">
              Just looking?{" "}
              <Link href="/" className="text-teal-deep underline underline-offset-2">
                Explore with sample data
              </Link>
            </p>
          </form>
        )}

        {step === "business" && (
          <form onSubmit={handleBusiness}>
            <h1 className="font-display text-3xl tracking-tight">Your business</h1>
            <p className="mt-2 text-ink-2">
              This is the importer on record — the borrower a financier sees.
            </p>
            <Field label="Business name" required value={bizName} onChange={setBizName} placeholder="e.g. Al Noor Trading" autoFocus />
            <div className="grid grid-cols-2 gap-3">
              <Field label="City" required value={city} onChange={setCity} placeholder="Dubai" />
              <Field label="Country" required value={country} onChange={setCountry} placeholder="UAE" />
            </div>
            <Submit disabled={!bizName.trim() || !city.trim() || !country.trim()}>
              Continue
            </Submit>
          </form>
        )}

        {step === "supplier" && (
          <form onSubmit={handleSupplier}>
            <h1 className="font-display text-3xl tracking-tight">Add a supplier</h1>
            <p className="mt-2 text-ink-2">
              The first counterparty you&apos;ll pay. You can add more later.
            </p>
            <Field label="Supplier name" required value={supName} onChange={setSupName} placeholder="e.g. Meridian Components" autoFocus />
            <div className="grid grid-cols-2 gap-3">
              <Field label="City" required value={supCity} onChange={setSupCity} placeholder="Shenzhen" />
              <Field label="Country" required value={supCountry} onChange={setSupCountry} placeholder="China" />
            </div>
            <Submit disabled={!supName.trim() || !supCity.trim() || !supCountry.trim()}>
              Continue
            </Submit>
          </form>
        )}

        {step === "wallet" && (
          <div>
            <h1 className="font-display text-3xl tracking-tight">Connect a wallet</h1>
            <p className="mt-2 text-ink-2">
              Settlements move in USDC on Polygon. Connect a wallet to settle from
              — your supplier is paid directly, on-chain.
            </p>

            {business?.walletAddress ? (
              <div className="mt-6 rounded-[var(--radius-card)] border border-teal/30 bg-teal-tint/50 px-5 py-4">
                <p className="text-xs uppercase tracking-wide text-ink-faint">
                  Wallet connected
                </p>
                <p className="tnum mt-1 font-mono text-lg text-teal-deep">
                  {business.walletAddress}
                </p>
              </div>
            ) : (
              <button
                onClick={handleConnect}
                className="mt-6 w-full rounded-full border border-line bg-surface py-3 text-sm font-medium text-ink transition-colors hover:border-line-strong"
              >
                Connect wallet
              </button>
            )}

            <button
              onClick={() => router.replace("/overview")}
              disabled={!business?.walletAddress}
              className="mt-3 w-full rounded-full bg-teal py-3 text-sm font-medium text-white transition-colors hover:bg-teal-deep disabled:cursor-not-allowed disabled:opacity-40"
            >
              Enter Dhow →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  placeholder,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const name = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <label className="mt-4 block">
      <span className="text-sm font-medium text-ink-2">{label}</span>
      <input
        type={type}
        name={name}
        required={required}
        value={value}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-[var(--radius-sm)] border border-line bg-surface px-3.5 py-2.5 text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-teal focus:ring-1 focus:ring-teal"
      />
    </label>
  );
}

function Submit({
  children,
  disabled,
}: {
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="mt-6 w-full rounded-full bg-teal py-3 text-sm font-medium text-white transition-colors hover:bg-teal-deep disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
