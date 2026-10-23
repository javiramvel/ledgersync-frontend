"use client";

import { useState } from "react";
import { attestReserves } from "@/app/actions/custodian";
import { contractUrl, network, requireContract } from "@/lib/network";
import { fromUnits, shortId, toUnits } from "@/lib/format";
import { sc } from "@/lib/soroban";
import type { Custodian } from "./useCustodian";
import type { LedgerState } from "./useLedgerState";
import { useTransaction, useWallet } from "./WalletProvider";
import { Badge, Button, Card, Field, Select, Stat, TxNotice } from "./ui";

interface Props {
  ledger: LedgerState;
  custodian: Custodian;
  onChange: () => void;
}

function ReconcileCard({ ledger, custodian, onChange }: Props) {
  const { address, isAdmin } = useWallet();
  const tx = useTransaction(onChange);
  const [holder, setHolder] = useState("");
  const position = custodian.position;
  const target = position ? toUnits(position.quantity.toFixed(7)) : null;
  const delta = target !== null ? target - ledger.totalSupply : null;

  async function reconcile() {
    if (!position) return;
    tx.setState({ kind: "pending", message: "Attesting custodian reserves…" });
    const att = await attestReserves(position.id);
    if (!att.ok) return tx.setState({ kind: "error", message: att.error });
    await tx.run(
      "Reconciliation",
      requireContract("reconciliation"),
      "reconcile",
      [sc.u64(ledger.nonce + 1n), sc.i128(BigInt(att.data.reserveUnits)), sc.address(holder || address!)],
      "reconcile",
    );
  }

  return (
    <Card title="Delta reconciliation" subtitle="Mint or burn exactly the difference between custodian reserves and on-chain supply, in one atomic, replay-proof call.">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Custodian reserve" value={target !== null ? fromUnits(target, 7) : "—"} detail={position ? `${position.ticker} · ${position.accountName}` : "Select a position"} />
        <Stat label="On-chain supply" value={fromUnits(ledger.totalSupply, 7)} detail={ledger.symbol} />
        <Stat
          label="Delta"
          value={
            delta === null ? "—" : delta === 0n ? <Badge tone="green">At parity</Badge> : <span className={delta > 0n ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>{delta > 0n ? "+" : ""}{fromUnits(delta, 7)}</span>
          }
          detail={delta === null ? undefined : delta > 0n ? "Mint required" : delta < 0n ? "Burn required" : "No action needed"}
        />
      </div>
      <div className="mt-4 grid items-end gap-3 sm:grid-cols-[1fr_auto]">
        <Field label="Holder wallet" placeholder={address ?? "G…"} value={holder} onChange={(e) => setHolder(e.target.value.trim())} hint="Receives mints / is debited on burns. Must be a registered institution. Defaults to the connected wallet." />
        <Button variant={delta !== null && delta < 0n ? "danger" : "success"} onClick={reconcile} disabled={!isAdmin || !position || delta === 0n} busy={tx.state.kind === "pending"}>
          {delta !== null && delta < 0n ? "Burn to parity" : "Mint to parity"}
        </Button>
      </div>
      {!isAdmin && address && <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">Only the issuer admin wallet ({shortId(network.admin ?? "")}) can reconcile.</p>}
      <TxNotice state={tx.state} />
    </Card>
  );
}

const SPLITS = { "2:1": [2, 1], "3:1": [3, 1], "3:2": [3, 2], "1:2": [1, 2], "1:10": [1, 10] } as const;

function SplitCard({ ledger, onChange }: Pick<Props, "ledger" | "onChange">) {
  const { isAdmin } = useWallet();
  const tx = useTransaction(onChange);
  const [ratio, setRatio] = useState<keyof typeof SPLITS>("2:1");
  const [num, den] = SPLITS[ratio];
  const projected = (ledger.totalSupply * BigInt(num)) / BigInt(den);

  return (
    <Card title="Stock split" subtitle="Re-scales every holder balance in O(1) through the asset's global split ratio.">
      <div className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <Select label="Ratio" value={ratio} onChange={(e) => setRatio(e.target.value as keyof typeof SPLITS)}>
          {(Object.entries(SPLITS) as [keyof typeof SPLITS, readonly [number, number]][]).map(([r, [n, d]]) => (
            <option key={r} value={r}>
              {r} {n > d ? "forward" : "reverse"}
            </option>
          ))}
        </Select>
        <Stat label="Supply after split" value={fromUnits(projected, 2)} detail={`Current ratio ${ledger.splitRatio[0]}:${ledger.splitRatio[1]}`} />
        <Button variant="admin" disabled={!isAdmin} busy={tx.state.kind === "pending"} onClick={() => tx.run(`${ratio} split`, requireContract("asset"), "execute_split", [sc.u32(num), sc.u32(den)], "asset")}>
          Execute split
        </Button>
      </div>
      <TxNotice state={tx.state} />
    </Card>
  );
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function OnboardingCard({ onChange }: { onChange: () => void }) {
  const { isAdmin } = useWallet();
  const tx = useTransaction(onChange);
  const [wallet, setWallet] = useState("");
  const [lei, setLei] = useState("");
  const [officers, setOfficers] = useState("");
  const [threshold, setThreshold] = useState("1");

  async function register() {
    const officerList = officers.split(/[\s,]+/).filter(Boolean);
    if (!/^[A-Z0-9]{20}$/.test(lei)) return tx.setState({ kind: "error", message: "LEI must be 20 uppercase alphanumeric characters (ISO 17442)." });
    const leiHash = await sha256Hex(lei);
    await tx.run(
      "Institution onboarding",
      requireContract("compliance"),
      "register_institution",
      [sc.address(wallet), sc.bytes32(leiHash), sc.u32(Number(threshold)), sc.addresses(officerList.length ? officerList : [wallet])],
      "compliance",
    );
  }

  return (
    <Card title="Institution onboarding" subtitle="Whitelist a KYC'd entity. Only registered, active wallets can receive or transfer the asset.">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Institution wallet" placeholder="G…" value={wallet} onChange={(e) => setWallet(e.target.value.trim())} />
        <Field label="Legal Entity Identifier" placeholder="5493001KJTIIGC8Y1R12" value={lei} onChange={(e) => setLei(e.target.value.trim().toUpperCase())} hint="Only its SHA-256 hash is stored on-chain." />
        <Field label="Authorized officers" placeholder="G…, G…" value={officers} onChange={(e) => setOfficers(e.target.value)} hint="Defaults to the institution wallet." />
        <Field label="Signature threshold" type="number" min={1} value={threshold} onChange={(e) => setThreshold(e.target.value)} />
      </div>
      <div className="mt-4 flex justify-end">
        <Button variant="admin" disabled={!isAdmin || !wallet || !lei} busy={tx.state.kind === "pending"} onClick={register}>
          Register institution
        </Button>
      </div>
      <TxNotice state={tx.state} />
    </Card>
  );
}

export function TokenizationPanel(props: Props) {
  const { ledger } = props;
  const { address } = useWallet();
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat
          label="Tokenized asset"
          value={ledger.symbol}
          detail={
            <a href={contractUrl(network.contracts.asset!)} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
              {ledger.name} ↗
            </a>
          }
        />
        <Stat label="Circulating supply" value={fromUnits(ledger.totalSupply)} detail={`Split ratio ${ledger.splitRatio[0]}:${ledger.splitRatio[1]}`} />
        <Stat label="Last attested reserve" value={fromUnits(ledger.custodianBalance)} detail={`Attestation #${ledger.nonce}`} />
        <Stat
          label="Your position"
          value={ledger.walletBalance === null ? "—" : fromUnits(ledger.walletBalance)}
          detail={address ? (ledger.walletCompliant ? "Registered institution" : "Not registered") : "Connect wallet"}
        />
      </div>
      <ReconcileCard {...props} />
      <div className="grid gap-6 lg:grid-cols-2">
        <SplitCard ledger={ledger} onChange={props.onChange} />
        <OnboardingCard onChange={props.onChange} />
      </div>
    </div>
  );
}
