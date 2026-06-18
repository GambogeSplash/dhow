import "server-only";
import { parseAbiItem, type Hex } from "viem";
import { ChainConfig, publicClient } from "./chain";

/*
 * Thin chain indexer. Reads DhowEscrow events so the financier can see a
 * borrower's corridors derived from chain state (cross-machine), not from the
 * importer's localStorage. A short in-memory cache keeps demo-scale polling cheap.
 */

const LOCKED = parseAbiItem(
  "event Locked(bytes32 indexed corridorId, address indexed payer, address indexed supplier, uint256 amount, uint64 deadline)",
);
const RELEASED = parseAbiItem(
  "event Released(bytes32 indexed corridorId, address indexed supplier, uint256 amount, bytes32 attestationUid)",
);
const REFUNDED = parseAbiItem(
  "event Refunded(bytes32 indexed corridorId, address indexed payer, uint256 amount)",
);

export interface ChainCorridor {
  corridorId: Hex;
  payer: Hex;
  supplier: Hex;
  amountUsdc: number;
  status: "locked" | "released" | "refunded";
  attestationUid?: Hex;
}

interface CacheEntry {
  at: number;
  corridors: ChainCorridor[];
}

const cache = new Map<string, CacheEntry>();
const TTL_MS = 4000;

export async function indexCorridors(cfg: ChainConfig, payer?: Hex): Promise<ChainCorridor[]> {
  const key = payer ?? "all";
  const hit = cache.get(key);
  // Date.now is fine on the server; only workflow scripts forbid it.
  const nowMs = Date.now();
  if (hit && nowMs - hit.at < TTL_MS) return hit.corridors;

  const pub = publicClient(cfg);
  const [locked, released, refunded] = await Promise.all([
    pub.getLogs({ address: cfg.escrow, event: LOCKED, args: payer ? { payer } : undefined, fromBlock: BigInt(0) }),
    pub.getLogs({ address: cfg.escrow, event: RELEASED, fromBlock: BigInt(0) }),
    pub.getLogs({ address: cfg.escrow, event: REFUNDED, args: payer ? { payer } : undefined, fromBlock: BigInt(0) }),
  ]);

  const releasedById = new Map<string, Hex>();
  for (const r of released) releasedById.set(r.args.corridorId as string, r.args.attestationUid as Hex);
  const refundedIds = new Set(refunded.map((r) => r.args.corridorId as string));

  const corridors: ChainCorridor[] = locked.map((l) => {
    const id = l.args.corridorId as string;
    const status: ChainCorridor["status"] = refundedIds.has(id)
      ? "refunded"
      : releasedById.has(id)
        ? "released"
        : "locked";
    return {
      corridorId: id as Hex,
      payer: l.args.payer as Hex,
      supplier: l.args.supplier as Hex,
      amountUsdc: Number(l.args.amount) / 1e6,
      status,
      attestationUid: releasedById.get(id),
    };
  });

  cache.set(key, { at: nowMs, corridors });
  return corridors;
}
