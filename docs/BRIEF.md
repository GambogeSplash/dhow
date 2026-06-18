# Dhow — Project Brief

> Canonical product brief. Backed by citation-checked research in `docs/research/`. Built for **The Smart Commerce Infrastructure Challenge** (Polygon × DIFC × Ignyte). Application due **13 July 2026**; Demo Day Dubai, mid–late Sept 2026.

## One line

Dhow settles UAE importer-to-supplier payments in stablecoin on Polygon, in minutes instead of days. Every settlement writes a verified, on-chain cashflow record. Once an importer has enough record, Dhow surfaces them to financiers who can now fund the exact SMEs banks reject — because Dhow holds the repayment data banks structurally can't get.

**We are not a lender. We are not a wallet.** We are the legibility layer that turns transaction history into creditworthiness, and we hand the financing to the banks in the room.

## The name

The dhow ran cargo across the Gulf for a thousand years before any bank cleared it. Value moving across a corridor, recorded, trusted, no correspondent bank in the middle. The instrument is a **Proof-Lock**, never a "letter of credit." The business is legibility.

## Thesis & moats (why we win, not just why we're nice)

The competitive map has three camps and the top-right quadrant is empty: payment rails own the flow but don't underwrite; on-chain trade-finance platforms underwrite but don't own the payment (and are fleeing receivables for treasuries); Stripe/Square Capital run the flywheel but are walled-garden balance-sheet lenders that can't cross corridors. Five compounding moats no single competitor holds together:

1. **Wedge inversion (failure-proofing).** Marco Polo / we.trade / Contour died asking corporates to digitize trade with no payment hook. We lead with the supplier payment; the verified ledger is exhaust, not a product we sell. *"We don't ask anyone to digitize trade; we pay their suppliers and the ledger falls out."*
2. **Verified on-chain cashflow as the underwriting primitive.** Goldfinch defaulted by trusting third-party attestations it couldn't see behind. We underwrite on payments we settled ourselves — data competitors can't fabricate or source.
3. **Conditional settlement (Proof-Lock).** Proof-gated escrow turns the payment into de-risking collateral and a clean performance signal the pure rails don't expose and the lenders can't see.
4. **Marketplace, not balance sheet.** We match de-risked SMEs to third-party financiers — capital-light, sidesteps the lending licence. Beehive / Funding Souq prove UAE investor appetite; we add the data moat they lack.
5. **DIFC/DFSA + Polygon perimeter.** Compliant, licensed settlement on a sub-cent chain over the under-penetrated MENA↔Africa/Asia corridor. Regulation is a moat offshore crypto-credit protocols can't cross.

**#1 threat: Huma Finance** ($10B volume, on-chain receivables credit). Differentiate on: we originate the payment, the UAE regulatory perimeter, and a third-party-financier marketplace (not one protocol pool). Watch weekly.

## Regulatory posture (this reshaped the product — get it right)

- **No AED stablecoin is on Polygon (yet).** AE Coin runs on permissioned Hyperledger Besu. So: **settle in native USDC on Polygon, use AED purely as the display / quote / invoicing currency.**
- **Watch (May 2026):** AE Coin (CBUAE-licensed AED) and USDU (FSRA/ADGM-regulated USD) announced a regulated AED–USD conversion rail, framed as the first step toward UAE-originated trade-finance stablecoin infrastructure, and are exploring integration with cross-border trade-finance fintechs. RAKBank also received approval for an AED-backed stablecoin. Implication: the regulated AED settlement layer is arriving now. This is a tailwind (the "why now": rails finally exist for a compliant on-chain flywheel, and a licensed AED token may later settle natively) and a watch-item (if that infrastructure picks a partner for the credit layer, that partner is a competitor). Does not break the thesis; revisit the "USDC-only, AED display-only" stance with counsel as the AED-token rails mature.
- **We are not under PTSR.** Onshore UAE merchant stablecoin acceptance requires a licensed AED token + licensed PSP — but PTSR **excludes the DIFC/ADGM free zones**. A DIFC-domiciled cross-border B2B trade-finance settlement product sits under **DFSA**.
- **Compliance story = DFSA Innovation Testing Licence (ITL) sandbox + AML/CTF**, not "PTSR-compliant merchant acceptance." Never claim PTSR compliance.
- **Never say "world's first comprehensive stablecoin regulation"** (MiCA precedes it). Never say "letter of credit." Never say "we lend."

## The four surfaces

1. **Send** — importer pays a supplier. Two modes: open settlement (pay now) or **Proof-Lock** (funds lock in escrow on Polygon, release automatically when a shipment proof is attested). The spine. Real Polygon settlement, transparent FX (AED quote), record both sides see.
2. **Corridor Record** — the importer's verified cashflow ledger. Every settled payment lands here and lifts a **Corridor Score**. The underwriting primitive, made visible. The whole moat as one screen.
3. **Capital** — once the score crosses a threshold, the importer sees working-capital offers and accepts in one tap. Mirror side = financier view: a scored, de-risked borrower with a live verified cashflow feed.
4. **Receipt** — the supplier's view of an incoming settlement and the proof that released it. Closes the loop.

## The demo (90 seconds — the flywheel turning, nothing load-bearing faked)

The win is that the credit offer **visibly derives** from payments the judge just watched settle. If it appears, it's a mockup. If it derives, the flywheel is proven.

