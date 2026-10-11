import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

export async function POST(request: Request) {
  try {
    const { numerator, denominator } = await request.json();

    if (!numerator || !denominator) {
      return NextResponse.json({ error: "Missing split ratio parameters" }, { status: 400 });
    }

    const contractId = process.env.PRIMARY_ASSET_ID;
    if (!contractId) throw new Error("PRIMARY_ASSET_ID not configured in environment");

    // Execute the Soroban smart contract transition natively
    const command = `stellar contract invoke \
      --id ${contractId} \
      --source deployer \
      --network testnet \
      -- \
      execute_split \
      --numerator ${numerator} \
      --denominator ${denominator}`;
      
    const { stdout, stderr } = await execPromise(command);

    if (stderr && stderr.includes("error")) {
      console.error("Soroban Execution Error:", stderr);
      throw new Error("Smart contract execution failed.");
    }

    const txHash = stdout.trim();

    // TO DO: Wire txHash and split parameters to the AWS S3 WORM bucket for SEC 17a-4 audit logging

    return NextResponse.json({ 
      success: true, 
      txHash: txHash,
      message: `Successfully executed ${numerator}:${denominator} stock split.` 
    });

  } catch (error) {
    console.error("API Route Error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
