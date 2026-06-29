# Implementation plan

The path from where Dhow is now to a contest-ready, production-credible product.
Organised by milestone, with work split across the three lanes: **Contracts**
(smart-contract dev), **Backend** (server/API/DB dev), and **Product** (frontend
and design). Read [`ONBOARDING.md`](ONBOARDING.md) for who owns what and
[`ARCHITECTURE.md`](ARCHITECTURE.md) for how the system fits together.

## Dates we are building toward

- **Application due: 2026-07-13** (Smart Commerce Infrastructure Challenge, Polygon x DIFC x Ignyte).
- **Demo Day: mid to late September 2026**, Dubai.
- Today: 2026-06-22. So roughly **three weeks to the application**, then a build runway to Demo Day.

## Where we are (honest snapshot)

- Working two-sided marketplace (importer + financier), real Privy onboarding, the full flywheel.
- **Working-capital deal lifecycle** is real: a borrower requests, financiers compete with offers, the borrower compares and accepts one (declining the rivals), the financier funds, and the borrower repays. One shared `deal` object both sides act on (`lib/deal.ts` state machine, `/api/deals`, `deals` + `deal_events` tables).
- **On-chain credit is fact-driven:** the escrow records every settlement to `DhowScoreRegistry` atomically (`recordSettlement`), and the score is computed live on-chain from those facts. No privileged off-chain poster; the score stays correct even if the backend is down. **23 passing Foundry tests.**
- User-signed settlement on Amoy (open pay / Proof-Lock / release / refund) from the Privy embedded wallet. Financier funds with a real signed USDC transfer.
- Proper workflows, not one-click stubs: confirmation flows for attest-and-release, dispute-and-refund, and accept-offer; auto-repay prompt on the next settlement.
- Product surface: modal/drawer IA (send, add supplier, deal review), motion.dev spring physics, company brand marks + real Polygon/USDC imagery, a production landing page with two real doors (importer / financier).
- Hardening: input length/charset validation (client + server), faucet rate-limit, send-time USDC balance pre-flight.
- Scoring engine is pure and shared client/server. Vitest suite green.
- `NEXT_PUBLIC_PREVIEW_MODE` serves seeded, interactive sample data locally (no Privy/DB/chain) for walkthroughs. The production path is real Privy + Neon + Amoy. **Next UX step: serve that sample data to a freshly signed-in empty account, and clear it the moment the user starts their own workspace.**

The gaps below are the work, not embarrassments. The Maturity table in
[`README.md`](../README.md) is the canonical honest read; this plan is how we close it.

---

## Milestone 0 — Live on Amoy, end to end, in front of a judge

**Goal:** a fresh user signs in with Privy, onboards, sends a Proof-Lock, the
inspector attests, the user releases, **the escrow records the settlement to the
score registry in the same transaction**, a financier funds them, and every step
shows a real Polygonscan link. This is the single most important next move: a
live transaction in front of judges beats any deck.

**Target: deploy live to the public on Vercel (Privy + Neon + Amoy).**

### Contracts
- [ ] Fund the deployer burner with test POL on Amoy (faucet.polygon.technology or alchemy.com/faucets/polygon-amoy). Burner address and key are in the gitignored `.env.amoy.local`.
- [ ] Confirm the live Amoy addresses for USDC, escrow, registry, and the attestation contract. If redeploying, use the lean reuse script when USDC + attestation already exist:
  `cd contracts && DEPLOYER_KEY=<funded> DHOW_USDC_ADDRESS=<live> DHOW_EAS_ADDRESS=<live> forge script script/DeployCore.s.sol --rpc-url https://rpc-amoy.polygon.technology/ --broadcast --slow`
- [ ] Verify contracts on Polygonscan (Amoy) so the judge can read the source. Add the verified links to the README.
- **Acceptance:** `cast` reads `scoreOf`/`isEligible` and escrow lock state on the live addresses; a manual lock + attest + release succeeds on Amoy.

