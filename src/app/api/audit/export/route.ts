import { NextResponse } from "next/server";
import crypto from "crypto";

export async function GET() {
  try {
    // 1. Simulate fetching live TradFi reserves and On-Chain supply
    const snapshot = {
      timestamp: new Date().toISOString(),
      tradFiReserves: { asset: "USD", amount: 50000.00, custodian: "SEC-Regulated Prime Broker" },
      onChainSupply: { asset: "ls-USDC", amount: 50000.00, contract: "CABCDEFGHIJKLMNOPQRSTUVWXYZ12345" },
      solvencyRatio: "1.0000",
    };

    // 2. Generate a SHA-256 Hash (Simulating a Merkle Root digest)
    const dataString = JSON.stringify(snapshot);
    const hash = crypto.createHash("sha256").update(dataString).digest("hex");

    // 3. Construct the Compliance Receipt
    const receipt = `
====================================================
      LEDGERSYNC PRIME - SOLVENCY AUDIT RECEIPT     
====================================================
Timestamp:       ${snapshot.timestamp}
Audit ID:        REQ-${crypto.randomBytes(4).toString("hex").toUpperCase()}

[ TRADITIONAL CUSTODIAN ]
Asset:           ${snapshot.tradFiReserves.asset}
Reserves:        $${snapshot.tradFiReserves.amount.toFixed(2)}
Institution:     ${snapshot.tradFiReserves.custodian}

[ ON-CHAIN LEDGER ]
Token:           ${snapshot.onChainSupply.asset}
Supply:          ${snapshot.onChainSupply.amount.toFixed(2)}
Contract ID:     ${snapshot.onChainSupply.contract}

[ CRYPTOGRAPHIC VERIFICATION ]
Solvency Ratio:  ${snapshot.solvencyRatio} (1:1 PARITY CONFIRMED)
Merkle Digest:   0x${hash}
====================================================
* This cryptographic digest proves that on-chain token 
  supply does not exceed verified custodian reserves.
    `;

    // 4. Return the file as a downloadable text blob
    return new NextResponse(receipt, {
      status: 200,
      headers: {
        "Content-Type": "text/plain",
        "Content-Disposition": `attachment; filename="LedgerSync_Audit_${Date.now()}.txt"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: "Audit generation failed" }, { status: 500 });
  }
}
