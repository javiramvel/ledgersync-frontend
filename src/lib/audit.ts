import "server-only";
import { createHash } from "node:crypto";
import {
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Address, StrKey, TransactionBuilder, rpc, scValToNative, xdr } from "@stellar/stellar-sdk";
import { network } from "./network";
import { server } from "./soroban";

/**
 * SEC Rule 17a-4(f) audit trail. Every confirmed LedgerSync transaction is re-read from the
 * ledger by the server (the client is never trusted), normalised, hashed and written to an S3
 * bucket with Object Lock in COMPLIANCE mode, so no one, including the AWS root user, can alter
 * or delete it before the retention date.
 */

const BUCKET = process.env.AUDIT_BUCKET;
const RETENTION_YEARS = Number(process.env.AUDIT_RETENTION_YEARS || 6);
const PREFIX = `ledgersync/${network.name}/`;

// Credentials come from the default provider chain (ECS task role in AWS, env vars locally).
const s3 = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });

export interface AuditRecord {
  schema: "ledgersync.audit.v1";
  standard: "SEC Rule 17a-4(f)";
  network: string;
  transactionHash: string;
  ledger: number;
  ledgerClosedAt: string;
  sourceAccount: string;
  contractId: string;
  contractRole: string;
  function: string;
  arguments: unknown[];
  envelopeXdr: string;
  resultXdr: string;
  recordedAt: string;
  retainUntil: string;
  /** SHA-256 of this record without the `digest` field. */
  digest: string;
}

export interface AuditSummary {
  transactionHash: string;
  function: string;
  contractRole: string;
  ledgerClosedAt: string;
  key: string;
}

export function auditConfigured(): boolean {
  return Boolean(BUCKET);
}

function roleOf(contractId: string): string | null {
  const entry = Object.entries(network.contracts).find(([, id]) => id === contractId);
  return entry ? entry[0] : null;
}

function keyFor(hash: string, closedAt: Date): string {
  const y = closedAt.getUTCFullYear();
  const m = String(closedAt.getUTCMonth() + 1).padStart(2, "0");
  return `${PREFIX}${y}/${m}/${hash}.json`;
}

function jsonSafe(v: unknown): unknown {
  if (typeof v === "bigint") return v.toString();
  if (v instanceof Uint8Array) return Buffer.from(v).toString("hex");
  if (Array.isArray(v)) return v.map(jsonSafe);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, jsonSafe(x)]));
  return v;
}

async function exists(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

/** Verifies `hash` on-chain and writes its immutable audit record. Idempotent. */
export async function recordTransaction(hash: string): Promise<{ key: string; created: boolean }> {
  if (!BUCKET) throw new Error("AUDIT_BUCKET is not configured.");
  if (!/^[0-9a-f]{64}$/.test(hash)) throw new Error("Invalid transaction hash.");

  const tx = await server.getTransaction(hash);
  if (tx.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
    throw new Error(`Transaction is ${tx.status}; only successful transactions are archived.`);
  }

  const envelope = TransactionBuilder.fromXDR(tx.envelopeXdr, network.passphrase);
  const inner = "innerTransaction" in envelope ? envelope.innerTransaction : envelope;
  const op = inner.operations[0];
  if (inner.operations.length !== 1 || op.type !== "invokeHostFunction") {
    throw new Error("Not a LedgerSync contract invocation.");
  }
  const fn = op.func;
  if (fn.switch() !== xdr.HostFunctionType.hostFunctionTypeInvokeContract()) {
    throw new Error("Not a LedgerSync contract invocation.");
  }
  const call = fn.invokeContract();
  const contractId = Address.fromScAddress(call.contractAddress()).toString();
  const role = roleOf(contractId);
  if (!role || !StrKey.isValidContract(contractId)) throw new Error("Transaction did not target a LedgerSync contract.");

  const closedAt = new Date(Number(tx.createdAt) * 1000);
  const key = keyFor(hash, closedAt);
  if (await exists(key)) return { key, created: false };

  const retainUntil = new Date(closedAt);
  retainUntil.setUTCFullYear(retainUntil.getUTCFullYear() + RETENTION_YEARS);

  const body: Omit<AuditRecord, "digest"> = {
    schema: "ledgersync.audit.v1",
    standard: "SEC Rule 17a-4(f)",
    network: network.label,
    transactionHash: hash,
    ledger: tx.ledger,
    ledgerClosedAt: closedAt.toISOString(),
    sourceAccount: inner.source,
    contractId,
    contractRole: role,
    function: call.functionName().toString(),
    arguments: call.args().map((a) => jsonSafe(scValToNative(a))),
    envelopeXdr: tx.envelopeXdr.toXDR("base64"),
    resultXdr: tx.resultXdr.toXDR("base64"),
    recordedAt: new Date().toISOString(),
    retainUntil: retainUntil.toISOString(),
  };
  const digest = createHash("sha256").update(JSON.stringify(body)).digest("hex");
  const record: AuditRecord = { ...body, digest };

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: JSON.stringify(record, null, 2),
      ContentType: "application/json",
      ObjectLockMode: "COMPLIANCE",
      ObjectLockRetainUntilDate: retainUntil,
      ChecksumAlgorithm: "SHA256",
      Metadata: { "tx-hash": hash, function: body.function, role },
    }),
  );
  return { key, created: true };
}

export async function listRecords(limit = 25): Promise<AuditSummary[]> {
  if (!BUCKET) return [];
  const out = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: PREFIX, MaxKeys: 1000 }));
  const keys = (out.Contents ?? [])
    .sort((a, b) => (b.LastModified?.getTime() ?? 0) - (a.LastModified?.getTime() ?? 0))
    .slice(0, limit);
  return Promise.all(
    keys.map(async (o) => {
      const rec = await getRecordByKey(o.Key!);
      return {
        transactionHash: rec.transactionHash,
        function: rec.function,
        contractRole: rec.contractRole,
        ledgerClosedAt: rec.ledgerClosedAt,
        key: o.Key!,
      };
    }),
  );
}

async function getRecordByKey(key: string): Promise<AuditRecord> {
  const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  return JSON.parse(await res.Body!.transformToString()) as AuditRecord;
}

export async function getRecord(hash: string): Promise<AuditRecord | null> {
  if (!BUCKET || !/^[0-9a-f]{64}$/.test(hash)) return null;
  const tx = await server.getTransaction(hash);
  if (tx.status !== rpc.Api.GetTransactionStatus.SUCCESS) return null;
  const key = keyFor(hash, new Date(Number(tx.createdAt) * 1000));
  return (await exists(key)) ? getRecordByKey(key) : null;
}
