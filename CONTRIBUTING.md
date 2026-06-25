# Working on Dhow

Everything you need to run it, change it, and ship it. Read [`README.md`](README.md) for what it is and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for how it fits together.

## Prerequisites

- Node 20+ and npm
- [Foundry](https://book.getfoundry.sh/getting-started/installation) (`forge`, `anvil`, `cast`) for the contracts

## Install

```bash
npm install --legacy-peer-deps        # web3 deps need legacy peer resolution
cd contracts && forge install && cd ..  # pulls the OpenZeppelin submodule
```

## Run it (fastest)

```bash
npm run dev -- -p 4400
```

Visit http://localhost:4400. A real run needs Privy + a Neon DB + the deployed
Amoy addresses (see [`docs/SETUP.md`](docs/SETUP.md)); without them the surfaces
render but the auth/DB/chain paths gate off. To exercise the full chain flow
end to end with no faucet, use a local chain (next section).

To just look at the importer and financier surfaces with no Privy and no
database, set `NEXT_PUBLIC_PREVIEW_MODE=1` in `.env.local` and restart. The pages
render with empty state and actions disabled. Local only, never in production.

## Run the full flow on a real local chain

This exercises real contracts, real EAS attestations, real escrow release, real on-chain score, and a real fund transfer, with no faucet.

```bash
# 1. local chain
anvil

# 2. deploy the full stack (deploys MockUSDC + attestation contract + escrow + registry)
cd contracts
DEPLOYER_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
```

Copy the logged addresses into `.env.local` (see [`.env.example`](.env.example) for every key), set `DHOW_RPC_URL=http://127.0.0.1:8545`, `DHOW_CHAIN_ID=31337`, and `NEXT_PUBLIC_DEMO_MODE=1`, then `npm run dev -- -p 4400`. Every settlement, attestation, score post, and funding is now a real transaction on the local chain.

You can drive the whole sequence headless through the API (lock → attest → release → post-score → fund); each returns `mode: "chain"` with a real tx hash. Verify on-chain state with `cast` (escrow lock status, `scoreOf`, balances).

## Tests

```bash
cd contracts && forge test        # 15 passing: escrow EAS paths + every rejection + fallback, registry
npx tsc --noEmit                  # app typecheck (run from repo root)
```

## Deploy to Polygon Amoy (public testnet)

Needs a burner funded with test POL (faucet.polygon.technology or alchemy.com/faucets/polygon-amoy). Recipe and addresses in [`docs/CHAIN.md`](docs/CHAIN.md). If USDC + the attestation contract are already deployed, use the lean reuse script:

```bash
cd contracts
DEPLOYER_KEY=<funded key> DHOW_USDC_ADDRESS=<live> DHOW_EAS_ADDRESS=<live> \
  forge script script/DeployCore.s.sol --rpc-url https://rpc-amoy.polygon.technology/ --broadcast --slow
```

Then set the logged escrow + registry addresses (and the rest) as Vercel env vars and redeploy. Tip: avoid a high `--gas-estimate-multiplier`; it overpays. `--slow` (one tx at a time) is the reliable mode on the public RPC.

## Conventions

- **Branches.** Feature work off `main` (e.g. `dhow-evolved`); open a PR. `main` auto-deploys to Vercel.
- **Commits.** No `Co-Authored-By` trailers. Keep the public README signal-only (no localhost / dev-noise / TODO lists); dev detail lives here.
- **Copy.** No em dashes or dash-joined clauses in user-facing strings; no decorative sparkle icons.
- **Contracts.** Keep `forge test` green; pin the pragma; prefer custom errors; use SafeERC20 for transfers.
- **Don't fork the scoring engine** (`lib/corridor.ts`). Client and server must compute the same number.

## Repo map

```
app/
  page.tsx              landing
  onboarding/           sign in (Privy) → business → supplier → wallet
  (app)/                importer: overview, send, corridor, capital, suppliers
  (financier)/          financier: desk, opportunities, deal/[business], portfolio
  api/                  account, suppliers, corridors, attest, score, borrowers, facilities, faucet
components/             CorridorProvider, FinancierProvider, Providers, score-viz, AnimatedNumber, Sidebar
lib/                    corridor (scoring), account, db, store-server, privy-server, chain, chain-client, eas, indexer
contracts/              Foundry: src/, script/, test/
docs/                   ONBOARDING, EXPLAINER, ARCHITECTURE, BRIEF, CHAIN, SETUP, research/
```

New to the repo? Start with [`docs/ONBOARDING.md`](docs/ONBOARDING.md) for the
role-by-role walkthrough.
