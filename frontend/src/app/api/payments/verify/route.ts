import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import * as crypto from 'crypto';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3001';

/**
 * BFF proxy for Razorpay payment verification.
 * Performs server-side HMAC verification before forwarding to the backend,
 * adding a second layer of defense against tampered payment responses.
 */
export async function POST(req: NextRequest) {
  const cookieStore = cookies();
  const token = cookieStore.get('ab_token')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { paymentId, razorpayPaymentId, razorpayOrderId, signature } = body;

  if (!paymentId || !razorpayPaymentId || !razorpayOrderId || !signature) {
    return NextResponse.json({ error: 'Missing required payment fields' }, { status: 400 });
  }

  // Server-side HMAC verification — RAZORPAY_KEY_SECRET stays on the server
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (keySecret) {
    const expectedSig = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    if (expectedSig !== signature) {
      return NextResponse.json({ error: 'Payment signature verification failed' }, { status: 400 });
    }
  }

  const response = await fetch(`${BACKEND_URL}/api/v1/payments/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `ab_token=${token}`,
    },
    body: JSON.stringify({ paymentId, razorpayPaymentId, signature }),
  });

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
