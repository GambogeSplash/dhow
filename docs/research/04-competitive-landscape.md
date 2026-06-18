# Competitive Landscape — Supplier Payments → On-Chain Cashflow Ledger → Financier Marketplace

> Compiled 2026-06-08. Thesis under test: compliant stablecoin supplier-payment wedge → verified on-chain cashflow ledger → marketplace matching de-risked SMEs to third-party financiers (payments-data-to-credit flywheel, marketplace not balance-sheet lender), exploiting the UAE PTSR / DIFC window on Polygon.

> **Refresh 2026-06-18.** Two new findings shape the "why you?" answer. (1) **Polygon-specific:** Huma Finance runs live receivables pools on Polygon (Jia, BSOS) and Polytrade (Mastercard + Polygon backed) runs invoice/RWA tokenization on Polygon. Neither runs the full loop. (2) **UAE-specific:** Comfi raised $65M pre-Series A for B2B SME invoice finance (fiat, off-chain, credit-first), and AE Coin × USDU announced a regulated AED–USD trade-finance settlement rail in May 2026. New subsections below: §0 (Polygon) and refreshed §4 (UAE). Positioning conclusion: do not claim "first trade finance on Polygon" or "first stablecoin trade rail in the UAE." Claim the seam: first to run the payment-to-credit flywheel on-chain (self-generated, proof-locked cashflow as the underwriting primitive) inside the DIFC perimeter.

## 0. On Polygon specifically (the chain we settle on)

The question "does this already exist on Polygon" has a precise answer: adjacent pieces yes, the full loop no.

- **Huma Finance (PayFi) — closest on Polygon, #1 threat overall.** Runs live receivables-financing pools on Polygon (the **Jia** pool and the **BSOS** pool), plus Solana / Stellar / Celo / Scroll. Supplier/receivables advances against tokenized receivables, auto-repay on settlement. $4B+ volume two weeks after Huma 2.0. **Difference:** Huma starts at the financing (the receivable already exists and someone tokenizes it); we start at the *settlement* and the cashflow record falls out as exhaust. We own origination, not a tokenized claim handed to us. Pooled-liquidity DeFi protocol, not a third-party-financier marketplace, not UAE-regulated.
- **Polytrade — invoice/RWA tokenization on Polygon.** Backed by Mastercard and Polygon directly; tokenizes invoices and other RWAs into an investor marketplace (20k+ users, 9 asset classes). Has the marketplace leg and the invoice leg on Polygon, but drifted from pure invoice finance to a broad multi-asset RWA aggregator, and does not originate the payment.

**Net on Polygon:** a receivables credit protocol (Huma) and an invoice-tokenization marketplace (Polytrade) exist; the payment-origination + self-generated cashflow + regulated-perimeter combination does not. Huma is the one to watch weekly, it is one product decision (a compliant UAE front-end + a financier marketplace) from our thesis.

## Headline: no one runs the full loop

The market splits cleanly into three camps, none of which holds all three pieces:
- **Payment rails** own the flow but don't underwrite and have no marketplace.
- **On-chain trade-finance / RWA** underwrite but don't own the payment, and are *fleeing receivables* toward tokenized treasuries.
- **Web2 capital (Stripe/Shopify/Square)** run the flywheel but are balance-sheet, single-source-data, walled-garden, wrong geography, can't cross corridors.

The ownable position is the seam, anchored in the UAE compliance perimeter + Polygon settlement.

## 1. Stablecoin B2B / supplier payment rails (direct wedge competitors — none underwrite today)

- **Conduit** — stablecoin cross-border B2B replacing SWIFT; $36M Series A (May 2025, Dragonfly/Altos, Circle Ventures); 16× volume 2023→24; 100+ clients. **Most likely future entrant into credit.**
- **BVNK** — ~$30B/yr, 130+ countries; **acquired by Mastercard up to $1.8B (Mar 2026)**.
- **Bridge** — acquired by **Stripe ~$1.1B+** (late 2024).
- **Mural Pay** — multi-currency stablecoin AP/payroll; LatAm-heavy.
- **Yellow Card** — pan-African, **exiting retail Jan 2026 to go all-in B2B** ($6B history, 34 countries). Watch.
- **HashKey MENA × Daya (Aptos)** — VARA-licensed **MENA↔Africa stablecoin corridor** pilot. **Directly our geography.**
- **SquareFi** — MENA stablecoin B2B, launch-stage.

