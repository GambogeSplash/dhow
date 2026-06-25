# Edge cases

Every edge case we know of across the system, grouped by domain, with the
expected behaviour and an honest status. This is the checklist for hardening
(Milestone 1 in [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md)) and the test
matrix. Update the status as cases get covered.

**Status key:**
- **Handled** — implemented and verified.
- **Partial** — works in the common path, gaps noted.
- **Open** — not yet handled, needs work.
- **Preview** — behaviour specific to `NEXT_PUBLIC_PREVIEW_MODE` (demo only).

---

## 1. Authentication and onboarding

| Scenario | Expected | Status |
| --- | --- | --- |
| Privy not configured (no `NEXT_PUBLIC_PRIVY_APP_ID`) | Show the setup notice, do not crash | Handled (`PrivyStack`) |
| User closes the Privy modal mid-login | No partial account, stay on sign-in | Handled |
| Access token expired between page load and an API write | Route returns 401, client re-auths or prompts | Partial (routes 401; client refresh of token should be confirmed) |
| Onboarding abandoned after business but before supplier/wallet | Resume at the correct step on return, do not skip steps | Handled (the redirect-if-onboarded effect is gated to the signin step) |
| Returning user who is already onboarded hits `/onboarding` | Redirect into the app, not back through the steps | Handled |
| Authenticated but not onboarded hits an app route | Redirect to `/onboarding` | Handled (`AppShell` guard) |
| Same human signs in with email then later with wallet | Treated consistently (one identity) or clearly two accounts | Open (Privy linking policy to decide) |
| Business name / city with emoji, RTL text, or 300 chars | Stored and rendered without breaking layout | Partial (no length/charset validation yet) |

## 2. Wallet, gas, and balances

| Scenario | Expected | Status |
| --- | --- | --- |
| New user has no POL for gas | Faucet sponsors POL + test USDC; clear prompt if it cannot | Handled (`/api/faucet`, `FaucetCard`) |
| User has POL but insufficient USDC for the payment | Block the send with a clear balance message, do not broadcast | Open (pre-flight balance check needed) |
| Faucet tapped repeatedly | Rate-limit per user/address | Open (M1: rate-limit) |
| Faucet called when chain is unconfigured | 503 with a clear error | Handled |
| Borrower has no settlement wallet address | Financier cannot fund; show why | Handled (`isFullAddress` guard in `fund`) |
| Wallet on the wrong chain when signing | Switch to the Dhow chain before the tx | Handled (`switchChain` in the client signer) |
| User rejects the signature in their wallet | Treat as cancelled, no corridor/facility created, no score change | Partial (error surfaced; confirm no phantom row) |

## 3. Sending a payment (open and Proof-Lock)

| Scenario | Expected | Status |
| --- | --- | --- |
| Amount is 0, negative, or non-numeric | Send disabled, no tx | Handled (`canSend`, input sanitised) |
| Amount with decimals / commas / spaces | Parsed to a clean number; USDC computed at peg | Handled (`Number(amount.replace(...))`) |
| Goods description empty | Send disabled | Handled (`canSend`) |
| No supplier selected (or none exist) | Send disabled; prompt to add a supplier | Handled (`canSend`, add-supplier inline) |
| Very large amount (overflow, USDC 6-dp precision) | No precision loss; rounds to 6 dp deterministically | Partial (`makeCorridorUsdc` rounds; add an upper bound) |
| Duplicate ref collision (`DHW-####`) | Refs stay unique | Handled (server increments; preview increments by count) |
| Network drops after the user signs but before confirmation | Show pending, reconcile to confirmed/failed; do not double-send | Partial (`txState` pending/confirmed/failed exists; reconcile path to verify) |
| User double-clicks send | One corridor, one tx | Partial (disable button while in-flight; confirm) |

## 4. Escrow: lock, release, attestation

