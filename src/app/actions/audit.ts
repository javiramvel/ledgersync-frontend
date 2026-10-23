"use server";

import { auditConfigured, listRecords, recordTransaction, type AuditSummary } from "@/lib/audit";

export type AuditResult = { ok: true; key: string; created: boolean } | { ok: false; error: string };

/** Archives a confirmed LedgerSync transaction to WORM storage after verifying it on-chain. */
export async function archiveTransaction(hash: string): Promise<AuditResult> {
  if (!auditConfigured()) return { ok: false, error: "WORM archive not configured (AUDIT_BUCKET)." };
  try {
    return { ok: true, ...(await recordTransaction(hash.toLowerCase())) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function recentAuditRecords(): Promise<{ configured: boolean; records: AuditSummary[]; error?: string }> {
  if (!auditConfigured()) return { configured: false, records: [] };
  try {
    return { configured: true, records: await listRecords() };
  } catch (e) {
    return { configured: true, records: [], error: (e as Error).message };
  }
}