Category is consolidating into card networks (Mastercard→BVNK, Stripe→Bridge) — they want the rails, **not yet the credit layer on top**. Conduit + Yellow Card are the most credible to move toward our thesis.

## 2. On-chain trade finance / tokenized receivables (the graveyard + the drift)

**The graveyard (bank consortia, all failed — this is our best pitch evidence):**
- **Marco Polo** — insolvent Feb 2023, ~$85M cumulative losses; never onboarded enough corporates.
- **we.trade** — insolvent June 2022 (IBM + ~12 banks); corporate uptake never materialized.
- **Contour** — shuttered Nov 2023 (9 systemic banks); just 60–70 tx/month.

**Lesson (our #1 narrative):** they died asking corporates to change behavior with no payment wedge. We invert it — **the stablecoin payment is the wedge; the verified ledger is exhaust, not a product we sell.** "We don't ask anyone to digitize trade; we pay their suppliers and the ledger falls out."

**The RWA players, alive but drifting AWAY from receivables:**
- **Centrifuge** — original tokenize-invoices thesis; **pivoted to tokenized US Treasuries / institutional credit** (Janus Henderson, Apollo). TVL→$1.6B, but not SME invoices.
- **Polytrade** — started invoice tokenization **on Polygon** (Polygon Ventures seed); pivoted to multichain RWA marketplace aggregator + real estate. Only ~$6M raised — never reached escape velocity on invoices.
- **XDC / TradeFinex** — most committed remaining trade-finance chain (invoices, warehouse receipts, LCs; InvoiceMate live). But it's a chain/protocol, **lacks the payment wedge and corridor relationships.**

**Signal:** two flagships abandoned receivables as core. The missing ingredient is **deal origination tied to real payment flow + verifiable performance data** — precisely our wedge.

## 3. The flywheel (our actual model)

- **Stripe / Shopify / Square Capital** — proof the flywheel works; underwrite purely on processing data they own, auto-repay from flow. **But balance-sheet, single-source-data, walled-garden — cannot finance a Lagos supplier paid by a Dubai buyer across a corridor they don't own.** Our marketplace-of-financiers + cross-corridor on-chain data is the structural inversion.
- **Emerging-market analogs** (Flutterwave, Paystack, MFS Africa, Jumia BNPL) — all bootstrap from captive payment data, same walled-garden limit. MEA ~10% of embedded lending = under-penetrated.
- **Huma Finance ("PayFi") — THE #1 THREAT.** On-chain factoring/receivables credit for cross-border payments; **$10B cumulative volume (Feb 2026), $2.3B+ originated**; revenue-backed lending in Kenya + Philippines via Jia. Differentiate on: we originate the payment, UAE PTSR/DIFC regulation, and a third-party-financier marketplace (not one protocol pool). **Watch weekly.**
- **Goldfinch — the cautionary tale.** Multiple defaults (Tugende, Lend East) diagnosed as a model problem: it outsourced underwriting to auditors with no direct cashflow visibility. **Our answer: we don't trust third-party attestations; the cashflow IS the on-chain payment record we generated.** That's the primitive Goldfinch lacked.

## 4. UAE / DIFC home turf (refreshed 2026-06-18)

The credit/marketplace leg is crowded and now well-funded. Confirmed: every UAE invoice-finance player is traditional fintech, **none is on-chain.** That is the gap we occupy.

- **Comfi — the strongest UAE incumbent on our credit leg, and the "this already exists" objection.** Dubai B2B SME working capital + invoice financing, marketplace model, AI underwriting with 24-hour payouts from four documents, full risk transfer. **Raised $65M pre-Series A (2026, Iliad Partners, Yango).** Receivables due in 30–120 days. **Gaps vs us:** fiat, off-chain, credit-first. No payment-origination wedge, no self-generated on-chain cashflow data. Comfi proves the demand; we add the data moat and on-chain origination it lacks.
- **Beehive** — DFSA-regulated P2P SME lending + invoice finance marketplace (closest structural analog to our marketplace leg), but **fiat, no payment wedge, no on-chain data.** Requires ~2yr history + ~AED 2M turnover.
- **Funding Souq** — DFSA-regulated Sharia private-credit marketplace (AED 50k–500k, 3–24mo). Same pattern, same gaps.
- **Zelo** — SME growth financing, another fiat credit-first entrant.
- **InvoiceMate** — invoice financing + tokenization **on XDC**; the one local on-chain-invoice player. Partner or compete on the tokenization leg.

**The development that touches our regulatory assumption — AE Coin × USDU (May 2026).** AE Coin (CBUAE-licensed AED) and USDU (FSRA/ADGM-regulated USD) announced a regulated **AED–USD conversion rail**, explicitly framed as the first step toward UAE-originated **dollar-based trade-finance stablecoin infrastructure**, and are exploring integration with cross-border trade-finance fintechs. RAKBank also received approval for an AED-backed stablecoin. Cuts two ways:
1. **Tailwind / "why now":** regulated AED settlement rails are arriving right now, so the rails for a compliant on-chain flywheel finally exist; our "USDC-only, AED display-only" stance may later relax to a licensed AED token settling natively (counsel check).
2. **Watch-item (UAE analog of the Huma risk):** "trade-finance infrastructure + a fintech partner for the credit layer" is adjacent to our exact thesis. If they pick a partner to run the flywheel, that partner becomes a competitor.

## The five compounding moats no single competitor holds together

1. **Wedge inversion (failure-proofing).** Lead with supplier payment; ledger is exhaust. #1 narrative vs "blockchain trade finance is dead."
2. **Verified on-chain cashflow as the underwriting primitive.** We underwrite on payments we settled — performance data competitors can't fabricate or source. The asset Centrifuge/Polytrade lacked.
3. **Conditional settlement (programmable escrow).** Proof-gated release turns the payment itself into de-risking collateral + a clean performance signal the pure rails don't expose and the lenders can't see.
4. **Marketplace, not balance sheet.** Match de-risked SMEs to third-party financiers — capital-light, sidesteps lending-license burden. Beehive/Funding Souq prove UAE investor appetite; we add the data moat they lack.
5. **UAE DIFC/DFSA + Polygon perimeter.** Compliant, licensed settlement on a sub-cent chain on the under-penetrated MENA↔Africa/Asia corridor. Regulation is a moat offshore crypto-credit protocols can't easily cross.

## Threats, ranked
1. **Huma Finance** — closest to the full thesis; if it adds a compliant UAE front-end + financier marketplace, it's us.
2. **Conduit / Yellow Card** — own corridor B2B flow; one product decision from financing.
3. **Mastercard (BVNK) / Stripe (Bridge)** — rails + capital + distribution; slow but existential. Their walled-garden instinct is our window.
4. **XDC/TradeFinex + InvoiceMate** — on-chain invoices in UAE already; lacks the payment wedge; partner or compete on tokenization.
5. **AE Coin × USDU trade-finance rail (new, May 2026)** — UAE-regulated AED–USD stablecoin settlement infrastructure openly courting a cross-border trade-finance fintech partner. If that partner runs the credit flywheel, it is the UAE analog of Huma. Tailwind as rails, threat as a platform. Watch.
6. **Comfi (new context)** — $65M-funded UAE B2B invoice finance with the demand and distribution; fiat and off-chain today, but the most likely local incumbent to add a stablecoin/on-chain layer.

## To resolve before committing (flagged)
- Whether mainland UAE B2B settlement can legally use a *foreign* stablecoin (USDC/USDT) or must use an AED-licensed/registered token — PTSR leans "licensed tokens only." DIFC/DFSA free-zone path likely avoids this. **Counsel check; materially shapes corridor design.**
- Aggregate market-size figures ($6B/mo B2B, $350–550B) are vendor-sourced/directional, not audited.
