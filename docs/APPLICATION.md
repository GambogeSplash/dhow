# Dhow — Application

> The Smart Commerce Infrastructure Challenge (Polygon × DIFC × Ignyte). Structured to the required submission sections. Figures are citation-checked (`docs/research/`).

---

## 1. Team background and technical credentials

> **TODO (needs your input):** confirm names, roles, and any technical co-founder / contract auditor. Draft below based on the lead.

- **Lead — product & design.** Senior product designer, 7 years (4 in web3), shipping production-grade fintech and on-chain interfaces. Track record of taking regulated, technically dense financial products and making them legible to non-crypto operators — the exact skill Dhow's thesis depends on.
- **Engineering.** Full-stack + Solidity. The prototype is a Next.js 16 app with custom Foundry-tested escrow contracts on Polygon (see §3, §6).
- *Add: any banking / trade-finance domain advisor, and a smart-contract audit partner before mainnet.*

---

## 2. Problem statement and target market

**The problem.** The global trade-finance gap is **$2.5 trillion** (ADB), roughly 10% of world merchandise trade. SMEs are rejected on **~41%** of trade-finance applications versus ~7% for multinationals (ADB/WTO). The reason is structural: banks reject SMEs because they can't see reliable cashflow, and they can't see the cashflow *because* they rejected them. Meanwhile the payment rails themselves are slow and opaque — correspondent banking takes **3–5 days** and costs **over 3% on a quarter of corridors**.

Every prior attempt to fix this on-chain failed the same way. The bank consortia (Marco Polo, we.trade, Contour) all went insolvent because they asked corporates to digitise trade with no payment hook and never reached transaction volume. The tokenized-receivables platforms (Centrifuge, Polytrade) quietly abandoned trade receivables for tokenized treasuries. The missing ingredient was always the same: **deal origination tied to real payment flow and verifiable performance data.**

**Target market.** UAE-based SME importers settling cross-border supplier payments, starting on the under-served MENA↔Asia/Africa corridors that flow through Jebel Ali (**15.5M TEU/yr**). The UAE is the right beachhead: stablecoins are already **~51%** of national crypto activity, and DIFC offers a regulated home with direct access to financier liquidity (the demand side of our marketplace).

---

## 3. Technical architecture and approach on Polygon

Dhow has three layers, all built:

1. **Settlement (the wedge).** Cross-border supplier payments settle in **native USDC on Polygon PoS** in minutes for ~$0.002, with AED as the quote/invoicing currency (the CBUAE peg, 3.6725). Open settlement is a direct transfer; the high-value path is a **Proof-Lock**: USDC escrowed on-chain, released automatically when shipment proof is attested.
   - `DhowEscrow.sol` — `lock` / `attestRelease` / timeout `refund`, reentrancy-guarded, 6 passing Foundry tests. Attester role models the inspector attestation; production swaps it for an **EAS** (Ethereum Attestation Service) check.
2. **Cashflow Record (the moat).** Every settled payment writes a verified on-chain cashflow record and lifts a **Credit Score** — a transparent function of settled volume, proof performance, and cadence. This is the underwriting primitive: data we generated and settled ourselves, which no competitor can fabricate or source.
3. **Capital (the business).** Above a score threshold, Dhow surfaces the SME to third-party financiers with a live verified cashflow feed. **Dhow is a marketplace, not a balance-sheet lender** — capital-light, and it makes banks our demand side rather than our competition.

**Why Polygon.** This is a direct fit for Polygon's **Open Money Stack** (wallets, fiat ramps, cross-chain routing, settlement). Sub-cent fees make many small settlements economical; native USDC gives clean, regulated settlement liquidity.

**Stack.** Next.js 16 (App Router), viem/wagmi, server-side signer behind an env-gated API so the app degrades gracefully to simulation when offline. Amoy testnet for the demo.

**Regulatory posture (honest).** Dhow is **DIFC-domiciled under DFSA** (Innovation Testing Licence sandbox path), in the financial free zone that is **carved out of the CBUAE PTSR**. We settle in third-party USDC with AED as display currency; we do not issue an AED stablecoin or do onshore merchant acceptance. (No AED stablecoin exists on a public chain today — AE Coin runs on permissioned infrastructure.) We make no "PTSR-compliant" or "world's first" claims.

---

## 4. Launch roadmap and go-to-market strategy

**Roadmap.**
- **Now:** working prototype, Foundry-tested escrow, full flywheel verified on a live EVM chain.
- **0–3 months:** deploy to Amoy then Polygon mainnet; EAS-based attestation; embedded wallets (Privy) for SME signing; onboard a design-partner importer + one financier (Creek Capital archetype).
- **3–9 months:** DFSA ITL sandbox authorisation; first live corridors; multi-financier marketplace.
- **9–18 months:** scale corridors; data-feed subscription product; explore balance-sheet optionality on the thickest corridors as *earned* (not day-one).

**GTM.** Land through tourist- and trade-heavy SME importers where stablecoin settlement beats correspondent banking outright. Acquire financiers via DIFC's network and the 289 banking institutions — the contest itself supplies the demand side that normally makes a two-sided marketplace hard to cold-start.

**Cold-start answer.** Day one Dhow underwrites nothing; the payment product stands alone (cheaper, faster, transparent), so the data is *earned*, not assumed. Credit switches on per-SME once they cross N settled payments.

---

## 5. Revenue model and scalability plan

Four lines, layered:
- **Settlement fee** — bps on payment volume (undercuts correspondent banking + FX spread). Earns from day one with zero credit.
- **Proof-Lock premium** — small fee on conditional settlements.
- **Capital match fee** — take-rate on each funded facility.
- **Data-feed subscription** — financiers pay for the ongoing verified cashflow stream. This is the recurring line *and* the anti-disintermediation lock: the loan stays underwritable only while the SME keeps settling on Dhow.

**Scalability.** Capital-light (no loan book to fund). Polygon's sub-cent settlement means unit economics hold at high transaction volume. Each new corridor compounds the data moat. The wedge is the payment; the margin is the credit marketplace on top of it.

**Differentiation / competition.** The closest threat is **Huma Finance** (on-chain receivables credit at scale), but it is a liquidity protocol, not a compliant supplier-payment front-end with a UAE perimeter and a third-party-financier marketplace. We originate the payment, hold the regulated perimeter, and run a marketplace — three things no single competitor holds together. Goldfinch's defaults (underwriting on attestations it couldn't verify) are exactly the failure our model avoids: we underwrite cashflow we settled ourselves.

---

## 6. MVP / Prototype

A working prototype is built and verified:
- Four surfaces (landing, Send, Cashflow Record, Capital) in a production-grade UI.
- The full flywheel runs end to end: send a Proof-Lock → attest shipment proof → score crosses the eligibility threshold → working capital offer derives and unlocks → a third-party financier funds it.
- **Verified on a live EVM chain:** the Proof-Lock locked 112,185.16 USDC into the escrow and released it to the supplier on attestation (real transactions, real settlement). Amoy deployment is a single funded-key step away (`docs/CHAIN.md`).
- Live link: **https://dhow-pi.vercel.app**  ·  Repo: *[TODO: push to GambogeSplash]*

---

*Supporting material: full product brief (`docs/BRIEF.md`), regulatory/market/competitive/stack research with citations (`docs/research/`), on-chain setup (`docs/CHAIN.md`).*
