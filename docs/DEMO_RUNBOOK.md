# Demo runbook — winning the Ignyte / Polygon × DIFC challenge

What wins this meta: **a real on-chain transaction in front of the judges, and
a pitch that leads with the receipt (the verified cashflow record) — not the
actor.** Dhow's flywheel is built for exactly that. This is how to land it.

---

## A. Make it live (~15 min, do this once before judging)

1. **Privy** — create an app at dashboard.privy.io, enable Email + embedded
   wallets. Copy `NEXT_PUBLIC_PRIVY_APP_ID` + `PRIVY_APP_SECRET`.
2. **Neon** — create a Postgres DB at neon.tech, run `db/schema.sql`. Copy
   `DATABASE_URL`.
3. **Amoy addresses** (already deployed — paste as-is):
   - `NEXT_PUBLIC_USDC_ADDRESS` / `DHOW_USDC_ADDRESS` = `0x02ead55b59ef4a9717066abd697ba69c269d98c5`
   - `NEXT_PUBLIC_ESCROW_ADDRESS` / `DHOW_ESCROW_ADDRESS` = `0x1d88962f1fb52854ab90b8b5d678aeae2c744b26`
   - `DHOW_REGISTRY_ADDRESS` = `0xac0bbd6f051f31bc0a7bbf234a883f471e34947d`
   - `DHOW_EAS_ADDRESS` = `0x706c9085fba84e838a69b064fadc45495684a616`
4. **Operator key** — `DHOW_SIGNER_KEY` = the deployer/operator key (in
   `.env.amoy.local`). It signs the inspector attestation, the score-registry
   write, and the faucet. **Fund it with test POL** (Polygon faucet) so it can
   sponsor demo wallets.
5. Set all of the above as Vercel env vars (or `.env.local` for a local demo),
   redeploy / `npm run dev`.

> Local demo is the safer bet on the day — no Vercel deploy race. Run `npm run
> dev`, demo from `localhost`, keep the live URL as the landing + pitch link.

**Before you walk on stage, do one full dry run** (section C). It's where the
first real bugs surface — especially the Privy→viem signing path.

---

## B. The story (90 seconds, lead with the receipt)

1. **The trap.** "$2.5 trillion of trade finance goes unserved. Banks reject
   SMEs because they can't see their cashflow — and can't see it *because* they
   rejected them. It's circular."
2. **The inversion.** "Everyone tried to fix this by asking SMEs to digitise
   their trade. They all died. We don't ask for anything. We give them a better
   payment — stablecoin to their supplier, minutes not days — and the verified
   cashflow record falls out the back."
3. **The receipt** (show, don't tell — this is the on-chain tx). "Every
   settlement is a real payment we processed, posted on-chain. That *is* the
   underwriting primitive. Data no one can fabricate, that no one else can
   source, because we settled it."
4. **The market.** "Cross the threshold and we surface you to a financier — a
   DP World Trade Finance, whose Jebel Ali corridor is literally ours. We don't
   lend. We match, and the bank funds the cashflow it can finally see."

---

## C. The live demo flow (≈3 min — every step is real)

1. **Sign in** → Privy creates a non-custodial embedded wallet. "No seed
   phrase, no MetaMask. A real wallet, theirs."
2. **Onboard** → business + a supplier *with a wallet address*.
3. **Fund test wallet** (Send page, one tap) → operator sponsors gas + test
   USDC. "On mainnet this is a fiat on-ramp; on testnet, one tap."
4. **Pay the supplier — Proof-Lock** → **the user signs the tx themselves.**
   Open Polygonscan on the tx hash. "That's real. On Polygon. Right now."
5. **Attest + release** → shipment proof is attested, funds release to the
   supplier. Another real tx.
6. **The win moment** → watch the Credit Score lift across the eligibility
   threshold, and the **capital offer unlock**. "It didn't get asserted. It got
   *derived* — from the payment you just watched settle."
7. **Flip to the financier desk** → the same borrower now appears as a scored,
   fundable opportunity, the score read from chain.

End on the tx open in Polygonscan. The receipt is the close.

---

## D. Honesty slide (say it before a judge asks — it builds trust)

- **Real:** user-signed settlement on Polygon Amoy, EAS-gated Proof-Lock escrow,
  on-chain credit registry, real database + identity. The whole loop is live.
- **Designed, not deployed:** mainnet + real USDC (gated on a security audit and
  liquidity), KYC/AML, and a signed financier partner. Testnet first is the
  responsible default — and it's genuinely on-chain, not simulated.

A sharp judge respects "here's exactly what's real and what's next" far more
than a glossed-over claim. Don't over-claim mainnet or compliance.

---

## E. If the live demo fails

- Have a **2-minute screen recording** of the full flow with a real Polygonscan
  tx as backup.
- Keep a **funded test wallet pre-loaded** so step 3 can be skipped if the
  faucet is slow.
- Worst case, walk the recording and open the real tx hashes on Polygonscan
  live — the chain receipts are permanent proof even if the UI hiccups.
