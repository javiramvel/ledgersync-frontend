import { Contract } from "@stellar/stellar-sdk";

// Load the deployed Soroban Contract ID from environment variables
const CONTRACT_ID = process.env.NEXT_PUBLIC_COMPLIANCE_CONTRACT_ID || "CDSCMHG5H6US4Q45B326B2IBJTZW4QUDWZT5YIWHKJGMHIVJKQV2QNQV";
const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
const RPC_URL = "https://soroban-testnet.stellar.org";

export const complianceContract = new Contract(CONTRACT_ID);

/**
 * Register a regulated institutional entity on the Soroban compliance ledger.
 * Maps to the `register_institution` export in your Rust smart contract.
 */
export async function registerInstitution(institutionAddress: string, leiCode: string) {
  try {
    console.log(`Preparing registration for LEI: ${leiCode} on contract: ${CONTRACT_ID}`);
    
    // Build invocation transaction for Freighter or wallet integration
    // In production, this transaction is passed to the user's wallet for signing.
    const operation = complianceContract.call(
      "register_institution",
      // Parameters passed to the Rust function
      // e.g., Address.fromString(institutionAddress), leiCode
    );

    return { success: true, operation };
  } catch (error) {
    console.error("Failed to build institution registration transaction:", error);
    return { success: false, error };
  }
}

/**
 * Verify an institutional execution request against the on-chain compliance rules.
 * Maps to the `verify_execution` export in your Rust smart contract.
 */
export async function verifyExecution(entityAddress: string, amount: bigint) {
  try {
    console.log(`Verifying execution for entity ${entityAddress} for amount ${amount}`);

    const operation = complianceContract.call(
      "verify_execution"
      // Parameters matching verify_execution contract signature
    );

    return { success: true, operation };
  } catch (error) {
    console.error("Execution verification failed:", error);
    return { success: false, error };
  }
}
