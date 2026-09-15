import { SaasBillingPeriod } from '@prisma/client';

/**
 * Calendar-safe term maths. Deliberately not `+ 30 * 86400000` — billing that
 * drifts by two days a year is a support ticket generator.
 */
export function addMonths(from: Date, months: number): Date {
  const d = new Date(from.getTime());
  const targetDay = d.getDate();
  d.setMonth(d.getMonth() + months);
  // Clamp 31 Jan + 1 month to 28/29 Feb rather than rolling into March.
  if (d.getDate() < targetDay) d.setDate(0);
  return d;
}

export function addTerm(from: Date, period: SaasBillingPeriod, count = 1): Date {
  return addMonths(from, period === SaasBillingPeriod.YEARLY ? 12 * count : count);
}

/**
 * Where a new term starts.
 * - Renewing the same plan stacks on the remaining time, so nobody loses days.
 * - Changing plan starts now; the old term is superseded.
 */
export function termStart(now: Date, currentEndDate: Date | null, isSamePlan: boolean): Date {
  if (isSamePlan && currentEndDate && currentEndDate.getTime() > now.getTime()) return new Date(currentEndDate.getTime());
  return new Date(now.getTime());
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no look-alikes

/** Short human-readable code the admin types into the UPI note. */
export function generateReferenceCode(random: () => number = Math.random): string {
  let out = '';
  for (let i = 0; i < 6; i++) out += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  return `AB-SUB-${out}`;
}

/** `upi://pay?...` intent the app/browser hands to a UPI client. */
export function buildUpiIntentUrl(params: { vpa: string; payeeName: string; amount: number; note: string }): string {
  const q = new URLSearchParams({
    pa: params.vpa,
    pn: params.payeeName,
    am: params.amount.toFixed(2),
    cu: 'INR',
    tn: params.note,
  });
  return `upi://pay?${q.toString()}`;
}