| Scenario | Expected | Status |
| --- | --- | --- |
| Release attempted with no attestation | Reverts | Handled (`releaseWithAttestation` requires a valid uid) |
| Attestation for the wrong schema | Reverts | Handled |
| Attestation revoked or expired | Reverts | Handled |
| Attestation signed by someone other than the inspector | Reverts | Handled |
| Attestation for a different corridor (replay) | Reverts; `corridorId = keccak256(ref)` binds it | Handled |
| Double release of the same lock | Reverts (state already released) | Handled |
| Reentrancy on release/refund | Guarded | Handled (`ReentrancyGuard`, SafeERC20) |
| EAS unavailable but a release must happen on stage | Owner fallback `releaseByInspector` when `requireEas` is off | Handled (deliberate stage-resilience path) |
| Canonical EAS vs the EAS-compatible stand-in | Same verification semantics | Partial (stand-in on Amoy; canonical EAS wiring is M1) |
| Attestation created (server) but the user never signs the release | Funds stay escrowed until release or deadline refund | Handled |

## 5. Refund and dispute

| Scenario | Expected | Status |
| --- | --- | --- |
| Refund before the deadline | Reverts (refund is deadline-gated) | Handled |
| Refund after the deadline on an unreleased lock | Returns funds to the buyer | Handled |
| Refund on an already-released corridor | Reverts | Handled |
| Refund correctly affects the score | Proof performance drops; a refunded prooflock counts as resolved-but-not-clean | Handled (verified: `proofMetRatio` uses resolved vs clean) |
| Disputed open settlement (no escrow) | Cannot phantom-refund; only prooflocks refund | Handled (open-settlement phantom-proof bug previously fixed) |
| Refund of a corridor whose write earlier failed | Excluded from score either way | Handled (`txState === "failed"` excluded) |

## 6. Scoring engine (`lib/corridor.ts`)

| Scenario | Expected | Status |
| --- | --- | --- |
| Brand-new business, zero settlements | Score 0, not full marks for "no disputes" | Handled (performance is earned, 0 until first settlement) |
| Only failed writes | Not counted as creditworthy evidence | Handled (`txState === "failed"` filtered out) |
| No prooflocks yet | No negative proof signal (`proofMetRatio = 1`) but performance still requires a settlement | Handled |
| One settlement only | Cadence scaled by count, not over-rewarded | Handled (`settledCount / 2` branch) |
| Score exactly at threshold (70 / 88) | Tier boundaries inclusive and consistent | Handled (`>=` comparisons) |
| Client and server compute different scores | Must never happen; one shared pure function | Handled (do not fork `corridor.ts`) |
| Stale `now` causing odd cadence (SSR vs client) | Deterministic; preview uses a fixed `SEED_NOW` | Handled (preview), Partial (live uses real `now`, fine) |
| Advance offer when not eligible | Returns 0 | Handled (`advanceOffer` guards on `eligible`) |

## 7. Financier funding and facilities

| Scenario | Expected | Status |
| --- | --- | --- |
| Fund a borrower below threshold | No offer (offer is 0), cannot fund | Handled |
| Fund a borrower with no wallet | Blocked with a clear message | Handled |
| Fund the same borrower twice | One active facility per borrower (replace, do not stack) | Handled (`filter` by borrowerId before adding) |
| Available appetite exceeded | Should block or warn when deployed > appetite | Open (appetite is displayed; enforce it) |
| Mark repaid on an already-repaid facility | Idempotent, no negative deployed | Handled (maps by id, sets `repaid: true`) |
| Financier funds, tx fails on chain | No facility row persisted; error surfaced | Partial (live path returns error; confirm no row) |
| Borrower feed empty (no eligible borrowers) | Clean empty state, not an error | Handled (desk/portfolio empty states) |
| Cross-machine: borrower on one machine, financier on another | Financier reads borrowers from `/api/borrowers` + on-chain score | Handled (DB-backed, not localStorage) |

## 8. Multi-tenancy and authorization

