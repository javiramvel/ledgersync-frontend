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
  xdr,
  rpc as SorobanRpc,
} from "@stellar/stellar-sdk";

// Strictly enforced Mainnet RPC and Passphrase. No testnet fallbacks.
const RPC_URL = process.env.NEXT_PUBLIC_SOROBAN_RPC || "https://mainnet.sorobanrpc.com";
const NETWORK_PASSPHRASE = Networks.PUBLIC; 
const server = new SorobanRpc.Server(RPC_URL, { allowHttp: false });

export const LEDGERSYNC_REGISTRY = {
  // Hardcoded Mainnet Contracts (Bypasses Fargate ENV variable failures)
  SOLVENCY_PROOF: "CDYIBWL6QJXXDCI6K07LLKGR0AWW7IIIVAE4X3FC6HTCFLVKHZ4WP653",
  YIELD_MATRIX: "CA26MUWWNBUOIJIGMNSCOOR6HKTUB6PX5LTHNOL5PS3UH4IWMJ5SHVE7",
  INSTITUTIONAL_COMPLIANCE: "CDSCMHG5H6US4Q45B326B2IBJTZW4QUDWZT5YIWHKJGMHIVJKQV2QNQV",
  DELTA_RECONCILIATION: "CD5YKSCLYIJBFSSLCAKTF5JX6X5AP5XHYBEF6EZMXWMH2TPL52BEP3HJ",
  WALL_STREET_ASSET: "CAKD6QPLF6VVKXTDKIB4MP2XKSGGZJGC256Z6SKCK5LL2BEAXEMTRUVN",

  // Native Chainlink Stellar Infrastructure
  CHAINLINK_PROXY: "CDQBHEUGLDHMSUHG4IH33RJBUTMNCZOT4JIAQR4WZFRDZW6DR6S32ZLZ",
  CHAINLINK_FEEDS: {
    // 32-byte data_id for USDC Market Feed
    USDC_USD: "0x01a80ff216000332000000000000000000000000000000000000000000000000", 
    SPY_USD: "PENDING_MAINNET_DEPLOYMENT",
    UST_10YR: "PENDING_MAINNET_DEPLOYMENT"
  }
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
    if (network.network !== "PUBLIC") { 
      throw new Error("Network mismatch: Switch Freighter to the Stellar Mainnet.");
    }

    let targetContractId = "";
    let functionName = "";
    let contractArgs: any[] = [];
    
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
      fee: "5000000", // Aggressive fee bump to 5 XLM to eliminate resource constraints
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call(functionName, ...contractArgs))
      .setTimeout(300)
      .build();

    const preparedTx = await server.prepareTransaction(tx);
    const rawXdr = preparedTx.toXDR();

    const signedTx = await signTransaction(rawXdr, { networkPassphrase: Networks.PUBLIC });
    if (signedTx.error) throw new Error(`Signature rejected: ${signedTx.error}`);

    const txToSubmit = TransactionBuilder.fromXDR(signedTx.signedTxXdr, NETWORK_PASSPHRASE) as any;
    const response = await server.sendTransaction(txToSubmit);

    // DEEP DIAGNOSTIC DECODER
    if (response.status === "ERROR") {
      let exactError = "Unknown rejection";
      if (response.errorResult) {
        try {
          // The SDK already parsed this into an xdr.TransactionResult object
          exactError = response.errorResult.result().switch().name; 
        } catch (e) {
          exactError = "Failed to extract Core error";
        }
      }
      throw new Error(`Mainnet Rejection Code: ${exactError}`);
    }

    let txStatus = await server.getTransaction(response.hash);
    let attempts = 0;
    while (txStatus.status === "NOT_FOUND" && attempts < 10) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      txStatus = await server.getTransaction(response.hash);
      attempts++;
    }

    if (txStatus.status === "FAILED") {
      throw new Error(`Ledger execution failed. Hash: ${response.hash}`);
    }

    if (action === "SYNC_STATE") {
        localStorage.setItem('ledgerSyncNonce', nextNonce.toString());
    }

    return { success: true, txHash: response.hash };
  } catch (error: any) {
    return { success: false, error: error.message || "Execution failed." };
  }
}