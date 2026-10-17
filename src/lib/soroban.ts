import { 
  signTransaction, 
  getNetworkDetails, 
  isConnected, 
  requestAccess 
} from "@stellar/freighter-api";
import {
  TransactionBuilder,
  Networks,
  Contract,
  nativeToScVal,
  rpc as SorobanRpc,
} from "@stellar/stellar-sdk";

const RPC_URL = process.env.NEXT_PUBLIC_SOROBAN_RPC || "https://mainnet.sorobanrpc.com";
const NETWORK_PASSPHRASE = process.env.NEXT_PUBLIC_STELLAR_NETWORK === "public" ? Networks.PUBLIC : Networks.TESTNET;
const server = new SorobanRpc.Server(RPC_URL, { allowHttp: false });

export const LEDGERSYNC_REGISTRY = {
  SOLVENCY_PROOF: process.env.NEXT_PUBLIC_SOLVENCY_PROOF_CONTRACT_ID || "CDYIBWL6QJXXDCI6K07LLKGR0AWW7IIIVAE4X3FC6HTCFLVKHZ4WP653",
  YIELD_MATRIX: process.env.NEXT_PUBLIC_YIELD_CONTRACT_ID || "CA26MUWWNBUOIJIGMNSCOOR6HKTUB6PX5LTHNOL5PS3UH4IWMJ5SHVE7",
  INSTITUTIONAL_COMPLIANCE: process.env.NEXT_PUBLIC_COMPLIANCE_CONTRACT_ID || "CDSCMHG5H6US4Q45B326B2IBJTZW4QUDWZT5YIWHKJGMHIVJKQV2QNQV",
  DELTA_RECONCILIATION: process.env.RECONCILIATION_ORACLE_ID || "CDIGJICQW5ADASOSPWX2VA4GTKPV34ELRVFU557UEZXS2LWEIEERZ4HJ"
};

export type LedgerSyncAction = 
  | "MINT" 
  | "BURN" 
  | "SYNC_STATE" 
  | "DISTRIBUTE_YIELD" 
  | "VERIFY_RESERVES";

export async function executeLedgerSync(
  action: LedgerSyncAction,
  assetCode: string,
  amountOrPayload: any
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    const status = await isConnected();
    if (!status.isConnected) throw new Error("Freighter wallet is not connected.");

    const access = await requestAccess();
    if (access.error) throw new Error(access.error);
    const activeKey = access.address;

   const network = await getNetworkDetails();
    if (network.network !== "PUBLIC") { // Freighter returns "PUBLIC" for Mainnet
      throw new Error("Network mismatch: Switch Freighter to the Stellar Mainnet.");
    }

    let targetContractId = "";
    let functionName = "";
    let contractArgs: any[] = [];
    
    // Internal sequence tracker for Delta Reconciliation
    let currentNonce = parseInt(localStorage.getItem('ledgerSyncNonce') || '0');
    let nextNonce = BigInt(currentNonce + 1);

    switch (action) {
      case "MINT":
      case "BURN":
        targetContractId = LEDGERSYNC_REGISTRY.DELTA_RECONCILIATION;
        functionName = action === "MINT" ? "mint_asset" : "burn_asset";
        contractArgs = [
          nativeToScVal(assetCode, { type: "symbol" }),
          nativeToScVal(BigInt(Math.floor(amountOrPayload)), { type: "i128" }),
          nativeToScVal(activeKey, { type: "address" })
        ];
        break;
      case "SYNC_STATE":
        targetContractId = LEDGERSYNC_REGISTRY.DELTA_RECONCILIATION;
        functionName = "sync_state";
        contractArgs = [
          nativeToScVal(nextNonce, { type: "u64" }),
          nativeToScVal(BigInt(Math.floor(amountOrPayload)), { type: "i128" })
        ];
        break;
      case "DISTRIBUTE_YIELD":
        targetContractId = LEDGERSYNC_REGISTRY.YIELD_MATRIX;
        functionName = "distribute_yield";
        contractArgs = [
          nativeToScVal(assetCode, { type: "symbol" }),
          nativeToScVal(BigInt(Math.floor(amountOrPayload)), { type: "i128" })
        ];
        break;
      case "VERIFY_RESERVES":
        targetContractId = LEDGERSYNC_REGISTRY.SOLVENCY_PROOF;
        functionName = "verify_reserves";
        contractArgs = [nativeToScVal(assetCode, { type: "symbol" })];
        break;
      default:
        throw new Error("Unsupported LedgerSync operation.");
    }

    const account = await server.getAccount(activeKey);
    const contract = new Contract(targetContractId);

    const tx = new TransactionBuilder(account, {
  fee: "1000000", // Bumped to 1,000,000 stroops for Mainnet surge pricing
  networkPassphrase: NETWORK_PASSPHRASE,
})
      .addOperation(contract.call(functionName, ...contractArgs))
      .setTimeout(60)
      .build();

    const simulatedTx = await server.simulateTransaction(tx);
    if (SorobanRpc.Api.isSimulationError(simulatedTx)) {
      throw new Error(`Simulation failed: ${simulatedTx.error}`);
    }

    const assembledTx = SorobanRpc.assembleTransaction(tx, simulatedTx).build();
    const xdr = assembledTx.toXDR();

  
    // V6 compliance patch: Strictly pass network identifier
    const signedTx = await signTransaction(xdr, { networkPassphrase: "Public Global Stellar Network ; September 2015" });
    if (signedTx.error) throw new Error(`Signature rejected: ${signedTx.error}`);

    const txToSubmit = TransactionBuilder.fromXDR(signedTx.signedTxXdr, NETWORK_PASSPHRASE) as any;
    const response = await server.sendTransaction(txToSubmit);

    if (response.status === "ERROR") {
      throw new Error(`Transaction rejected by network. Hash: ${response.hash}`);
    }

    // Cryptographic Finality Polling: Await ledger inclusion
    let txStatus = await server.getTransaction(response.hash);
    let attempts = 0;
    while (txStatus.status === "NOT_FOUND" && attempts < 10) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      txStatus = await server.getTransaction(response.hash);
      attempts++;
    }

    if (txStatus.status === "FAILED") {
      throw new Error(`Transaction failed on ledger execution. Hash: ${response.hash}`);
    }

    // Persist the incremented nonce locally upon successful network inclusion
    if (action === "SYNC_STATE") {
        localStorage.setItem('ledgerSyncNonce', nextNonce.toString());
    }

    return { success: true, txHash: response.hash };
  } catch (error: any) {
    return { success: false, error: error.message || "Execution failed." };
  }
}