"use client";

import { useState, useEffect } from "react";
import { isConnected, requestAccess } from "@stellar/freighter-api";

export default function FreighterConnect() {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [hasFreighter, setHasFreighter] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkFreighter = async () => {
      // TypeScript override for the updated Freighter API response
      const response: any = await isConnected();
      setHasFreighter(response.isConnected === true || response === true);
    };
    checkFreighter();
  }, []);

  const connectWallet = async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const response = await requestAccess();
      if (response.error) {
        setError(response.error);
      } else if (response.address) {
        setPublicKey(response.address);
      }
    } catch (err: any) {
      setError(err.message || "Failed to connect to Freighter");
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setPublicKey(null);
  };

  return (
    <div className="p-6 bg-slate-50/50 dark:bg-black/20 rounded-2xl border border-slate-200/50 dark:border-white/5 transition-all">
      <h2 className="text-xl font-semibold mb-4">
        Corporate Treasury Access
      </h2>

      {!hasFreighter ? (
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl backdrop-blur-md">
          <p className="text-yellow-700 dark:text-yellow-400 font-medium text-sm">
            Freighter Wallet not detected.
          </p>
          <a
            href="https://freighter.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline text-sm mt-1 inline-block"
          >
            Download Freighter Extension to continue
          </a>
        </div>
      ) : !publicKey ? (
        <button
          onClick={connectWallet}
          disabled={isConnecting}
          className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-xl transition-all duration-200 ease-out hover:bg-blue-500 hover:scale-[1.02] hover:shadow-lg hover:shadow-blue-500/30 disabled:opacity-50 disabled:hover:scale-100"
        >
          {isConnecting ? "Connecting to Freighter..." : "Connect Treasury Wallet"}
        </button>
      ) : (
        <div className="space-y-5">
          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl backdrop-blur-md">
            <p className="text-green-700 dark:text-green-400 text-sm font-semibold">Status: Authorized</p>
            <p className="text-slate-600 dark:text-slate-400 text-xs mt-1 truncate font-mono bg-white/50 dark:bg-black/50 p-2 rounded-lg border border-slate-200 dark:border-white/5">
              {publicKey}
            </p>
          </div>
          <button
            onClick={disconnectWallet}
            className="w-full py-2 px-4 bg-slate-200 dark:bg-white/10 text-slate-800 dark:text-white font-medium rounded-xl transition-all duration-200 ease-out hover:bg-red-600 hover:text-white hover:scale-[1.02] hover:shadow-lg hover:shadow-red-500/30"
          >
            Disconnect Session
          </button>
        </div>
      )}

      {error && (
        <p className="mt-4 text-sm text-red-500 font-medium">
          {error}
        </p>
      )}
    </div>
  );
}
