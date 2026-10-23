"use client";

import { useCallback, useState, type ReactNode } from "react";
import { network } from "@/lib/network";
import { AuditPanel } from "./AuditPanel";
import { CustodianBridge } from "./CustodianBridge";
import { TokenizationPanel } from "./TokenizationPanel";
import { YieldPanel } from "./YieldPanel";
import { useCustodian } from "./useCustodian";
import { useLedgerState } from "./useLedgerState";
import { useWallet } from "./WalletProvider";
import { Card } from "./ui";

const TABS = [
  { id: "markets", label: "Markets" },
  { id: "tokenization", label: "Tokenization" },
  { id: "yield", label: "Yield" },
  { id: "audit", label: "Audit" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export function Dashboard({ markets }: { markets: ReactNode }) {
  const [tab, setTab] = useState<Tab>("markets");
  const [refreshKey, setRefreshKey] = useState(0);
  const { address } = useWallet();
  const ledger = useLedgerState(address);
  const custodian = useCustodian();

  const onChange = useCallback(() => {
    ledger.refresh();
    setRefreshKey((k) => k + 1);
  }, [ledger]);

  const needsLedger = tab !== "markets";

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <nav aria-label="Modules" className="inline-flex rounded-xl bg-slate-200/70 p-1 dark:bg-white/10">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? "page" : undefined}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-all duration-200 ease-out ${
              tab === t.id ? "bg-white text-slate-900 shadow-sm dark:bg-white/20 dark:text-white" : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "markets" && markets}

      {needsLedger && !network.deployed && (
        <Card title={`Not deployed on ${network.label}`} subtitle="Run scripts/deploy.sh for this network, then redeploy the dashboard.">
          <p className="text-sm text-slate-500">Markets data remains available.</p>
        </Card>
      )}
      {needsLedger && network.deployed && ledger.error && (
        <Card title="Ledger unavailable" subtitle={ledger.error}>
          <button type="button" onClick={ledger.refresh} className="text-sm text-blue-600 hover:underline">
            Retry
          </button>
        </Card>
      )}
      {needsLedger && network.deployed && !ledger.state && !ledger.error && <p className="text-sm text-slate-500">Reading contract state…</p>}

      {ledger.state && tab === "tokenization" && (
        <>
          <CustodianBridge custodian={custodian} />
          <TokenizationPanel ledger={ledger.state} custodian={custodian} onChange={onChange} />
        </>
      )}
      {ledger.state && tab === "yield" && <YieldPanel ledger={ledger.state} onChange={onChange} />}
      {ledger.state && tab === "audit" && <AuditPanel ledger={ledger.state} custodian={custodian} onChange={onChange} refreshKey={refreshKey} />}
    </main>
  );
}
