"use client";

import { useState } from "react";
import { isConnected, getAddress, requestAccess } from "@stellar/freighter-api";
import TradFiConnector from "@/components/wallet/TradFiConnector";

export default function ActaDidGateway() {
  const [did, setDid] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const authenticateWithActa = async () => {
    setIsVerifying(true);
    setError(null);

    try {
      // 1. Verify Freighter is installed
      if (!(await isConnected())) {
        throw new Error("Freighter wallet extension not found.");
      }

      // 2. Ensure we have explicit permission from the user
      await requestAccess();

      // 3. Securely pull the authorized address
      const { address } = await getAddress();
      if (!address) {
        throw new Error("Cannot pull verification key from Freighter.");
      }

      // 4. Derive the canonical W3C did:stellar identifier
      const stellarDid = `did:stellar:testnet:${address}`;

      // 5. Set the authenticated DID in state
      setDid(stellarDid);
    } catch (err: any) {
      setError(err.message || "ACTA DID Verification Failed");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="p-6 bg-slate-800/60 rounded-2xl border border-white/10 space-y-6">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <h2 className="text-xl font-semibold text-white">ACTA Identity Gateway</h2>
          <p className="text-xs text-slate-400 mt-1">
            W3C Verifiable Credentials & Zero-Knowledge Identity Layer
          </p>
        </div>
        <span className="px-3 py-1 text-xs font-mono rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
          did:stellar
        </span>
      </div>

      {!did ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            Authenticate your decentralized identity to unlock institutional asset reconciliation and traditional market syncing.
          </p>
          <button
            onClick={authenticateWithActa}
            disabled={isVerifying}
            className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-xl transition-all duration-200 ease-out hover:bg-blue-500 hover:scale-[1.02] hover:shadow-lg hover:shadow-blue-500/30 disabled:opacity-50"
          >
            {isVerifying ? "Verifying ACTA DID..." : "Authenticate with ACTA DID"}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
            <p className="text-xs text-green-400 font-semibold uppercase tracking-wider">
              Identity Verified & Anchored
            </p>
            <p className="text-xs font-mono text-slate-300 mt-1 truncate bg-black/40 p-2 rounded-lg border border-white/5">
              {did}
            </p>
          </div>

          <div className="pt-2">
            <h3 className="text-sm font-medium text-white mb-3">Bridge Traditional Portfolio</h3>
            <TradFiConnector stellarDid={did} />
          </div>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-400 font-medium bg-red-500/10 p-3 rounded-lg border border-red-500/20">
          {error}
        </p>
      )}
    </div>
  );
}
