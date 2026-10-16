import { NextResponse } from 'next/server';
import { TransactionBuilder, Networks, Keypair, Contract, rpc as SorobanRpc, nativeToScVal } from '@stellar/stellar-sdk';

const RPC_URL = process.env.NEXT_PUBLIC_SOROBAN_RPC || "https://mainnet.sorobanrpc.com";
const NETWORK_PASSPHRASE = process.env.NEXT_PUBLIC_STELLAR_NETWORK === "public" ? Networks.PUBLIC : Networks.TESTNET;
const server = new SorobanRpc.Server(RPC_URL, { allowHttp: false });

export async function POST(request: Request) {
  try {
    const { numerator, denominator } = await request.json();

    if (!numerator || !denominator) {
      return NextResponse.json({ error: "Missing split ratio parameters" }, { status: 400 });
    }

    const contractId = process.env.PRIMARY_ASSET_ID;
    const adminSecret = process.env.ADMIN_SECRET_KEY;

    if (!contractId || !adminSecret) {
      throw new Error("Server misconfiguration: Missing environment variables.");
    }

    const adminKeypair = Keypair.fromSecret(adminSecret);
    const account = await server.getAccount(adminKeypair.publicKey());
    const contract = new Contract(contractId);

    const contractArgs = [
      nativeToScVal(Number(numerator), { type: "u32" }),
      nativeToScVal(Number(denominator), { type: "u32" })
    ];

    const tx = new TransactionBuilder(account, {
      fee: "100000",
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call("execute_split", ...contractArgs))
      .setTimeout(60)
      .build();

    const simulatedTx = await server.simulateTransaction(tx);
    if (SorobanRpc.Api.isSimulationError(simulatedTx)) {
      throw new Error(`Simulation failed: ${simulatedTx.error}`);
    }

    const assembledTx = SorobanRpc.assembleTransaction(tx, simulatedTx).build();
    assembledTx.sign(adminKeypair);

    const response = await server.sendTransaction(assembledTx);

    if (response.status === "ERROR") {
      throw new Error(`Transaction rejected by network.`);
    }

    let txStatus = await server.getTransaction(response.hash);
    let attempts = 0;
    while (txStatus.status === "NOT_FOUND" && attempts < 15) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      txStatus = await server.getTransaction(response.hash);
      attempts++;
    }

    if (txStatus.status === "FAILED") {
      throw new Error(`Transaction failed on ledger execution.`);
    }

    return NextResponse.json({ 
      success: true, 
      txHash: response.hash,
      message: `Successfully executed ${numerator}:${denominator} stock split.` 
    });

  } catch (error: any) {
    console.error("API Route Error:", error);
    return NextResponse.json({ success: false, error: error.message || String(error) }, { status: 500 });
  }
}