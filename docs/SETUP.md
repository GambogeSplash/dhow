# Setup — going live for real users

Dhow now runs on real identity, a real database, and real user-signed on-chain
settlement. There is no simulation mode anymore. To run it you need three
things; budget ~15 minutes.

## 1. Privy (identity + embedded wallets)

1. Create an app at https://dashboard.privy.io.
2. Enable login methods **Email** and **Wallet**, and enable **embedded
   wallets** (create on login, for users without a wallet).
3. Add your dev + prod origins to the allowed origins list.
4. Copy the **App ID** and **App secret** into `.env.local`:
   - `NEXT_PUBLIC_PRIVY_APP_ID`
   - `PRIVY_APP_SECRET`

## 2. Database (Neon / Vercel Postgres)

1. Create a Postgres database — [Neon](https://neon.tech) or, on Vercel,
   Storage → Postgres (Neon under the hood).
2. Put its connection string in `DATABASE_URL` (must allow `sslmode=require`).
3. Apply the schema:
   ```bash
   psql "$DATABASE_URL" -f db/schema.sql
   ```
   (or paste `db/schema.sql` into the Neon SQL editor).

## 3. Polygon Amoy contracts

The contracts are already deployed on Amoy (see `docs/dhow-project` notes), or
redeploy your own:

```bash
cd contracts
DEPLOYER_KEY=<operator_key> forge script script/Deploy.s.sol \
  --rpc-url https://rpc-amoy.polygon.technology/ --broadcast
```

Take the logged addresses and set, in `.env.local`:

- **Client (browser):** `NEXT_PUBLIC_USDC_ADDRESS`, `NEXT_PUBLIC_ESCROW_ADDRESS`,
  `NEXT_PUBLIC_CHAIN_ID=80002`, `NEXT_PUBLIC_RPC_URL`, `NEXT_PUBLIC_EXPLORER_BASE`.
- **Server operator:** `DHOW_SIGNER_KEY` (signs the inspector EAS attestation and
  the score-registry writes — **never** a user's payment), plus
  `DHOW_USDC_ADDRESS`, `DHOW_ESCROW_ADDRESS`, `DHOW_REGISTRY_ADDRESS`,
  `DHOW_EAS_ADDRESS`, `DHOW_SHIPMENT_SCHEMA`, `DHOW_SUPPLIER_ADDRESS`,
  `DHOW_CHAIN_ID`, `DHOW_EXPLORER_BASE`.

See `.env.example` for the complete list.

## 4. Run

```bash
npm install --legacy-peer-deps
npm run dev
```

Open the app: sign in (Privy creates an embedded wallet), complete onboarding,
add a supplier **with a wallet address**, and send a payment — your own wallet
signs the USDC transfer / escrow lock on Amoy.

## Who signs what

| Action | Signer | Where |
| --- | --- | --- |
| Open payment (USDC transfer) | **the user** | client (`lib/chain-client.ts`) |
| Proof-Lock approve + lock | **the user** | client |
| Release against attestation | **the user** | client |
| Refund | **the user** | client |
| Shipment-proof EAS attestation | inspector (operator) | server (`lib/eas.ts`) |
| Record the settlement to the score registry | **the escrow contract**, atomically on release/refund | on-chain (no operator, no `/api/score` write) |

## Funding test wallets

A new user's embedded wallet needs test **POL** (gas) and test **USDC** on Amoy
before it can settle. Fund from the Polygon faucet, or mint test USDC if you
deployed the MockUSDC (open `mint`). For production this becomes a real
fiat→USDC on-ramp; on testnet, faucet + mint is fine.

## Going to mainnet (later, gated)

Real-money settlement on Polygon mainnet requires, first: a contract audit, real
USDC liquidity, and KYC/AML onboarding. Until then, Amoy testnet keeps it
genuinely on-chain with no funds at risk.
