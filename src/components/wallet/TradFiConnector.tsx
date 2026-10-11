"use client";

import { useState, useEffect } from "react";
import { usePlaidLink } from "react-plaid-link";
import { createLinkToken, exchangePublicToken } from "@/app/actions/plaid";

export default function TradFiConnector({ stellarDid }: { stellarDid: string }) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isLinked, setIsLinked] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    async function initPlaid() {
      const response = await createLinkToken();
      if (response?.success && response?.link_token) {
        setLinkToken(response.link_token);
      }
    }
    if (stellarDid) {
      initPlaid();
    }
  }, [stellarDid]);

  const { open, ready } = usePlaidLink({
    token: linkToken || "",
    onSuccess: async (public_token, metadata) => {
      if (!public_token) return;
      
      console.log("Plaid connected! Exchanging token...");
      setIsProcessing(true);
      
      try {
        // 1. Exchange the token via your Next.js Server Action
        const exchangeResponse = await exchangePublicToken(public_token);
        
        if (exchangeResponse?.success) {
          console.log("Token exchanged. Routing to SEC Compliance Engine...");
          
          // 2. Trigger the S3 Audit Log & Soroban RPC Mapping
          const complianceResponse = await fetch('/api/compliance/bind-treasury', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              stellarDid: stellarDid,
              publicToken: public_token,
              institution: metadata.institution?.name || "Verified Institution"
            })
          });

          const complianceData = await complianceResponse.json();

          if (complianceData.success) {
            console.log(`SEC Audit Logged. TX Hash: ${complianceData.txHash}`);
            setIsLinked(true);
          } else {
            console.error("Compliance Engine Failed:", complianceData.error);
            alert(`Compliance Error: ${complianceData.error}`);
          }
        }
      } catch (error) {
        console.error("Secure Bridge Error:", error);
      } finally {
        setIsProcessing(false);
      }
    },
  });

  if (isLinked) {
    return (
      <div className="w-full py-3 px-4 bg-green-500/10 text-green-400 font-medium rounded-xl border border-green-500/20 text-center">
        SEC Compliant Bond Established
      </div>
    );
  }

  return (
    <button
      onClick={() => open()}
      disabled={!ready || !linkToken || isProcessing}
      className="w-full py-3 px-4 bg-white text-black font-medium rounded-xl transition-all duration-200 ease-out hover:scale-[1.02] disabled:opacity-50"
    >
      {isProcessing ? "Routing Audit Logs..." : (ready && linkToken ? "Connect Brokerage Account" : "Initializing secure bridge...")}
    </button>
  );
}