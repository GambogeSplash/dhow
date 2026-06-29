import "server-only";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  keccak256,
  parseEther,
  parseUnits,
  toBytes,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

/*
 * Server-only chain layer for OPERATOR actions only: the trusted inspector's
 * EAS attestation (lib/eas.ts) and the score registry read/write. User-signed
 * settlement lives client-side in lib/chain-client.ts — Dhow never signs a
 * user's payment. Env-gated: unset config means these operator features are off.
 */

export interface ChainConfig {
  rpcUrl: string;
  signerKey: Hex;
  usdc: Hex;
  escrow: Hex;
  supplier: Hex;
  registry?: Hex; // DhowScoreRegistry (on-chain credit reputation)
  eas?: Hex; // attestation contract (canonical EAS or our registry)
  shipmentSchema?: Hex; // shipment-proof schema uid
  inspectorKey?: Hex; // signer that attests shipment proof (defaults to signerKey)
  chainId: number;
  explorerBase: string; // e.g. https://amoy.polygonscan.com/tx/
}

export function getChainConfig(): ChainConfig | null {
  const {
    DHOW_RPC_URL,
    DHOW_SIGNER_KEY,
    DHOW_USDC_ADDRESS,
    DHOW_ESCROW_ADDRESS,
    DHOW_SUPPLIER_ADDRESS,
    DHOW_REGISTRY_ADDRESS,
    DHOW_EAS_ADDRESS,
    DHOW_SHIPMENT_SCHEMA,
    DHOW_INSPECTOR_KEY,
    DHOW_CHAIN_ID,
    DHOW_EXPLORER_BASE,
  } = process.env;

  if (
    !DHOW_RPC_URL ||
    !DHOW_SIGNER_KEY ||
    !DHOW_USDC_ADDRESS ||
    !DHOW_ESCROW_ADDRESS ||
    !DHOW_SUPPLIER_ADDRESS
  ) {
    return null;
  }

  return {
    rpcUrl: DHOW_RPC_URL,
    signerKey: DHOW_SIGNER_KEY as Hex,
    usdc: DHOW_USDC_ADDRESS as Hex,
    escrow: DHOW_ESCROW_ADDRESS as Hex,
    supplier: DHOW_SUPPLIER_ADDRESS as Hex,
    registry: DHOW_REGISTRY_ADDRESS ? (DHOW_REGISTRY_ADDRESS as Hex) : undefined,
    eas: DHOW_EAS_ADDRESS ? (DHOW_EAS_ADDRESS as Hex) : undefined,
    shipmentSchema: DHOW_SHIPMENT_SCHEMA ? (DHOW_SHIPMENT_SCHEMA as Hex) : undefined,
    inspectorKey: DHOW_INSPECTOR_KEY ? (DHOW_INSPECTOR_KEY as Hex) : (DHOW_SIGNER_KEY as Hex),
    chainId: Number(DHOW_CHAIN_ID ?? 80002),
    explorerBase: DHOW_EXPLORER_BASE ?? "https://amoy.polygonscan.com/tx/",
  };
}

/*
 * The registry is written ONLY by the escrow (recordSettlement, called atomically
 * on settlement). The app never posts scores — there is no privileged off-chain
 * poster. It only READS: scoreOf/isEligible are computed live on-chain from the
 * raw settlement facts (statsOf), so a financier underwrites numbers that update
 * with the money, with no server in the trust path.
 */
const REGISTRY_ABI = [
  {
    type: "function",
    name: "scoreOf",
    stateMutability: "view",
    inputs: [{ name: "business", type: "address" }],
    outputs: [{ type: "uint16" }],
  },
  {
    type: "function",
    name: "isEligible",
    stateMutability: "view",
    inputs: [{ name: "business", type: "address" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "statsOf",
    stateMutability: "view",
    inputs: [{ name: "business", type: "address" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "settledCount", type: "uint64" },
          { name: "refundedCount", type: "uint64" },
          { name: "settledVolume", type: "uint128" },
          { name: "firstSettledAt", type: "uint64" },
          { name: "lastSettledAt", type: "uint64" },
          { name: "lastAttestation", type: "bytes32" },
        ],
      },
    ],
  },
] as const;

