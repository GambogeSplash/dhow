import "server-only";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  keccak256,
  parseUnits,
  toBytes,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

/*
 * Server-only chain layer. Holds the burner signer and talks to Polygon (Amoy)
 * or any EVM RPC. Fully env-gated: if the chain isn't configured the API falls
 * back to a simulated hash, so the demo runs with or without on-chain wiring.
 */

export interface ChainConfig {
  rpcUrl: string;
  signerKey: Hex;
  usdc: Hex;
  escrow: Hex;
  supplier: Hex;
  registry?: Hex; // DhowScoreRegistry (on-chain credit reputation)
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
    chainId: Number(DHOW_CHAIN_ID ?? 80002),
    explorerBase: DHOW_EXPLORER_BASE ?? "https://amoy.polygonscan.com/tx/",
  };
}

const USDC_ABI = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

const ESCROW_ABI = [
  {
    type: "function",
    name: "lock",
    stateMutability: "nonpayable",
    inputs: [
      { name: "corridorId", type: "bytes32" },
      { name: "supplier", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "deadline", type: "uint64" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "releaseWithAttestation",
    stateMutability: "nonpayable",
    inputs: [
      { name: "corridorId", type: "bytes32" },
      { name: "attestationUid", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "releaseByInspector",
    stateMutability: "nonpayable",
    inputs: [
      { name: "corridorId", type: "bytes32" },
      { name: "proofRef", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "requireEas",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "refund",
    stateMutability: "nonpayable",
    inputs: [{ name: "corridorId", type: "bytes32" }],
    outputs: [],
  },
] as const;

const REGISTRY_ABI = [
  {
    type: "function",
    name: "postScore",
    stateMutability: "nonpayable",
    inputs: [
      { name: "business", type: "address" },
      { name: "score", type: "uint16" },
      { name: "attestationUid", type: "bytes32" },
    ],
    outputs: [],
  },
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
] as const;

// "release" settles a Proof-Lock: via EAS attestation when one is supplied,
// otherwise via the inspector fallback (used when requireEas is off).
export type ChainAction = "pay" | "lock" | "release" | "refund";

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

export function corridorId(ref: string): Hex {
  return keccak256(toBytes(ref));
}

/** A read-only public client for indexing/score reads (no signer needed). */
export function publicClient(cfg: ChainConfig) {
  return clients(cfg).pub;
}

/**
 * Executes a settlement action on-chain and waits for the receipt.
 * For "release", pass an EAS `attestationUid` to settle against a real
 * attestation; omit it to fall back to the inspector path (requireEas off).
 */
export async function runChainAction(
  cfg: ChainConfig,
  action: ChainAction,
  ref: string,
  amountUsdc: number,
  attestationUid?: Hex,
): Promise<Hex> {
  const { wallet, pub } = clients(cfg);
  const cid = corridorId(ref);
  let hash: Hex;

  if (action === "pay") {
    hash = await wallet.writeContract({
      address: cfg.usdc,
      abi: USDC_ABI,
      functionName: "transfer",
      args: [cfg.supplier, parseUnits(String(amountUsdc), 6)],
    });
  } else if (action === "lock") {
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 7 * 86400);
    hash = await wallet.writeContract({
      address: cfg.escrow,
      abi: ESCROW_ABI,
      functionName: "lock",
      args: [cid, cfg.supplier, parseUnits(String(amountUsdc), 6), deadline],
    });
  } else if (action === "refund") {
    // On-chain refund reverts until the lock's deadline passes ("not expired").
    // Models a timed-out / disputed corridor returning funds to the payer.
    hash = await wallet.writeContract({
      address: cfg.escrow,
      abi: ESCROW_ABI,
      functionName: "refund",
      args: [cid],
    });
  } else if (attestationUid) {
    // Release against a real EAS shipment-proof attestation (permissionless).
    hash = await wallet.writeContract({
      address: cfg.escrow,
      abi: ESCROW_ABI,
      functionName: "releaseWithAttestation",
      args: [cid, attestationUid],
    });
  } else {
    // Inspector fallback when EAS is unavailable. proofRef is a free bytes32 tag.
    hash = await wallet.writeContract({
      address: cfg.escrow,
      abi: ESCROW_ABI,
      functionName: "releaseByInspector",
      args: [cid, keccak256(toBytes(`proof:${ref}`))],
    });
  }

  await pub.waitForTransactionReceipt({ hash });
  return hash;
}

/** Financier funding: a real USDC transfer from the burner to a business wallet. */
export async function transferUsdc(cfg: ChainConfig, to: Hex, amountUsdc: number): Promise<Hex> {
  const { wallet, pub } = clients(cfg);
  const hash = await wallet.writeContract({
    address: cfg.usdc,
    abi: USDC_ABI,
    functionName: "transfer",
    args: [to, parseUnits(String(amountUsdc), 6)],
  });
  await pub.waitForTransactionReceipt({ hash });
  return hash;
}

/** Post a freshly computed Corridor Score for a business to the on-chain registry. */
export async function postScoreOnChain(
  cfg: ChainConfig,
  business: Hex,
  score: number,
  attestationUid: Hex,
): Promise<Hex | null> {
  if (!cfg.registry) return null;
  const { wallet, pub } = clients(cfg);
  const hash = await wallet.writeContract({
    address: cfg.registry,
    abi: REGISTRY_ABI,
    functionName: "postScore",
    args: [business, score, attestationUid],
  });
  await pub.waitForTransactionReceipt({ hash });
  return hash;
}

/** Read a business's on-chain score + eligibility from the registry. */
export async function readScoreOnChain(
  cfg: ChainConfig,
  business: Hex,
): Promise<{ score: number; eligible: boolean } | null> {
  if (!cfg.registry) return null;
  const pub = publicClient(cfg);
  const [score, eligible] = await Promise.all([
    pub.readContract({ address: cfg.registry, abi: REGISTRY_ABI, functionName: "scoreOf", args: [business] }),
    pub.readContract({ address: cfg.registry, abi: REGISTRY_ABI, functionName: "isEligible", args: [business] }),
  ]);
  return { score: Number(score), eligible: Boolean(eligible) };
}