| Scenario | Expected | Status |
| --- | --- | --- |
| User A reads or writes user B's rows | Impossible; every store fn is scoped by the Privy DID | Handled (`store-server.ts`) |
| Forged or missing access token on a write route | 401 | Handled (`getUserId` / `privyConfigured` guard) |
| Account-id / tenant header mismatch | Reject | Partial (verify header trust end to end) |
| Borrower deal page for an id that does not exist | "Borrower not found" fallback | Handled |
| Public `/api/borrowers` and `/api/corridors` GET leak private data | Only chain-derived / intended-public fields exposed | Partial (audit the public read surface) |

## 9. Chain, network, RPC

| Scenario | Expected | Status |
| --- | --- | --- |
| No chain configured | App still renders; chain features gate off | Handled (`chainConfigured`, `getChainConfig`) |
| RPC times out or rate-limits | Surface a retryable error, do not hang | Partial (some try/catch; add timeouts + retry) |
| Indexer cold start (in-memory cache empty) | Feed rebuilds; should not show empty as if there is no data | Open (M1: durable indexer) |
| Tx mined but the app missed the receipt | Reconcile from chain on next load | Partial |
| Chain reorg on Amoy | Tolerate; re-read state | Open (low priority on testnet) |
| Explorer base URL wrong/missing | Links degrade gracefully, no broken UI | Handled (env-driven base) |

## 10. Money, FX, decimals

| Scenario | Expected | Status |
| --- | --- | --- |
| AED to USDC conversion | Fixed CBUAE peg 3.6725, never a live oracle | Handled (`AED_PER_USD`) |
| USDC 6-dp rounding | Deterministic round to 6 dp, no drift between display and on-chain amount | Handled (`makeCorridorUsdc`) |
| Currency formatting (thousands, locale) | Consistent via `aed()` / `usdcLabel()`, never hand-rolled | Handled |
| Sub-cent amounts | Round predictably; do not send dust that reverts | Partial (define a minimum) |
| Display rounding hiding a real difference | Never round in a way that misstates the on-chain value | Handled |

## 11. Data integrity and persistence

| Scenario | Expected | Status |
| --- | --- | --- |
| DB not configured | App renders; DB features gate off | Handled (`dbConfigured`) |
| Schema not applied | Routes fail clearly, not silently | Partial (confirm error messaging) |
| Partial write (corridor row created, chain tx failed) | Reconcile so the row reflects `failed`, excluded from score | Handled (`txState`, score filter) |
| Duplicate corridor on retry | No duplicate rows | Partial (verify idempotency key on create) |
| Optimistic UI vs server truth divergence | Reconcile to server/chain | Partial (optimistic-then-reconcile pattern) |

## 12. Concurrency and races

| Scenario | Expected | Status |
| --- | --- | --- |
| Two payments sent in quick succession | Distinct refs, distinct corridors | Handled |
| Attest and refund clicked on the same corridor near-simultaneously | One terminal state wins; contract enforces | Handled (contract is the arbiter) |
| Financier funds while the borrower's score is updating | Funding uses the offer at click time; consistent | Partial |
| Multiple browser tabs for the same account | Stay consistent on refresh | Partial |

## 13. UI, state, hydration

| Scenario | Expected | Status |
| --- | --- | --- |
| Browser extension injects attributes on `<body>` | No hydration error | Handled (`suppressHydrationWarning` on `<body>`) |
| `Date.now()` / `Math.random()` at render scope | Avoid (causes hydration drift); preview uses fixed `SEED_NOW` | Handled |
| Deep-link / refresh on an inner page | State rehydrates correctly, no flash to seed | Handled (live: DB-backed; preview: resets to seed by design) |
| Long supplier/business names in tight rows | Truncate or wrap cleanly | Partial (avatars added; audit truncation) |
| Mobile width (<420px) header/nav | No layout break | Open (known cramped-nav nit, M1) |
| Pending tx UI | Honest pending/confirmed/failed, no fake instant success | Partial |

## 14. Preview / demo mode (`NEXT_PUBLIC_PREVIEW_MODE`)