function clients(cfg: ChainConfig) {
  const chain = defineChain({
    id: cfg.chainId,
    name: "Dhow",
    nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
    rpcUrls: { default: { http: [cfg.rpcUrl] } },
  });
  const account = privateKeyToAccount(cfg.signerKey);
  const wallet = createWalletClient({ account, chain, transport: http(cfg.rpcUrl) });
  const pub = createPublicClient({ chain, transport: http(cfg.rpcUrl) });
  return { wallet, pub, account };
}

export function paymentId(ref: string): Hex {
  return keccak256(toBytes(ref));
}

/** A read-only public client for indexing/score reads (no signer needed). */
export function publicClient(cfg: ChainConfig) {
  return clients(cfg).pub;
}

export interface OnChainScore {
  score: number;
  eligible: boolean;
  stats: {
    settledCount: number;
    refundedCount: number;
    settledVolume: string; // USDC 6dp, as string to preserve precision
    firstSettledAt: number;
    lastSettledAt: number;
    lastAttestation: Hex;
  };
}

/** Read a business's live on-chain score, eligibility and raw settlement facts.
 *  The number is computed on-chain from the facts at read time — Dhow's server
 *  is not in the trust path, so this stays correct even if the backend is down. */
export async function readScoreOnChain(
  cfg: ChainConfig,
  business: Hex,
): Promise<OnChainScore | null> {
  if (!cfg.registry) return null;
  const pub = publicClient(cfg);
  const [score, eligible, stats] = await Promise.all([
    pub.readContract({ address: cfg.registry, abi: REGISTRY_ABI, functionName: "scoreOf", args: [business] }),
    pub.readContract({ address: cfg.registry, abi: REGISTRY_ABI, functionName: "isEligible", args: [business] }),
    pub.readContract({ address: cfg.registry, abi: REGISTRY_ABI, functionName: "statsOf", args: [business] }),
  ]);
  return {
    score: Number(score),
    eligible: Boolean(eligible),
    stats: {
      settledCount: Number(stats.settledCount),
      refundedCount: Number(stats.refundedCount),
      settledVolume: stats.settledVolume.toString(),
      firstSettledAt: Number(stats.firstSettledAt),
      lastSettledAt: Number(stats.lastSettledAt),
      lastAttestation: stats.lastAttestation,
    },
  };
}

const MINT_ABI = [
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

export interface FaucetResult {
  polTx: Hex;
  usdcTx: Hex;
  polFunded: string; // human amount
  usdcFunded: string;
}

/**
 * Testnet faucet: the operator sponsors a fresh embedded wallet with native POL
 * (gas) and mints test USDC to it, so a brand-new user can immediately settle
 * a real on-chain payment. Testnet only — MockUSDC has an open mint. Skips POL
 * if the wallet already has gas, to avoid draining the operator on repeat taps.
 */
export async function fundTestWallet(cfg: ChainConfig, to: Hex): Promise<FaucetResult> {
  const POL_AMOUNT = "0.05"; // enough for several Amoy txs
  const USDC_AMOUNT = 250_000; // generous test ceiling, 6dp
  const { wallet, pub, account } = clients(cfg);

  const balance = await pub.getBalance({ address: to });
  let polTx: Hex = ("0x" + "0".repeat(64)) as Hex;
  if (balance < parseEther("0.01")) {
    polTx = await wallet.sendTransaction({
      account,
      chain: wallet.chain,
      to,
      value: parseEther(POL_AMOUNT),
    });
    await pub.waitForTransactionReceipt({ hash: polTx });
  }

  const usdcTx = await wallet.writeContract({
    address: cfg.usdc,
    abi: MINT_ABI,
    functionName: "mint",
    args: [to, parseUnits(String(USDC_AMOUNT), 6)],
  });
  await pub.waitForTransactionReceipt({ hash: usdcTx });

  return { polTx, usdcTx, polFunded: POL_AMOUNT, usdcFunded: String(USDC_AMOUNT) };
}
