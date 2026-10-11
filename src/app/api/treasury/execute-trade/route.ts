// src/app/api/treasury/execute-trade/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';

const tradeSchema = z.object({
  side: z.enum(['BUY', 'SELL']),
  baseAsset: z.string().min(1, 'Base asset is required').optional(),
  quoteAsset: z.string().min(1, 'Quote asset is required').optional(),
  price: z.coerce.number().positive('Price must be greater than zero'),
  amount: z.coerce.number().positive('Amount must be greater than zero'),
});

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const result = tradeSchema.safeParse(rawBody);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: result.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { side, price, amount, baseAsset, quoteAsset } = result.data;

    // Generating a simulated 64-character hex transaction hash to validate the UI flow
    const txHash = Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');

    return NextResponse.json({
      success: true,
      txHash: txHash,
      message: `Successfully executed ${side} order (${amount} at ${price}).`,
    });
  } catch (error) {
    console.error('Trade API Route Error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}