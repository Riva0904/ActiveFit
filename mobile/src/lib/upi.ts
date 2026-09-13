/**
 * Manual-UPI checkout helpers. Pure functions — no React Native imports — so they
 * can be unit-tested with `node --test` (see __tests__/upi.test.mjs).
 *
 * Backend contract (PaymentsService.createRazorpayOrder with useManualUpi=true):
 *   { paymentId, amount, originalAmount, discountAmount, currency, vpa, payeeName }
 * `amount` is the server-repriced figure — always display that, never the client's.
 */

export interface UpiCheckout {
  paymentId: string;
  amount: number;
  originalAmount?: number;
  discountAmount?: number;
  vpa: string;
  payeeName?: string;
}

/** Narrow an API response to a UPI checkout, or null if it is not one we can act on. */
export function parseUpiCheckout(res: unknown): UpiCheckout | null {
  if (!res || typeof res !== 'object') return null;
  const r = res as Record<string, unknown>;
  const paymentId = typeof r.paymentId === 'string' ? r.paymentId : null;
  const vpa = typeof r.vpa === 'string' && r.vpa.trim() ? r.vpa.trim() : null;
  const amount = typeof r.amount === 'number' && Number.isFinite(r.amount) && r.amount > 0 ? r.amount : null;
  if (!paymentId || !vpa || amount === null) return null;
  return {
    paymentId,
    amount,
    vpa,
    payeeName: typeof r.payeeName === 'string' ? r.payeeName : undefined,
    originalAmount: typeof r.originalAmount === 'number' ? r.originalAmount : undefined,
    discountAmount: typeof r.discountAmount === 'number' ? r.discountAmount : undefined,
  };
}

/**
 * Deep link understood by every Indian UPI app (GPay, PhonePe, Paytm, BHIM…).
 * `tn` is limited by most apps to ~50 chars; we keep it short and ASCII.
 */
export function buildUpiIntent(c: Pick<UpiCheckout, 'vpa' | 'amount' | 'payeeName'>, note?: string): string {
  const params = new URLSearchParams();
  params.set('pa', c.vpa);
  params.set('pn', (c.payeeName ?? 'ActiveBoost').slice(0, 50));
  params.set('am', c.amount.toFixed(2));
  params.set('cu', 'INR');
  if (note) params.set('tn', note.replace(/[^\w .-]/g, '').slice(0, 50));
  return `upi://pay?${params.toString()}`;
}

/** Human-readable summary for the confirmation dialog. */
export function describeUpiCheckout(c: UpiCheckout): string {
  const lines = [`Pay ₹${c.amount.toLocaleString('en-IN')} to`, c.payeeName ? `${c.payeeName} (${c.vpa})` : c.vpa];
  if (c.discountAmount && c.discountAmount > 0 && c.originalAmount) {
    lines.push(`(₹${c.originalAmount.toLocaleString('en-IN')} − ₹${c.discountAmount.toLocaleString('en-IN')} discount)`);
  }
  lines.push('', 'After paying in your UPI app, tap "I\'ve paid". The gym will confirm receipt.');
  return lines.join('\n');
}