### Backend
- [ ] Provision production env: `NEXT_PUBLIC_PRIVY_APP_ID`, `PRIVY_APP_SECRET`, `DATABASE_URL` (Neon), and the operator/inspector signer key for the attestation + score-post routes.
- [ ] Apply `db/schema.sql` to the production Neon database.
- [ ] Set every chain env var on Vercel (RPC, chain id 80002, USDC/escrow/registry/EAS addresses, explorer base, inspector key). See [`docs/CHAIN.md`](CHAIN.md) and [`docs/SETUP.md`](SETUP.md).
- [ ] Smoke-test each API route against the live DB + chain (`/api/account`, `/suppliers`, `/payments`, `/attest`, `/score`, `/borrowers`, `/facilities`, `/faucet`).
- **Acceptance:** the deployed app at the public URL runs the full flywheel with real txs, not the configure-notice and not preview mode.

### Product
- [ ] Confirm `NEXT_PUBLIC_PREVIEW_MODE` is OFF on Vercel (production must use the real path).
- [ ] Walk the deployed flywheel in a real browser, two windows (importer + financier), and screenshot each on-chain confirmation.
- [ ] Tighten any UI that assumes instant confirmation: show pending / confirmed / failed states honestly while a real tx mines.
- **Acceptance:** a cold run by someone who has never seen Dhow completes the loop without help.

---

## Milestone 1 — Production hardening

**Goal:** the live product is robust enough to demo repeatedly and to hand to a
stranger. Reliability, observability, and the compliance perimeter.

**Target: 2026-06-29 to 2026-07-10 (overlaps M2 doc work).**

### Contracts
- [ ] Wire canonical EAS on Amoy in place of the EAS-compatible stand-in: register the shipment-proof schema, point the escrow at the real EAS, keep the `requireEas` fallback for stage resilience.
- [ ] Add fuzz/invariant tests for the escrow (no double release, refund only after deadline, attestation binding to `paymentId` blocks replay).
- [ ] Run the static-analysis pass (aderyn is already wired) and triage findings. Document any accepted findings.
- **Acceptance:** `forge test` green including fuzz; EAS path verified against canonical EAS on Amoy; aderyn report attached to the repo.

### Backend
- [ ] Replace the in-memory indexer cache with a durable read path (persist indexed escrow events, or read on demand with a short TTL and a backfill job) so the financier feed survives a cold start.
- [ ] Add structured logging and error reporting on the API routes (at minimum: log the failing route, the Privy DID, and the chain error). Wire a basic uptime/error alert.
- [ ] KYC-lite: a minimal compliance gate at onboarding (business identity capture + a status field on the business row), structured so a real KYC provider swaps in later. This is the DFSA-sandbox posture, not full KYC.
- [ ] Rate-limit the faucet route and any unauthenticated read.
- **Acceptance:** kill the server mid-demo and the financier feed still loads on restart; a forced route error surfaces in logs/alerts; onboarding records a compliance status.

### Product
- [ ] Empty, loading, pending, and error states audited on every surface (importer + financier). No dead ends, no silent failures.
- [ ] Mobile pass on the importer header and the financier desk (the known cramped-nav nit).
- [ ] Accessibility sweep: focus states, contrast, the score visual readable without colour alone.
- **Acceptance:** a full run on a phone-width viewport with no layout breakage; keyboard-only navigation works.

---

## Milestone 2 — Contest application package

**Goal:** everything the application requires, submitted before the deadline.

**Target: complete by 2026-07-11, buffer to 2026-07-13.**

