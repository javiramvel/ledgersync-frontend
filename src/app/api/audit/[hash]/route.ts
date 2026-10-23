import { NextResponse } from "next/server";
import { getRecord } from "@/lib/audit";

/** Downloads the immutable 17a-4 record for a transaction. */
export async function GET(_req: Request, { params }: { params: Promise<{ hash: string }> }) {
  const { hash } = await params;
  const record = await getRecord(hash.toLowerCase()).catch(() => null);
  if (!record) return NextResponse.json({ error: "No archived record for this transaction." }, { status: 404 });
  return new NextResponse(JSON.stringify(record, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="ledgersync-17a4-${record.transactionHash.slice(0, 12)}.json"`,
    },
  });
}
