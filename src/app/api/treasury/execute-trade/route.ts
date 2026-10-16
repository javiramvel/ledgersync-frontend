import { NextResponse } from 'next/server';
import { TransactionBuilder, Networks, Keypair, Contract, rpc as SorobanRpc, nativeToScVal } from '@stellar/stellar-sdk';
import { z } from 'zod';

const RPC_URL = process.env.NEXT_PUBLIC_SOROBAN_RPC || "https://mainnet.sorobanrpc.com";
const NETWORK_PASSPHRASE = process.env.NEXT_PUBLIC_STELLAR_NETWORK === "public" ? Networks.PUBLIC : Networks.TESTNET;
const server = new SorobanRpc.Server(RPC_URL, { allowHttp: false });

const tradeSchema = z.object({
  side: z.enum(['BUY', 'SELL']),
  baseAsset: z.any(),
  quoteAsset: z.any(),
  price: z.coerce.number().positive(),
  amount: z.coerce.number().positive(),
});

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const result = tradeSchema.safeParse(rawBody);

    if (!result.success) {
      return NextResponse.json({ success: false, error: 'Validation failed' }, { status: 400 });
    }

    const { side, price, amount, baseAsset } = result.data;
    const adminSecret = process.env.ADMIN_SECRET_KEY;
    if (!adminSecret) throw new Error("Server misconfiguration: Missing environment variables.");

    const adminKeypair = Keypair.fromSecret(adminSecret);
    const account = await server.getAccount(adminKeypair.publicKey());
    
    // Assuming the baseAsset.issuer is the DEX contract ID for this pair
    const contractId = baseAsset.issuer || process.env.PRIMARY_ASSET_ID; 
    const contract = new Contract(contractId);

    const contractArgs = [
      nativeToScVal(side === 'BUY' ? 0 : 1, { type: "u32" }), // 0 for Buy, 1 for Sell
      nativeToScVal(Math.floor(price * 10000), { type: "i128" }), // Scaled price
      nativeToScVal(Math.floor(amount * 10000), { type: "i128" }) // Scaled amount
    ];

    const tx = new TransactionBuilder(account, {
      fee: "100000",
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call("execute_trade", ...contractArgs))
      .setTimeout(60)
      .build();

    const simulatedTx = await server.simulateTransaction(tx);
    if (SorobanRpc.Api.isSimulationError(simulatedTx)) throw new Error(`Simulation failed: ${simulatedTx.error}`);

    const assembledTx = SorobanRpc.assembleTransaction(tx, simulatedTx).build();
    assembledTx.sign(adminKeypair);

    const response = await server.sendTransaction(assembledTx);
    if (response.status === "ERROR") throw new Error(`Transaction rejected by network.`);

    let txStatus = await server.getTransaction(response.hash);
    let attempts = 0;
    while (txStatus.status === "NOT_FOUND" && attempts < 15) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      txStatus = await server.getTransaction(response.hash);
      attempts++;
    }

    if (txStatus.status === "FAILED") throw new Error(`Transaction failed on ledger execution.`);

    return NextResponse.json({
      success: true,
      txHash: response.hash,
      message: `Successfully executed ${side} order (${amount} at ${price}).`,
    });
  } catch (error: any) {
    console.error('Trade API Route Error:', error);
    return NextResponse.json({ success: false, error: error.message || String(error) }, { status: 500 });
  }
}