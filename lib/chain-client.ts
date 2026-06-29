"use client";

import {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  http,
  keccak256,
  parseUnits,
  toBytes,
  type EIP1193Provider,
  type Hex,
} from "viem";

/*
 * Client-side settlement. The USER signs their own on-chain settlements from
 * their Privy embedded wallet — Dhow never holds funds and never signs on their
 * behalf. We build a viem WalletClient over the wallet's EIP-1193 provider and
 * a read-only public client over the RPC. Addresses come from NEXT_PUBLIC env.
 */

export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 80002);
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? "https://rpc-amoy.polygon.technology/";
export const EXPLORER_BASE =
  process.env.NEXT_PUBLIC_EXPLORER_BASE ?? "https://amoy.polygonscan.com/tx/";
const USDC = process.env.NEXT_PUBLIC_USDC_ADDRESS as Hex | undefined;
const ESCROW = process.env.NEXT_PUBLIC_ESCROW_ADDRESS as Hex | undefined;

/** True when the on-chain settlement addresses are wired. */
export function chainConfigured(): boolean {
  return !!USDC && !!ESCROW;
}

export const dhowChain = defineChain({
  id: CHAIN_ID,
  name: CHAIN_ID === 80002 ? "Polygon Amoy" : "Polygon",
  nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: {
    default: { name: "Polygonscan", url: EXPLORER_BASE.replace(/\/tx\/?$/, "") },
  },
  testnet: CHAIN_ID === 80002,
});

export function explorerUrl(hash: string): string {
  return `${EXPLORER_BASE}${hash}`;
}

export function paymentId(ref: string): Hex {
  return keccak256(toBytes(ref));
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
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

const ESCROW_ABI = [
  {
    type: "function",
    name: "lock",
    stateMutability: "nonpayable",
    inputs: [
      { name: "paymentId", type: "bytes32" },
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
      { name: "paymentId", type: "bytes32" },
      { name: "attestationUid", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "refund",
    stateMutability: "nonpayable",
    inputs: [{ name: "paymentId", type: "bytes32" }],
    outputs: [],
  },
] as const;

function clients(provider: EIP1193Provider, from: Hex) {
  const wallet = createWalletClient({ account: from, chain: dhowChain, transport: custom(provider) });
  const pub = createPublicClient({ chain: dhowChain, transport: http(RPC_URL) });
  return { wallet, pub };
}

function requireAddrs(): { usdc: Hex; escrow: Hex } {
  if (!USDC || !ESCROW) {
    throw new Error(
      "On-chain settlement is not configured. Set NEXT_PUBLIC_USDC_ADDRESS and " +
        "NEXT_PUBLIC_ESCROW_ADDRESS (see docs/SETUP.md).",
    );
  }
  return { usdc: USDC, escrow: ESCROW };
}

export interface SignResult {
  txHash: Hex;
  explorerUrl: string;
}

/** Read a wallet's gas (POL) and test-USDC balances. Returns null if unconfigured. */
export async function readBalances(
  address: Hex,
): Promise<{ pol: number; usdc: number } | null> {
  if (!USDC) return null;
  const pub = createPublicClient({ chain: dhowChain, transport: http(RPC_URL) });
  const [polWei, usdcRaw] = await Promise.all([
    pub.getBalance({ address }),
    pub.readContract({ address: USDC, abi: USDC_ABI, functionName: "balanceOf", args: [address] }) as Promise<bigint>,
  ]);
  return { pol: Number(polWei) / 1e18, usdc: Number(usdcRaw) / 1e6 };
}

/** Open settlement: a direct USDC transfer from the buyer to the supplier. */
export async function payOpen(
  provider: EIP1193Provider,
  from: Hex,
  supplier: Hex,
  amountUsdc: number,
): Promise<SignResult> {
  const { usdc } = requireAddrs();
  const { wallet, pub } = clients(provider, from);
  const hash = await wallet.writeContract({
    address: usdc,
    abi: USDC_ABI,
    functionName: "transfer",
    args: [supplier, parseUnits(amountUsdc.toFixed(6), 6)],
    chain: dhowChain,
    account: from,
  });
  await pub.waitForTransactionReceipt({ hash });
  return { txHash: hash, explorerUrl: explorerUrl(hash) };
}

/** Proof-Lock: approve the escrow (if needed) then lock funds for the payment. */
export async function lockProoflock(
  provider: EIP1193Provider,
  from: Hex,
  ref: string,
  supplier: Hex,
  amountUsdc: number,
): Promise<SignResult> {
  const { usdc, escrow } = requireAddrs();
  const { wallet, pub } = clients(provider, from);
  const amount = parseUnits(amountUsdc.toFixed(6), 6);

  const allowance = (await pub.readContract({
    address: usdc,
    abi: USDC_ABI,
    functionName: "allowance",
    args: [from, escrow],
  })) as bigint;
  if (allowance < amount) {
    const approveHash = await wallet.writeContract({
      address: usdc,
      abi: USDC_ABI,
      functionName: "approve",
      args: [escrow, amount],
      chain: dhowChain,
      account: from,
    });
    await pub.waitForTransactionReceipt({ hash: approveHash });
  }

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 7 * 86400);
  const hash = await wallet.writeContract({
    address: escrow,
    abi: ESCROW_ABI,
    functionName: "lock",
    args: [paymentId(ref), supplier, amount, deadline],
    chain: dhowChain,
    account: from,
  });
  await pub.waitForTransactionReceipt({ hash });
  return { txHash: hash, explorerUrl: explorerUrl(hash) };
}

/** Release escrowed funds against a real EAS shipment-proof attestation. */
export async function releasePayment(
  provider: EIP1193Provider,
  from: Hex,
  ref: string,
  attestationUid: Hex,
): Promise<SignResult> {
  const { escrow } = requireAddrs();
  const { wallet, pub } = clients(provider, from);
  const hash = await wallet.writeContract({
    address: escrow,
    abi: ESCROW_ABI,
    functionName: "releaseWithAttestation",
    args: [paymentId(ref), attestationUid],
    chain: dhowChain,
    account: from,
  });
  await pub.waitForTransactionReceipt({ hash });
  return { txHash: hash, explorerUrl: explorerUrl(hash) };
}

/** Refund a locked payment back to the buyer (after the on-chain deadline). */
export async function refundPayment(
  provider: EIP1193Provider,
  from: Hex,
  ref: string,
): Promise<SignResult> {
  const { escrow } = requireAddrs();
  const { wallet, pub } = clients(provider, from);
  const hash = await wallet.writeContract({
    address: escrow,
    abi: ESCROW_ABI,
    functionName: "refund",
    args: [paymentId(ref)],
    chain: dhowChain,
    account: from,
  });
  await pub.waitForTransactionReceipt({ hash });
  return { txHash: hash, explorerUrl: explorerUrl(hash) };
}
