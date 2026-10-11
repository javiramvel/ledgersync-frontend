"use client";

import { useState } from "react";
import { Client } from "../lib/compliance-gateway-client";
import { Networks } from "@stellar/stellar-sdk";

const rpcUrl = "https://soroban-testnet.stellar.org";
const networkPassphrase = Networks.TESTNET;

interface VerificationPayload {
  institution_wallet: string;
  signing_officers: string[];
  asset_class: number;
  is_yield_action: boolean;
}

interface ComplianceResponse {
  result: boolean;
}

interface InstitutionalClient {
  verify_execution: (payload: VerificationPayload) => Promise<ComplianceResponse>;
}

export default function ComplianceVerification() {
  const [institutionWallet, setInstitutionWallet] = useState("");
  const [status, setStatus] = useState<"IDLE" | "LOADING" | "VERIFIED" | "FAILED">("IDLE");
  const [errorMessage, setErrorMessage] = useState("");

  const verifyComplianceState = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("LOADING");
    setErrorMessage("");

    try {
      // @ts-expect-error - Bypass strict initialization checks for generated Soroban CLI client
      const rawClient = new Client({ networkPassphrase, rpcUrl });
      
      const contractClient = rawClient as unknown as InstitutionalClient;

      const executionResult = await contractClient.verify_execution({
        institution_wallet: institutionWallet,
        signing_officers: [institutionWallet],
        asset_class: 0, 
        is_yield_action: false,
      });

      if (executionResult.result) {
        setStatus("VERIFIED");
      } else {
        throw new Error("Execution rejected by on-chain compliance matrix.");
      }
    } catch (error: any) {
      console.error("[COMPLIANCE ERROR]", error);
      setStatus("FAILED");
      setErrorMessage(
        error?.message || "Verification failed. Entity may be frozen or lack threshold signatures."
      );
    }
  };

  return (
    <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 shadow-2xl relative overflow-hidden transition-all duration-500">
      <div className="flex items-center justify-between mb-6 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase tracking-wider text-blue-400 font-semibold">
              Governance Oracle
            </span>
            <span className="px-1.5 py-0.5 text-[9px] font-mono uppercase bg-slate-800 text-slate-300 border border-slate-700 rounded">
              SEC / AML
            </span>
          </div>
          <h3 className="text-xl font-bold text-white tracking-tight mt-1">
            Institutional Execution Gateway
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Cryptographically verify multi-signature governance and regulatory standing via Soroban.
          </p>
        </div>
      </div>

      <form onSubmit={verifyComplianceState} className="space-y-5">
        <div>
          <label htmlFor="wallet" className="block text-xs font-mono uppercase text-slate-400 mb-2">
            Institution Stellar Address (G...)
          </label>
          <input
            id="wallet"
            type="text"
            required
            value={institutionWallet}
            onChange={(e) => setInstitutionWallet(e.target.value.trim())}
            className="block w-full px-4 py-3 bg-slate-950/50 border border-slate-700 rounded-xl text-white font-mono text-sm placeholder-slate-600 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all outline-none"
            placeholder="GABCDEFGHIJKLMNOPQRSTUVWXYZ..."
            pattern="^G[A-Z2-7]{55}$"
            title="Must be a valid 56-character Stellar public key starting with G"
          />
        </div>

        <button
          type="submit"
          disabled={status === "LOADING" || institutionWallet.length !== 56}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {status === "LOADING" ? (
            <>
              <span className="inline-block w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></span>
              QUERYING LEDGER STATE...
            </>
          ) : (
            "VERIFY EXECUTION CLEARANCES"
          )}
        </button>
      </form>

      {status === "VERIFIED" && (
        <div className="mt-6 p-4 bg-emerald-950/30 border border-emerald-500/50 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <svg className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <div>
            <h3 className="text-emerald-400 font-semibold text-sm">Verification Successful</h3>
            <p className="text-emerald-300/80 text-xs mt-1 leading-relaxed">
              Threshold signatures are valid and the AML oracle has cleared execution for this institutional entity.
            </p>
          </div>
        </div>
      )}

      {status === "FAILED" && (
        <div className="mt-6 p-4 bg-rose-950/30 border border-rose-500/50 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <svg className="w-5 h-5 text-rose-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
          </svg>
          <div>
            <h3 className="text-rose-400 font-semibold text-sm">Execution Blocked</h3>
            <p className="text-rose-300/80 text-xs mt-1 leading-relaxed">{errorMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
}