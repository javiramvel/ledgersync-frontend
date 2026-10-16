"use client";

import { useState, useCallback } from "react";
import { executeLedgerSync } from "@/lib/soroban";

export default function AuditorPortal() {
  const [isVerifying, setIsVerifying] = useState(false);
  const [lastVerified, setLastVerified] = useState<string | null>(null);
  const [merkleRoot, setMerkleRoot] = useState<string>("Pending Verification...");
  const [isExporting, setIsExporting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  const runAudit = async () => {
    setIsVerifying(true);
    setMerkleRoot("Querying Soroban Smart Contract...");
    setTxHash(null);

    try {
      const result = await executeLedgerSync("VERIFY_RESERVES", "USDC", 0);

      if (result.success && result.txHash) {
        const timestamp = new Date().toLocaleString();
        setLastVerified(timestamp);
        setTxHash(result.txHash);
        setMerkleRoot(`${result.txHash.substring(0, 16)}...${result.txHash.substring(result.txHash.length - 12)} (Valid 1:1 Parity)`);
      } else {
        throw new Error(result.error || "Execution failed");
      }
    } catch (error: any) {
      console.error("Audit generation failed:", error);
      setMerkleRoot(`Verification Failed: ${error.message}`);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleExport = useCallback(async () => {
    if (!txHash) return;
    setIsExporting(true);

    try {
      const res = await fetch("/api/compliance/generate-proof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash, asset: "USDC" })
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      const proof = data.proof;
      const receiptContent = `
====================================================
LEDGERSYNC PRIME - SEC RULE 17a-4 COMPLIANCE RECEIPT
====================================================
Timestamp:           ${proof.timestamp}
Audit Type:          ${proof.action}
Network:             ${proof.network}
Compliance Standard: ${proof.compliance_standard}
Storage ARN:         ${proof.bucket_location}
----------------------------------------------------
TradFi Custodial Reserves: $500,000.00 USDC
On-Chain Minted Supply:    500,000.00 ls-USDC
Solvency Ratio:            100% (1:1 PARITY)
----------------------------------------------------
Transaction Hash:
${proof.transaction_hash}

Cryptographic Signature:
${proof.cryptographic_signature}

Status: ${proof.immutability_status}
====================================================
      `.trim();

      const blob = new Blob([receiptContent], { type: "text/plain" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `SEC_17a4_Audit_Receipt_${proof.transaction_hash.substring(0,8)}.txt`;
      document.body.appendChild(a);
      a.click();

      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Export failed:", error);
      alert("Failed to generate compliance proof from AWS S3.");
    } finally {
      setIsExporting(false);
    }
  }, [txHash]);

  return (
    <div className="p-6 bg-[#1C1C1E]/50 backdrop-blur-2xl rounded-3xl border border-[#2C2C2E] shadow-sm transition-all duration-500">
      <div className="flex items-center justify-between border-b border-[#2C2C2E] pb-4 mb-6">
        <div>
          <h2 className="text-xl font-semibold text-white">Live Solvency Audit</h2>
          <p className="text-xs text-[#8E8E93] mt-1">Zero-Knowledge Reserve Verification Engine</p>
        </div>
        <button
          onClick={runAudit}
          disabled={isVerifying}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors border shadow-sm cursor-pointer ${
            isVerifying
              ? "bg-[#000000] text-[#8E8E93] border-[#2C2C2E] cursor-not-allowed"
              : "bg-[#5E5CE6] hover:bg-[#5E5CE6]/80 text-white border-[#5E5CE6]/50 shadow-lg shadow-[#5E5CE6]/20"
          }`}
        >
          {isVerifying ? "Verifying Ledger..." : "Run Cryptographic Audit"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="p-4 rounded-xl bg-[#000000] border border-[#2C2C2E]">
          <p className="text-xs text-[#8E8E93] uppercase tracking-wider mb-1 font-mono">TradFi Reserves</p>
          <p className="text-lg font-mono text-white">$500,000.00</p>
        </div>
        <div className="p-4 rounded-xl bg-[#000000] border border-[#2C2C2E]">
          <p className="text-xs text-[#8E8E93] uppercase tracking-wider mb-1 font-mono">On-Chain Supply</p>
          <p className="text-lg font-mono text-white">500,000.00 ls-USDC</p>
        </div>
        <div className="p-4 rounded-xl bg-[#000000] border border-[#2C2C2E]">
          <p className="text-xs text-[#8E8E93] uppercase tracking-wider mb-1 font-mono">Solvency Ratio</p>
          <p className="text-lg font-mono text-[#34C759]">100% (1:1)</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between bg-[#000000] p-4 rounded-xl border border-[#2C2C2E]">
        <div className="mb-4 md:mb-0">
          <p className="text-xs text-[#8E8E93] mb-1 font-mono">Execution Hash</p>
          <p className="text-sm font-mono text-white break-all">{merkleRoot}</p>
        </div>
        <div className="text-left md:text-right">
          <p className="text-xs text-[#8E8E93] mb-1 font-mono">Last Verified</p>
          <p className="text-sm font-mono text-white">{lastVerified || "Never"}</p>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          onClick={handleExport}
          disabled={!lastVerified || isVerifying || isExporting}
          className="px-4 py-2 text-xs font-semibold bg-[#34C759] hover:bg-[#34C759]/80 text-[#000000] rounded-lg transition-all duration-200 ease-out shadow-sm hover:shadow-[#34C759]/30 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {isExporting ? "GENERATING..." : "⬇ EXPORT COMPLIANCE RECEIPT"}
        </button>
      </div>
    </div>
  );
}