### Shared (all three)
- [ ] `docs/APPLICATION.md` finished against the six required sections (team, problem, architecture, roadmap, revenue, MVP). Fill the **team section** (names, roles, links). This is the last known TODO in the application.
- [ ] A 2 to 3 minute demo video: the live flywheel with real Polygonscan links on screen. Lead with the receipt (the on-chain proof), not the actor.
- [ ] One-page architecture diagram and the regulatory posture paragraph (DIFC/DFSA, native USDC on Polygon, AED as display currency). Keep the corrected stats ($2.5T gap, 41% SME rejection, etc.).
- [ ] Public repo tidy: README links to the verified Amoy contracts and the live URL; no dev noise; signal only.
- **Acceptance:** a teammate who did not write the application can read it and explain the wedge, the moat, and the compliance perimeter in two minutes.

### Product
- [ ] A reliable demo script and a known-good seeded state (preview mode is the safety net if the live chain is flaky on the day, but the live path is the headline).
- **Acceptance:** the demo runs the same way three times in a row.

---

## Milestone 3 — Demo Day runway (post-application)

**Goal:** depth that converts the application into a Demo Day win and a credible
path to mainnet. Pick from these against feedback; do not build all of it.

**Target: 2026-07-14 to mid-September.**

### Contracts
- [ ] Financier-signed disbursement hardening and, if pursued, a multi-financier model (bidding or first-come facilities) on top of the registry.
- [ ] Mainnet readiness: a third-party audit, swap `MockUSDC` for Circle USDC, finalise the EAS schema, and a deploy runbook. Mainnet stays gated on the audit.

### Backend
- [ ] Fee accrual and repayment beyond a single settlement (the marketplace take, tracked per facility).
- [ ] A real shipment-proof oracle path to replace the operator-signed inspector (or a clearly-bounded trusted-attester model with named partners). Naming a real licensed financier partner is worth more than breadth here.
- [ ] Integration tests across the API + chain (lock to fund), run in CI.

### Product
- [ ] Financier portfolio analytics (yield, exposure, repayment timeline).
- [ ] Onboarding polish for a non-crypto-native importer (the embedded wallet should stay invisible).

---

## Cross-cutting tracks (run throughout)

### Secrets and environments
- Three credential sets: Privy, Neon, and the Amoy contract addresses. Never in the repo (`.env*` is gitignored). Share out of band. Local devs each use their own Privy app + Neon branch, or one shared dev set, decided as a team.
- `NEXT_PUBLIC_PREVIEW_MODE=1` is local/demo only. It must never be set on the production deployment.

### Testing and CI
- Keep `forge test` and `npm test` (Vitest, the scoring engine) green on every PR.
- Add `npx tsc --noEmit` and `npm run lint` to CI.
- Target: a GitHub Action that runs contract tests, the scoring suite, typecheck, and lint on every PR before it can merge to `main`.

### Branching and review
- Feature work off `main`, PR, `main` auto-deploys to Vercel.
- Three people now: anything touching the shared seam (`lib/credit.ts`, the score-registry semantics, the EAS schema) needs a second reviewer from the affected lane.

### The shared seam, restated
If a change touches the scoring engine, the score registry, or the attestation
schema, it touches all three lanes. Flag it in the PR and loop the others in.
Everything else is lane-local.

---

## Definition of done per milestone

| Milestone | Done when |
| --- | --- |
| M0 Live on Amoy | A cold user completes pay to fund on the public URL with real Polygonscan links. |
| M1 Hardening | Survives a mid-demo restart; canonical EAS verified; states audited; KYC-lite records status. |
| M2 Application | All six sections filled (incl. team), demo video recorded, repo signal-clean, submitted before 2026-07-13. |
| M3 Demo Day | Audit underway, a named financier partner, fee/repayment loop, analytics, ready to present in Dubai. |

## Immediate next three actions

1. **Contracts:** fund the Amoy burner and confirm/redeploy the live addresses (M0).
2. **Backend:** set the production env on Vercel + apply the schema, then smoke-test the routes (M0).
3. **Product:** turn preview mode off in production, walk the live flywheel, and capture the screenshots for the application (M0 into M2).
