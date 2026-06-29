# Dhow — On-chain settlement

The Send and Attest actions fire **real EVM transactions**. The app is fully env-gated: with no chain config it falls back to simulated hashes, so the demo always runs.

## Contracts (`/contracts`, Foundry)

- **MockUSDC.sol** — 6-decimal ERC-20 with open `mint` (no faucet needed for the settlement asset).
- **DhowEscrow.sol** — Proof-Lock conditional settlement:
  - `lock(paymentId, supplier, amount, deadline)` — pulls USDC into escrow (payer pre-approves).
  - `attestRelease(paymentId, proofRef)` — attester-only; releases to supplier. (Production swaps the attester role for an EAS attestation check.)
  - `refund(paymentId)` — returns funds to payer after the deadline if no proof arrives.
  - Reentrancy-guarded; 6 passing tests in `test/DhowEscrow.t.sol`.

Run tests: `cd contracts && forge test -vv`

## App wiring

- `lib/chain.ts` — server-only viem layer (burner signer, minimal ABIs, env config). `paymentId(ref) = keccak256(ref)`.
- `app/api/chain/route.ts` — POST `{ action: 'pay'|'lock'|'attest', ref, amountUsdc }` → `{ mode: 'chain'|'sim', txHash, explorerUrl }`. Fail-soft: any RPC error returns a sim hash so the demo never stalls.
- `components/CreditProvider.tsx` — `send`/`attest` update optimistically, then patch the real tx hash + polygonscan link when the receipt lands. Open settlement = direct USDC `transfer`; Proof-Lock = `lock` then `attestRelease`.

## Run locally against anvil (deterministic addresses)

```bash
# 1. start a local chain
anvil                       # keeps running; key0 funds everything

# 2. deploy (addresses are deterministic on a fresh anvil)
cd contracts
DEPLOYER_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast

# 3. .env.local already points at these (USDC 0x5FbDB23…, escrow 0x9fE46736…)
npm run dev -- -p 4400
```

Verified end-to-end on anvil: lock pulls 112,185.16 USDC into escrow → attestRelease sends it to the supplier (supplier balance 0 → 112,185,160,000). Real tx hashes render as explorer links in the Cashflow Record.

## Go live on Polygon Amoy (the one manual gate)

Everything is ready; the only blocker is funding a key with test POL.

1. Fund a burner address with test POL — Alchemy/QuickNode/ETHGlobal faucet (`ethglobal.com/faucet/polygon-amoy-80002`).
2. Deploy: `cd contracts && DEPLOYER_KEY=<funded key> forge script script/Deploy.s.sol --rpc-url https://rpc-amoy.polygon.technology/ --broadcast`
3. Copy the logged addresses into `.env.local` (see `.env.example`), set `DHOW_CHAIN_ID=80002` and `DHOW_EXPLORER_BASE=https://amoy.polygonscan.com/tx/`.
4. Restart `npm run dev`. Send/Attest now produce real Amoy transactions with live polygonscan links — the "live tx in front of judges" moment.
