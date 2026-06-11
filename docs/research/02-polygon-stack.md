# Technical Stack — Stablecoin Payments + Conditional Escrow on Polygon

> Research current as of June 2026. Citations inline. Verify items in §Caveats before relying.

## TL;DR — what to actually use

- **Chain:** Polygon PoS. **Amoy testnet (chain ID 80002)** for the demo. RPC `https://rpc-amoy.polygon.technology/` (use a keyed Alchemy/QuickNode endpoint in prod — public RPC rate-limits). Explorer `https://amoy.polygonscan.com/`. Faucets: Alchemy (`alchemy.com/faucets/polygon-amoy`), QuickNode, ETHGlobal.
- **Frontend:** Next.js App Router + TS, `viem@2.52.2`, `wagmi@3.6.16` (note: **wagmi is on v3**, not v2), `@tanstack/react-query@^5`, **`@privy-io/react-auth@3.29.2`** for email-login embedded wallets (no MetaMask fight in the demo). Optionally `@rainbow-me/rainbowkit@2.2.11` for crypto-native users. All wagmi/query providers in a `'use client'` `app/providers.tsx`.
- **Stablecoin:** native USDC (mainnet `0x3c499c542cef5e3811e1192ce70d8cc03d5c3359`, **6 decimals**, use `parseUnits(x, 6)` not `parseEther`). On testnet, deploy our own mock 6-decimal ERC-20 (cleanest, avoids faucet dependency).
- **Escrow:** custom ERC-20 escrow on OZ v5 `SafeERC20` + `AccessControl` + `ReentrancyGuard`. Release gated by an **EAS attestation** (inspector/oracle signs the proof) with an **arbiter-role dispute fallback** and a **timeout refund** to buyer.
- **Gas:** ~$0.002 per settlement, sub-cent at scale (Paxos settled $1.3B for <$700 gas). Micro-settlements are cheap; no batching needed.

## Polygon landscape 2026

- **Target Polygon PoS** (chain ID 137 mainnet / 80002 Amoy). Polygon Labs' stated stablecoin settlement layer ("rails, not issuer"). $3.7B stablecoins issued; Stripe, Revolut, Flutterwave, Mastercard settle on it.
- **Open Money Stack** (announced Jan 2026): four layers — wallets / fiat on-off ramps / cross-chain routing / settlement. Purpose-built for cross-border stablecoin payments. **Lead the pitch narrative with Open Money Stack alignment.** https://polygon.technology/vision-open-money-stack | https://www.coindesk.com/business/2026/01/08/polygon-labs-unveils-open-money-stack-to-power-borderless-stablecoin-payments
- Cross-border processing hit **$687M monthly (Feb 2026), 170+ markets**. https://stablecoininsider.org/polygon-labs/
- POL = gas/staking token (renamed from MATIC). AggLayer = interop fabric, over-scoped for a single-chain demo; mention as scaling story only.

## Embedded wallet — Privy (recommendation)

Email/social login → auto-provisioned embedded wallet, no extension. First-class wagmi integration via `@privy-io/wagmi`. Smart-account/AA support + EIP-7702. Public **Privy + EAS demo** maps directly onto proof-locked escrow: https://github.com/privy-io/wagmi-demo | https://github.com/DecentralizedGeo/privy-eas-integration-demo | https://docs.privy.io/recipes/account-abstraction/wagmi

ERC-20 payment: wagmi `useWriteContract` → USDC `transfer(to, parseUnits(amt,6))`. Escrow deposit: `approve(escrow, amt)` then `deposit`. Mitigate the two-tx approve+transfer with EIP-2612 `permit` if the deployed USDC supports it (verify), or a paymaster for gasless (polish, not core).

## Conditional / proof-locked escrow — pattern

**Gotcha: OpenZeppelin v5 REMOVED all escrow contracts** (`Escrow`, `ConditionalEscrow`, `RefundEscrow`, `PullPayment`, `PaymentSplitter` deleted in v5.0.0). Either pin OZ 4.9.x (ETH-only escrows) or **write a focused ERC-20 escrow on v5 primitives (recommended).**

Three patterns:
- **A. Escrow-with-arbiter** — operator/arbiter calls `release()`/`refund()`. Audited reference: OpenZeppelin's Freeverse audit. https://www.openzeppelin.com/news/freeverse-crypto-payments-audit | community ERC-20 escrow https://github.com/kshyun28/erc20-escrow
- **B. Oracle attestation via EAS** (most 2026-correct) — inspector writes an on-chain EIP-712 attestation against a schema; escrow `release()` verifies a valid attestation exists before paying seller. EAS resolver contracts can attach payments to attestations. Canonical example: flight-delay insurance (swap for "shipment delivered"). https://github.com/ethereum-attestation-service/eas-contracts | https://docs.attest.org/docs/idea--zone/use--case--examples/oracles
- **C. HTLC** — only when "proof" is a secret preimage, not a human/oracle judgment. Not our case.

**Recommended architecture:** ERC-20 escrow (`SafeERC20` + `AccessControl` + `ReentrancyGuard`) where `release()` is gated by an **EAS attestation check** (pattern B), **arbiter role** fallback (A) for disputes, **buyer refund after timeout**.

## Polygon RWA / receivables note

No single flagship "trade-finance receivables on Polygon" project with a citable page. Credible references: tokenized private credit category + Securitize/Centrifuge infra (Franklin Templeton BENJI, Hamilton Lane SCOPE on Polygon). Treat as positioning narrative, not an integration target. Polygon tokenization hub: https://polygon.technology/tokenization

## Caveats to verify
1. Amoy test-USDC `0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582` is secondary-sourced — confirm on developers.circle.com or just deploy a mock ERC-20.
2. EIP-2612 `permit` on Polygon native USDC unconfirmed — check the deployed ABI; fall back to `approve`.
3. wagmi is **v3** (3.6.16) — many tutorials say "v2"; verify snippets.
4. OZ v5 has no escrow imports — pin 4.9.x or write our own.
5. Public Amoy RPC rate-limits — use keyed provider for the real app.
