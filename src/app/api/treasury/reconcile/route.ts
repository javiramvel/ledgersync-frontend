import { NextResponse } from "next/server";
import {
  TransactionBuilder,
  Networks,
  Contract,
  nativeToScVal,
  Keypair,
  rpc as SorobanRpc,
} from "@stellar/stellar-sdk";

const RPC_URL = process.env.NEXT_PUBLIC_SOROBAN_RPC || "https://mainnet.sorobanrpc.com";
const NETWORK_PASSPHRASE = process.env.NEXT_PUBLIC_STELLAR_NETWORK === "public" ? Networks.PUBLIC : Networks.TESTNET;
const server = new SorobanRpc.Server(RPC_URL, { allowHttp: false });

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, assetCode, amount } = body;

    // Server-side authentication using the Treasury Admin Secret
    const adminSecret = process.env.ADMIN_SECRET_KEY;
    if (!adminSecret) {
      throw new Error("Missing ADMIN_SECRET_KEY environment variable");
    }
    const adminKeypair = Keypair.fromSecret(adminSecret);
    const adminPublicKey = adminKeypair.publicKey();

    // Hardcoded Mainnet Oracle ID to bypass AWS cache
    const oracleId = "CDIGJICQW5ADASOSPWX2VA4GTKPV34ELRVFU557UEZXS2LWEIEERZ4HJ";
    const contract = new Contract(oracleId);

    // 1. Fetch fresh account sequence from Mainnet to avoid txBadSeq
    const account = await server.getAccount(adminPublicKey);

    // 2. Map payload to Wasm arguments
    const functionName = action === "MINT" ? "mint_asset" : "burn_asset";
    const contractArgs = [
      nativeToScVal(assetCode, { type: "symbol" }),
      nativeToScVal(BigInt(Math.floor(amount)), { type: "i128" }),
      nativeToScVal(adminPublicKey, { type: "address" }),
    ];

    // 3. Build base transaction with 5M stroop surge pricing
    const tx = new TransactionBuilder(account, {
      fee: "5000000",
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call(functionName, ...contractArgs))
      .setTimeout(300)
      .build();

    // 4. Prepare footprint for Soroban VM
    const preparedTx = await server.prepareTransaction(tx);

    // 5. Server-side signature
    preparedTx.sign(adminKeypair);

    // 6. Submit to Mainnet
    const response = await server.sendTransaction(preparedTx);

    if (response.status === "ERROR") {
      throw new Error(`Mainnet Rejection: ${response.hash}`);
    }

    // 7. Poll for Ledger Inclusion
    let txStatus = await server.getTransaction(response.hash);
    let attempts = 0;
    while (txStatus.status === "NOT_FOUND" && attempts < 15) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      txStatus = await server.getTransaction(response.hash);
      attempts++;
    }

    if (txStatus.status === "FAILED") {
      throw new Error(`Ledger execution failed. Hash: ${response.hash}`);
    }

    return NextResponse.json({ success: true, txHash: response.hash });

  } catch (error: any) {
    console.error("LedgerSync Execution Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Execution failed" },
      { status: 500 }
    );
  }
}