- **Setup.** Al Noor Trading (Dubai importer), Corridor Score low, two prior settled corridors in the Record. Supplier: Meridian Components, Shenzhen. Goods inbound through Jebel Ali.
- **0:00–0:20 Send a Proof-Lock.** AED-quoted USDC locks in escrow on Polygon (real Amoy tx). This is the conditional settlement a bank charges a fee and ten days to administer.
- **0:20–0:35 Condition fires.** Shipment proof attested (the one honest mock: a single inspector attestation via EAS). Funds release automatically to Meridian, settled in seconds, FX shown. 7–10 days became this.
- **0:35–0:55 Record updates, visibly.** Settlement writes to the Corridor Record; the score ticks up off the payment that just cleared. Third settled corridor crosses the threshold.
- **0:55–1:20 Capital, from a real counterparty.** Crossing the threshold surfaces Al Noor to Creek Capital (pre-loaded financier), which extends AED 50,000 working capital against the corridor. Al Noor accepts in one tap. Capital lands. A third party funded it.
- **1:20–1:30 Close.** "Al Noor was a 41%-rejection SME this morning. It just drew working capital, because Creek Capital can see three shipments settled and verified on Dhow's rails. We don't lend. We make the unfundable legible, and we hand the financing to the room."

## Revenue

- **Settlement fee** — bps on payment volume, undercutting correspondent banking + FX spread. Earns from day one with zero credit.
- **Proof-Lock premium** — small fee on conditional settlements (higher-value flows).
- **Capital match fee** — take-rate on each funded facility.
- **Data feed subscription** — financier pays for the ongoing verified cashflow stream. The recurring line and the anti-disintermediation lock: the loan stays safe only while the SME keeps settling on our rails.

## Cold-start (have this ready before a judge asks)

1. **Day one Dhow underwrites nothing.** The payment product stands alone: cheaper, faster, transparent cross-border supplier settlement vs correspondent banking. Reason enough to use it before any credit exists — so the data is earned, not assumed.
2. **Credit switches on per-SME** once an importer crosses N settled corridors.
3. **The financier side — normally the hard half of a two-sided market — is supplied by this contest.** DIFC's network + 289 banks are the demand side, handed to us by the prize structure. We launch the marketplace into pre-existing liquidity.

## Risk model decision: marketplace, not balance sheet (locked)

At the moment credit switches on, Dhow does **not** carry balance-sheet risk. It surfaces the scored SME to third-party financiers and takes a fee on the match + the ongoing data feed. Lighter, more defensible, closer to the legibility thesis, and it makes the banks in the room our demand side rather than our competition. Balance-sheet lending is earned optionality on the roadmap, not day one.

## Verified pitch figures (use these, not the brief's)

- Global trade finance gap **$2.5T** (ADB, ~10% of global merchandise trade). *Not $2T.*
- SME trade-finance rejection **~41%** (ADB 2024) vs **~7%** for multinationals (WTO). Cite the source.
- LC: **7–10 days issuance, 2–4 weeks full cycle**; buyer fees **0.75–1.5%**.
- Correspondent banking: **3–5 days**, **>3% on ~¼ of corridors** (UAE→India is efficient at ~1.5%, so don't overstate that lane).
- UAE remittance outflows **~$38.5B (2023, World Bank)**. *Not $50B.*
- Crypto: **33% YoY on-chain value growth**, $56B+ received (Chainalysis). *Not "30% adoption."* Stablecoins **~51%** of UAE crypto activity (confirmed).
- Jebel Ali **15.5M TEU (2024)**, 19.4M capacity.
- Dubai (not UAE) Cashless Strategy: **90% cashless by 2026**.

## Tech stack (see `docs/research/02-polygon-stack.md`)

- **Polygon PoS**, Amoy testnet (80002) for the demo. Lead narrative with Polygon's **Open Money Stack**.
- Next.js App Router + TS, `viem@2.52.2`, `wagmi@3.6.16`, `@tanstack/react-query`, **Privy** embedded wallet (email login, no MetaMask fight).
- Settle in **native USDC** (6 decimals, `parseUnits(x,6)`); deploy a mock 6-decimal ERC-20 on testnet.
- **Escrow:** custom ERC-20 escrow on OZ v5 `SafeERC20` + `AccessControl` + `ReentrancyGuard`; `release()` gated by an **EAS attestation** (inspector signs proof) + **arbiter** dispute fallback + **timeout refund**. (OZ v5 removed its escrow contracts — write our own.)
- Gas ~$0.002/settlement; micro-settlements are cheap.

## Build scope for the demo (hold this line — do not over-reach)

- **Real, non-negotiable:** the supplier payment flow end to end on Amoy. Send, FX quote, settle. The spine; never mocked.
- **Real, scoped:** Proof-Lock escrow with a single condition. The attestation source is the one honest mock (an inspector button).
- **Real, must be real:** the Corridor Record + score, computed off actual settlements. If the score doesn't derive from real settled payments, the demo reads as fake.
- **Demo-real:** one pre-loaded financier (Creek Capital) accepting an offer as a real on-screen state change.
- **Roadmap slides, not built:** multi-financier marketplace, balance-sheet optionality, multi-condition instruments, the 289-bank network.
