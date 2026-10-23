import { createHash } from "node:crypto";

/**
 * Deterministic SHA-256 Merkle tree over custodial positions. Leaves are sorted so the same
 * holdings always yield the same root; odd nodes are promoted unchanged (no duplication, which
 * would let two different trees share a root).
 */

export interface MerkleLeafInput {
  accountId: string;
  securityId: string;
  /** Quantity in base units (7 decimals), as a decimal string. */
  units: string;
}

const sha256 = (b: Buffer) => createHash("sha256").update(b).digest();

export function leafHash(l: MerkleLeafInput): Buffer {
  // Domain-separate leaves (0x00) from internal nodes (0x01) to block second-preimage attacks.
  return sha256(Buffer.concat([Buffer.from([0]), Buffer.from(`${l.accountId}|${l.securityId}|${l.units}`)]));
}

export function merkleRoot(leaves: MerkleLeafInput[]): string {
  if (leaves.length === 0) return sha256(Buffer.alloc(0)).toString("hex");
  let level = leaves.map(leafHash).sort(Buffer.compare);
  while (level.length > 1) {
    const next: Buffer[] = [];
    for (let i = 0; i < level.length; i += 2) {
      next.push(i + 1 < level.length ? sha256(Buffer.concat([Buffer.from([1]), level[i], level[i + 1]])) : level[i]);
    }
    level = next;
  }
  return level[0].toString("hex");
}