| Scenario | Expected | Status |
| --- | --- | --- |
| Preview accidentally on in production | Must never happen; no auth, no persistence | Handled by policy (keep it off on Vercel) |
| Hard page reload in preview | State resets to seed (no persistence by design) | Preview (expected) |
| All action buttons in preview | Mutate local state so the walkthrough works (send/attest/refund/retry/fund/mark-repaid) | Handled (verified in browser) |
| Preview score crossing a threshold live | Recomputes from the shared engine, same as production | Handled (verified: 93 to 95 on attest) |

## 15. Security

| Scenario | Expected | Status |
| --- | --- | --- |
| Operator/inspector key exposure | Server-only, never shipped to the client | Handled (`server-only`, env-gated) |
| Secrets in the repo | None; `.env*` gitignored | Handled |
| Unauthenticated faucet abuse | Auth-gated + rate-limited | Partial (auth yes, rate-limit Open) |
| Reentrancy / unsafe transfers in contracts | Guarded, SafeERC20, custom errors | Handled |
| Input injection via business/supplier/goods fields | Sanitise and bound length | Open |
| Mainnet without audit | Gated; testnet only until audited | Handled by policy |

## 16. Financing deal lifecycle (request → negotiate → fund → repay)

The working-capital deal is the shared object both sides act on (`lib/deal.ts`,
`/api/deals`). Transitions are validated by a pure state machine; the API resolves
the caller's party and rejects illegal moves with 409.

| Scenario | Expected | Status |
| --- | --- | --- |
| Borrower requests below eligibility (score < 70) | Request UI gated; cannot open a deal until eligible | Handled (`/capital` gates on `score.eligible`) |
| Borrower requests above their headroom | Blocked client-side with the headroom shown; server clamps terms | Handled (`TermsEditor` maxAmount + `clampTerms`) |
| Out-of-turn move (e.g. financier accepts their own offer) | Rejected; only the party whose turn it is may act | Handled (`permissions` + `applyAction`, 409) |
| Acting on someone else's deal | Forbidden; party resolved from the verified DID | Handled (`partyFor`, 403) |
| Counter ping-pong | Each counter flips the turn and appends a timeline event | Handled (`DealThread` shows the full thread) |
| Borrower withdraws / financier declines mid-negotiation | Deal closes terminally; no further moves | Handled (`withdrawn` / `declined`) |
| Fund an un-agreed deal | Rejected until status is `agreed` | Handled (`canFund` only when agreed) |
| Funding tx fails on chain | No state transition recorded; error surfaced | Handled (sign first, record only on success) |
| Reputation accounting blocks settlement | Never; escrow records to the registry in try/catch | Handled (`_recordSettlement`) |
| Repay sends to the wrong address | Repayment targets the stored `financierWallet` captured at fund time | Handled (`financier_wallet` column) |
| Terms rounding / fee precision | Clamped + rounded deterministically; total = principal + flat fee | Handled (`clampTerms`, `totalRepayableAed`) |
| Both sides view the same deal | One row, two perspectives (`statusLabel(deal, viewer)`) | Handled |
| Financier offers proactively (no prior request) | Deal opens directly in `offered` | Handled (`openOffer`, `apiOfferToBorrower`) |
| Stale view (other party moved since load) | Borrower/financier providers poll every 6s to reconcile | Partial (poll; a 409 on a stale action is surfaced) |
| Multiple open deals for one borrower | `activeDeal` picks the newest open/active; older ones remain in history | Handled (`pickActiveDeal`) |

---

## How to use this list

- It is the **test matrix**. Each "Handled" should map to a test (Foundry for
  contracts, Vitest for scoring, an integration test for routes). Each "Partial"
  or "Open" is a hardening ticket for Milestone 1.
- When you add a feature, add its edge cases here first, then implement, then
  flip the status.
- Anything touching the shared seam (`lib/corridor.ts`, the score registry, the
  EAS schema) needs its edge cases reviewed by the other two lanes.
