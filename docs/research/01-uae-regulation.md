# UAE Stablecoin & Regulatory Landscape — Research Findings

> Citation-backed research backing the Dhow build. Compiled 2026-06-08. Every claim sourced; uncertain items flagged.

## Headline conclusions for the build

1. **No AED stablecoin is on Polygon.** AE Coin (the only fully-licensed AED stablecoin) runs on **permissioned Hyperledger Besu**, not any public EVM chain. Zand / RAKBANK / IHC tokens are pre-launch or chain-unspecified.
2. **Realistic architecture:** settle cross-border in **native USDC on Polygon PoS**, use **AED purely as display / quote / invoicing currency** (FX reference applied at quote/settlement). A bridged AE Coin path does not exist today.
3. **PTSR does not bind us.** Onshore merchant stablecoin acceptance requires a licensed AED token + licensed PSP — but the PTSR **explicitly excludes the financial free zones (DIFC/ADGM)**. A DIFC-domiciled cross-border B2B trade-finance settlement product sits under **DFSA**, not the PTSR.
4. **Compliance posture = DFSA Innovation Testing Licence (ITL) sandbox**, not "PTSR-compliant merchant acceptance." Do not claim PTSR compliance; claim DFSA-sandbox path + AML/CTF controls.
5. **"World's first comprehensive stablecoin regulation" is marketing — drop it.** MiCA precedes the PTSR. Do not put it in investor/compliance materials.

## 1. CBUAE Payment Token Services Regulation (PTSR)

- Issued as **Circular No. 2/2024. Issued 7 June 2024, effective 6 July 2024.** One-year transition ended ~June–July 2025. (A "31 Aug 2024" date seen in one source is wrong.)
  - Official: https://rulebook.centralbank.ae/en/rulebook/payment-token-services-regulation
  - https://www.regulationtomorrow.com/dubai-and-saudi/cbuae-payment-token-services-regulation/
  - https://cms.law/en/are/legal-updates/The-new-CBUAE-Payment-Token-Services-Regulation-10-things-you-need-to-know
- Three regulated activities: **Issuance, Conversion, Custody & Transfer.**
- **Dirham Payment Tokens** (AED-pegged) need a full CBUAE licence; issuer must be UAE-incorporated. **Foreign tokens** (USDC/USDT) need CBUAE registration and may only be used to purchase virtual assets — **not** as general payment for goods/services onshore.
- Issuer obligations: 100% reserves (≥50% cash in UAE banks), T+1 redemption at par, no interest to holders. Algorithmic stablecoins and privacy tokens banned.
- **Merchants may only accept licensed Dirham Payment Tokens.** USDC/USDT cannot be accepted onshore for goods/services.
- **Carve-out:** the regime applies onshore UAE and **excludes DIFC/ADGM**.
  - https://www.pinsentmasons.com/out-law/analysis/uae-digital-asset-regulation-payment-tokens-transition-end
- No published prescriptive "compliant acceptance system" technical spec exists; the framework is licensing-based. A compliant onshore setup = licensed AED token + licensed PSP + AML/CTF + safeguarding.

## 2. Who regulates what

| Regulator | Jurisdiction | Stablecoin remit |
|---|---|---|
| **CBUAE** | Onshore UAE (federal) | AED-pegged payment tokens, any "means of payment" token. Issues PTSR. |
| **VARA** | Dubai mainland (ex-DIFC) | Fiat-Referenced Virtual Assets; but AED-referenced tokens revert to CBUAE. |
| **DFSA** | **DIFC free zone** | Crypto within DIFC. **No stablecoin/payment-token issuance regime.** |
| **FSRA** | **ADGM free zone** | Has a Fiat-Referenced Token (FRT) issuance regime. |

- A DIFC fintech is **DFSA-regulated, outside PTSR scope**. It cannot issue an AED stablecoin from DIFC (CBUAE-only; ADGM is the free-zone issuance path).
- ⚠️ The exact DFSA authorisation category for cross-border stablecoin trade-finance settlement is nuanced — **confirm with DFSA/DIFC counsel.** The **DFSA Innovation Testing Licence (ITL)** sandbox is the typical entry door.
  - https://www.dfsa.ae/innovation
  - https://www.cryptoverselawyers.io/uae-stablecoin-issuance-guide/

## 3. AED stablecoin inventory

- **AE Coin** — issuer AED Stablecoin LLC, wallet partner Al Maryah Community Bank (Mbank). CBUAE final approval **Dec 2024**; first fully-licensed AED stablecoin. Real adoption: federal govt fees, Network International POS, ADNOC Distribution MoU (~980 stations), e& / Air Arabia pilots. **Runs on permissioned Hyperledger Besu** (whitepaper https://aecoin.com/downloads/whitepaper-en.pdf). NOT an ERC-20; the `0x5ca9…` "AE" token is unrelated Aeternity.
- **RAKBANK** — in-principle CBUAE approval (Jan 2026); not yet issued.
- **Zand Bank** — approval (~Nov 2025) to launch a dirham token **on public blockchains** (chains unspecified — verify before assuming Polygon).
- **IHC/ADQ/FAB** — announced; early; chain unverified.
- **Digital Dirham (CBDC)** — distinct from stablecoins; did not launch in 2025.

## 4. Stablecoins usable on Polygon today

- **Native USDC (Circle), Polygon PoS:** `0x3c499c542cef5e3811e1192ce70d8cc03d5c3359`. Use native, **not** bridged USDC.e (`0x2791…4174`).
  - **Testnet Amoy supported by Circle** with a test-USDC faucet — cleanest testnet path.
  - https://www.circle.com/blog/upcoming-support-for-polygon-pos-amoy-testnet
- **Native USDT (Tether), Polygon PoS:** `0xc2132D05D31c914a87C6611C10748AEb04B58e8F` (decimals 6; watch USDT0/LayerZero migration). No clean official testnet faucet.
- **Build recommendation:** settle in **native USDC**; USDC has first-class Amoy faucet support.

## 5. DIFC + Ignyte

- DIFC Innovation License: subsidised (~90%), includes Ignyte+ subscription. Covers regulated and non-regulated fintechs, but **regulated activity additionally requires DFSA authorisation** (start in the ITL sandbox).
  - https://www.difc.com/business/establish-a-business/ai-fintech-and-innovation-firms
  - https://landing.difc.ae/innovation-license-offer

## Open items for counsel / verification
- Exact DFSA authorisation category for cross-border stablecoin trade-finance settlement.
- Target chains for Zand / RAKBANK / IHC AED tokens (any EVM/Polygon?).
- USDT0 migration status on Polygon before integrating USDT.
