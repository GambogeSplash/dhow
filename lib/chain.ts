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
    name: "attestRelease",
    stateMutability: "nonpayable",
    inputs: [
      { name: "corridorId", type: "bytes32" },
      { name: "proofRef", type: "string" },
    ],
    outputs: [],
  },
] as const;

export type ChainAction = "pay" | "lock" | "attest";

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

/** Executes the action on-chain and waits for the receipt. Returns the tx hash. */
export async function runChainAction(
  cfg: ChainConfig,
  action: ChainAction,
  ref: string,
  amountUsdc: number,
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
  } else {
    hash = await wallet.writeContract({
      address: cfg.escrow,
      abi: ESCROW_ABI,
      functionName: "attestRelease",
      args: [cid, "Bill of lading - Jebel Ali inbound"],
    });
  }

  await pub.waitForTransactionReceipt({ hash });
  return hash;
}
