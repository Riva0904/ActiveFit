import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3001';

/**
 * BFF proxy for Razorpay order creation.
 * Forwards the request server-side so RAZORPAY_KEY_SECRET never reaches the browser.
 * The browser only receives the orderId and finalAmount.
 */
export async function POST(req: NextRequest) {
  const cookieStore = cookies();
  const token = cookieStore.get('ab_token')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();

  const response = await fetch(`${BACKEND_URL}/api/v1/payments/create-order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `ab_token=${token}`,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    return NextResponse.json(data, { status: response.status });
  }

  // Only surface what the browser needs — never expose internal payment metadata
  return NextResponse.json({
    orderId: data.orderId,
    amount: data.amount,
    originalAmount: data.originalAmount,
    discountAmount: data.discountAmount,
    currency: data.currency,
    paymentId: data.paymentId,
  });
}
