import "server-only";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  encodeAbiParameters,
  http,
  parseAbiParameters,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ChainConfig, corridorId } from "./chain";

/*
 * Server-only EAS layer. The trusted inspector ("Gulf Inspectorate") signs a
 * real on-chain shipment-proof attestation; DhowEscrow.releaseWithAttestation
 * then verifies it before releasing funds. Env-gated + fail-soft like the chain
 * layer: with no EAS configured, returns a simulated uid so the demo still runs.
 */

const EAS_ABI = [
  {
    type: "function",
    name: "attest",
    stateMutability: "nonpayable",
    inputs: [
      { name: "schema", type: "bytes32" },
      { name: "recipient", type: "address" },
      { name: "expirationTime", type: "uint64" },
      { name: "data", type: "bytes" },
    ],
    outputs: [{ name: "uid", type: "bytes32" }],
  },
] as const;

// Schema: bytes32 corridorId, string ref, string docType, string portOfEntry, uint64 inspectedAt, address supplier
const SCHEMA_PARAMS = parseAbiParameters(
  "bytes32 corridorId, string ref, string docType, string portOfEntry, uint64 inspectedAt, address supplier",
);

export interface AttestationResult {
  uid: Hex;
  txHash: Hex | null; // null in sim mode
  explorerUrl: string | null;
}

export function easConfigured(cfg: ChainConfig): boolean {
  return !!cfg.eas && !!cfg.shipmentSchema;
}

function clients(cfg: ChainConfig) {
  const chain = defineChain({
    id: cfg.chainId,
    name: "Dhow",
    nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
    rpcUrls: { default: { http: [cfg.rpcUrl] } },
  });
  const account = privateKeyToAccount((cfg.inspectorKey ?? cfg.signerKey) as Hex);
  const wallet = createWalletClient({ account, chain, transport: http(cfg.rpcUrl) });
  const pub = createPublicClient({ chain, transport: http(cfg.rpcUrl) });
  return { wallet, pub, account };
}

/**
 * Create a shipment-proof attestation for a corridor and return its uid.
 * The uid is then passed to DhowEscrow.releaseWithAttestation to settle.
 */
export async function createShipmentAttestation(
  cfg: ChainConfig,
  ref: string,
  supplier: Hex,
): Promise<AttestationResult> {
  const cid = corridorId(ref);
  const inspectedAt = BigInt(Math.floor(Date.now() / 1000));
  const data = encodeAbiParameters(SCHEMA_PARAMS, [
    cid,
    ref,
    "Bill of Lading",
    "Jebel Ali",
    inspectedAt,
    supplier,
  ]);

  const { wallet, pub } = clients(cfg);
  // Simulate first to read the returned uid, then commit the attestation.
  const { result: uid } = await pub.simulateContract({
    address: cfg.eas!,
    abi: EAS_ABI,
    functionName: "attest",
    args: [cfg.shipmentSchema!, supplier, BigInt(0), data],
    account: wallet.account,
  });
  const txHash = await wallet.writeContract({
    address: cfg.eas!,
    abi: EAS_ABI,
    functionName: "attest",
    args: [cfg.shipmentSchema!, supplier, BigInt(0), data],
  });
  await pub.waitForTransactionReceipt({ hash: txHash });

  return { uid: uid as Hex, txHash, explorerUrl: `${cfg.explorerBase}${txHash}` };
}
