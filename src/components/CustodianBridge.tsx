"use client";

import { useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { createLinkToken } from "@/app/actions/custodian";
import { usd } from "@/lib/format";
import type { Custodian } from "./useCustodian";
import { useWallet } from "./WalletProvider";
import { Button, Card } from "./ui";

function LinkButton({ token, onSuccess }: { token: string; onSuccess: (publicToken: string) => void }) {
  const { open, ready } = usePlaidLink({ token, onSuccess: (publicToken) => publicToken && onSuccess(publicToken) });
  return (
    <Button onClick={() => open()} disabled={!ready}>
      Connect custodian
    </Button>
  );
}

export function CustodianBridge({ custodian }: { custodian: Custodian }) {
  const { address } = useWallet();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const { snapshot, selected, setSelected, loading, error, link, unlink, refresh } = custodian;

  useEffect(() => {
    if (!address || snapshot) return;
    let cancelled = false;
    createLinkToken(address).then((res) => {
      if (cancelled) return;
      if (res.ok) setLinkToken(res.data);
      else setLinkError(res.error);
    });
    return () => {
      cancelled = true;
    };
  }, [address, snapshot]);

  const action = snapshot ? (
    <div className="flex gap-2">
      <Button variant="quiet" onClick={refresh} busy={loading}>
        Refresh
      </Button>
      <Button variant="quiet" onClick={unlink}>
        Disconnect
      </Button>
    </div>
  ) : address && linkToken ? (
    <LinkButton token={linkToken} onSuccess={link} />
  ) : null;

  return (
    <Card
      title="Custodian bridge"
      subtitle={snapshot ? `${snapshot.institution} · read ${new Date(snapshot.fetchedAt).toLocaleTimeString()}` : "Connect the brokerage or custodian that holds the underlying assets (Plaid Investments)."}
      action={action}
    >
      {!address && <p className="text-sm text-slate-500 dark:text-slate-400">Connect Freighter to bind a custodian account to your issuer wallet.</p>}
      {(error || linkError) && <p className="text-sm text-red-600 dark:text-red-400">{error || linkError}</p>}
      {address && !snapshot && loading && <p className="text-sm text-slate-500">Checking for an existing custodian session…</p>}

      {snapshot && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <th className="pb-2 font-medium">
                  <span className="sr-only">Select</span>
                </th>
                <th className="pb-2 font-medium">Security</th>
                <th className="pb-2 font-medium">Account</th>
                <th className="pb-2 text-right font-medium">Quantity</th>
                <th className="pb-2 text-right font-medium">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-white/5">
              {snapshot.positions.map((p) => (
                <tr key={p.id} className={p.id === selected ? "bg-blue-500/5" : ""}>
                  <td className="py-2 pr-2">
                    <input
                      type="radio"
                      name="position"
                      aria-label={`Back the token with ${p.ticker}`}
                      checked={p.id === selected}
                      onChange={() => setSelected(p.id)}
                      className="accent-blue-600"
                    />
                  </td>
                  <td className="py-2">
                    <p className="font-medium">{p.ticker}</p>
                    <p className="max-w-56 truncate text-xs text-slate-500 dark:text-slate-400">{p.name}</p>
                  </td>
                  <td className="py-2 text-slate-500 dark:text-slate-400">{p.accountName}</td>
                  <td className="py-2 text-right font-mono tabular-nums">{p.quantity.toLocaleString("en-US", { maximumFractionDigits: 7 })}</td>
                  <td className="py-2 text-right font-mono tabular-nums">{usd(p.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            The selected position is the reserve that backs the tokenized asset. Holdings are re-read server-side at every attestation.
          </p>
        </div>
      )}
    </Card>
  );
}
