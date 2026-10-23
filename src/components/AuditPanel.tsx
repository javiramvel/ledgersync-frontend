"use client";

import { useCallback, useEffect, useState } from "react";
import { recentAuditRecords } from "@/app/actions/audit";
import { attestReserves } from "@/app/actions/custodian";
import type { AuditSummary } from "@/lib/audit";
import { requireContract, txUrl } from "@/lib/network";
import { fromUnits } from "@/lib/format";
import { sc } from "@/lib/soroban";
import type { Custodian } from "./useCustodian";
import type { LedgerState } from "./useLedgerState";
import { useTransaction, useWallet } from "./WalletProvider";
import { Badge, Button, Card, Stat, TxNotice } from "./ui";

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

function ProofCard({ ledger, custodian, onChange }: { ledger: LedgerState; custodian: Custodian; onChange: () => void }) {
  const { isAdmin } = useWallet();
  const tx = useTransaction(onChange);
  const p = ledger.proof;

  async function publish() {
    if (!custodian.position) return;
    tx.setState({ kind: "pending", message: "Committing custodian holdings to a Merkle root…" });
    const att = await attestReserves(custodian.position.id);
    if (!att.ok) return tx.setState({ kind: "error", message: att.error });
    await tx.run(
      "Proof of reserves",
      requireContract("solvency"),
      "publish_root",
      [sc.bytes32(att.data.merkleRoot), sc.i128(BigInt(att.data.reserveUnits)), sc.i128(ledger.totalSupply), sc.u64(BigInt(Math.floor(Date.now() / 1000)))],
      "solvency",
    );
  }

  return (
    <Card
      title="Proof of reserves"
      subtitle="A Merkle root over all custodial positions is anchored on-chain with the attested reserve and the supply it backs. Account-level data never touches the ledger."
      action={
        <Button variant="admin" onClick={publish} disabled={!isAdmin || !custodian.position} busy={tx.state.kind === "pending"}>
          Publish new proof
        </Button>
      }
    >
      {p ? (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="Status" value={p.reserves >= p.supply ? <Badge tone="green">Fully backed</Badge> : <Badge tone="red">Under-reserved</Badge>} detail={`Ledger ${p.ledger}`} />
            <Stat label="Attested reserves" value={fromUnits(p.reserves)} />
            <Stat label="Supply at attestation" value={fromUnits(p.supply)} detail={`Live supply ${fromUnits(ledger.totalSupply)}`} />
            <Stat label="Attested" value={new Date(Number(p.timestamp) * 1000).toLocaleDateString()} detail={new Date(Number(p.timestamp) * 1000).toLocaleTimeString()} />
          </div>
          <p className="mt-4 break-all rounded-xl bg-slate-50 px-4 py-3 font-mono text-xs dark:bg-black/30">Merkle root {hex(p.merkle_root)}</p>
          {p.supply !== ledger.totalSupply && (
            <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">Supply changed since the last attestation; publish a new proof.</p>
          )}
        </>
      ) : (
        <p className="text-sm text-slate-500 dark:text-slate-400">No proof published yet.</p>
      )}
      {!custodian.position && isAdmin && <p className="mt-3 text-xs text-slate-500">Connect the custodian on the Tokenization tab to attest reserves.</p>}
      <TxNotice state={tx.state} />
    </Card>
  );
}

function ArchiveCard({ refreshKey }: { refreshKey: number }) {
  const [data, setData] = useState<{ configured: boolean; records: AuditSummary[]; error?: string } | null>(null);
  const load = useCallback(() => {
    recentAuditRecords().then(setData);
  }, []);
  useEffect(() => {
    load();
  }, [load, refreshKey]);

  return (
    <Card
      title="SEC 17a-4 audit trail"
      subtitle="Every confirmed LedgerSync transaction is re-verified on-chain by the server and written to S3 Object Lock (COMPLIANCE mode)."
      action={
        <Button variant="quiet" onClick={load}>
          Refresh
        </Button>
      }
    >
      {!data && <p className="text-sm text-slate-500">Loading archive…</p>}
      {data && !data.configured && <p className="text-sm text-amber-700 dark:text-amber-300">WORM archive is not configured on this deployment (AUDIT_BUCKET).</p>}
      {data?.error && <p className="text-sm text-red-600 dark:text-red-400">{data.error}</p>}
      {data?.configured && !data.error && data.records.length === 0 && <p className="text-sm text-slate-500">No archived transactions yet.</p>}
      {data && data.records.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <th className="pb-2 font-medium">Closed</th>
              <th className="pb-2 font-medium">Contract</th>
              <th className="pb-2 font-medium">Action</th>
              <th className="pb-2 text-right font-medium">Record</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/70 dark:divide-white/5">
            {data.records.map((r) => (
              <tr key={r.key}>
                <td className="py-2 text-xs text-slate-500 dark:text-slate-400">{new Date(r.ledgerClosedAt).toLocaleString()}</td>
                <td className="py-2">{r.contractRole}</td>
                <td className="py-2 font-mono text-xs">{r.function}</td>
                <td className="py-2 text-right text-xs">
                  <a href={txUrl(r.transactionHash)} target="_blank" rel="noreferrer" className="mr-3 text-blue-600 hover:underline dark:text-blue-400">
                    Ledger ↗
                  </a>
                  <a href={`/api/audit/${r.transactionHash}`} className="text-blue-600 hover:underline dark:text-blue-400">
                    Download
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

export function AuditPanel(props: { ledger: LedgerState; custodian: Custodian; onChange: () => void; refreshKey: number }) {
  return (
    <div className="space-y-6">
      <ProofCard {...props} />
      <ArchiveCard refreshKey={props.refreshKey} />
    </div>
  );
}
