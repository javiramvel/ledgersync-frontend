import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

export async function POST(request: Request) {
  try {
    const { action, ticker, amount, targetAddress } = await request.json();

    if (!action || !ticker || !amount || !targetAddress) {
      return NextResponse.json({ error: "Missing required reconciliation parameters" }, { status: 400 });
    }

    const oracleId = process.env.RECONCILIATION_ORACLE_ID;
    if (!oracleId) throw new Error("RECONCILIATION_ORACLE_ID not configured in environment");

    // Map the action to the correct Soroban parameter (to vs from)
    const addressFlag = action === 'mint_asset' ? '--to' : '--from';

    // Execute the Soroban smart contract transition natively
    const command = `stellar contract invoke \
      --id ${oracleId} \
      --source deployer \
      --network testnet \
      -- \
      ${action} \
      --_ticker ${ticker} \
      --amount ${amount} \
      ${addressFlag} ${targetAddress}`;
      
    const { stdout, stderr } = await execPromise(command);

    if (stderr && stderr.includes("error")) {
      console.error("Soroban Execution Error:", stderr);
      throw new Error("Smart contract execution failed.");
    }

    const txHash = stdout.trim();

    // TO DO: Pipe txHash and delta parameters to AWS S3 wall-street-tokenization-audit-logs-xyz 
    // via IAM terraform-admin credentials for strict SEC 17a-4 WORM compliance

    return NextResponse.json({ 
      success: true, 
      txHash: txHash,
      message: `Successfully executed ${action} (${amount} ${ticker}).` 
    });

  } catch (error) {
    console.error("API Route Error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
