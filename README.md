# Dhow

**Stablecoin settlement that makes the unfundable legible.**

Dhow settles cross-border supplier payments in stablecoin on Polygon in minutes, not days. Every settlement writes a verified on-chain cashflow record — a *Corridor Score* — that turns an importer's trade history into creditworthiness. Once the score crosses an eligibility threshold, Dhow surfaces the SME to third-party financiers who fund the cashflow they can see, rather than an attestation they have to trust.

We don't ask anyone to digitise trade. We pay their suppliers, and the ledger falls out.

Built for **The Smart Commerce Infrastructure Challenge** (Polygon × DIFC × Ignyte).

## The loop

1. **Pay the supplier** — open settlement, or a Proof-Lock that escrows on-chain and releases automatically when shipment proof is attested.
2. **The record writes itself** — each settled corridor lifts the Corridor Score, a transparent function of settled volume, proof performance and cadence.
3. **Capital unlocks** — cross the threshold and a working-capital offer derives from the settled history. The financier (Creek Capital) carries the risk; Dhow is a marketplace, not a balance-sheet lender.

## Architecture

The app is a thin, legible client over a pure scoring engine and an env-gated chain layer. The seams are deliberate so a backend can swap in without touching the surfaces.

| Layer | File | Role |
| --- | --- | --- |
| Scoring engine | `lib/corridor.ts` | Pure, chain-agnostic. Corridor Score + advance sizing as transparent functions of settled corridors. |
| Seed / fixtures | `lib/seed.ts` | Importer, financier, supplier, and the starting ledger. |
| State seam | `components/CorridorProvider.tsx` | Client store + actions (`send` / `attest` / `acceptOffer`). Calls the chain route, optimistically updates, then patches the real tx hash. Session-persisted so a refresh keeps the walked state. **This is where a real backend plugs in.** |
| Chain layer | `app/api/chain/route.ts`, `lib/chain.ts` | Server-only viem signer. `POST` an action → real Polygon tx hash, or a simulated hash when no chain env is configured (the demo always runs). |
| Surfaces | `app/(app)/{send,corridor,capital}` | Send · Corridor Record · Capital. |

Design language: light, operator-grade trade-ledger. Tokens in `app/globals.css` (chart-paper, indigo ink, verdigris teal for settle/trust, brass for value moments). Spectral display serif + Geist Sans + Geist Mono with tabular figures.

## Run it

```bash
npm install --legacy-peer-deps
npm run dev -- -p 4400
```

Open http://localhost:4400. With no chain env configured the app runs in simulation mode — full flywheel, synthetic tx hashes. To settle on-chain, see [`docs/CHAIN.md`](docs/CHAIN.md).

## Contracts

Foundry workspace in [`contracts/`](contracts): `DhowEscrow.sol` (lock / attest-release / timeout-refund, reentrancy-guarded) and `MockUSDC.sol`, with a passing test suite.

```bash
cd contracts && forge test
```

## Docs

- [`docs/BRIEF.md`](docs/BRIEF.md) — product spec
- [`docs/APPLICATION.md`](docs/APPLICATION.md) — contest application
- [`docs/CHAIN.md`](docs/CHAIN.md) — on-chain settlement recipe
- [`docs/research/`](docs/research) — regulation, Polygon stack, trade-finance benchmarks, competitive landscape
