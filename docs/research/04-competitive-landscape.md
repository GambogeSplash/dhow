# Competitive Landscape — Supplier Payments → On-Chain Cashflow Ledger → Financier Marketplace

> Compiled 2026-06-08. Thesis under test: compliant stablecoin supplier-payment wedge → verified on-chain cashflow ledger → marketplace matching de-risked SMEs to third-party financiers (payments-data-to-credit flywheel, marketplace not balance-sheet lender), exploiting the UAE PTSR / DIFC window on Polygon.

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

## 4. UAE / DIFC home turf

- **Beehive** — DFSA-regulated P2P SME lending marketplace (closest structural analog to our marketplace leg) — but **fiat, no payment wedge, no on-chain data.** Requires ~2yr history + ~AED 2M turnover.
- **Funding Souq** — DFSA-regulated Sharia private-credit marketplace. Same pattern, same gaps.
- **Comfi** — B2B BNPL + invoice discounting; balance-sheet, not marketplace, not on-chain.
- **InvoiceMate** — invoice financing + tokenization **on XDC**; the one local on-chain-invoice player — partner or compete on the tokenization leg.

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

## To resolve before committing (flagged)
- Whether mainland UAE B2B settlement can legally use a *foreign* stablecoin (USDC/USDT) or must use an AED-licensed/registered token — PTSR leans "licensed tokens only." DIFC/DFSA free-zone path likely avoids this. **Counsel check; materially shapes corridor design.**
- Aggregate market-size figures ($6B/mo B2B, $350–550B) are vendor-sourced/directional, not audited.
