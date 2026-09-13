// Run with: npm test  (node --test, uses Node's built-in TypeScript type stripping)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseUpiCheckout, buildUpiIntent, describeUpiCheckout } from '../upi.ts';

const backendResponse = {
  paymentId: 'pay-1', amount: 1800, originalAmount: 2000, discountAmount: 200,
  currency: 'INR', vpa: 'fitnesshub@upi', payeeName: 'FitnessHub Premium',
};

test('parseUpiCheckout accepts the backend manual-UPI shape', () => {
  assert.deepEqual(parseUpiCheckout(backendResponse), {
    paymentId: 'pay-1', amount: 1800, originalAmount: 2000, discountAmount: 200,
    vpa: 'fitnesshub@upi', payeeName: 'FitnessHub Premium',
  });
});

test('parseUpiCheckout rejects the old field names the app used to read (gymUpiId/upiId)', () => {
  assert.equal(parseUpiCheckout({ paymentId: 'p', amount: 10, gymUpiId: 'x@upi' }), null);
  assert.equal(parseUpiCheckout({ paymentId: 'p', amount: 10, upiId: 'x@upi' }), null);
});

test('parseUpiCheckout rejects a Razorpay (non-UPI) order — no vpa', () => {
  assert.equal(parseUpiCheckout({ orderId: 'order_1', paymentId: 'p', amount: 10, currency: 'INR' }), null);
});

test('parseUpiCheckout never falls back to a placeholder VPA', () => {
  for (const bad of [null, undefined, 'str', {}, { vpa: '' }, { vpa: '  ', paymentId: 'p', amount: 1 }, { vpa: 'x@upi', amount: 1 }, { vpa: 'x@upi', paymentId: 'p', amount: 0 }, { vpa: 'x@upi', paymentId: 'p', amount: NaN }]) {
    assert.equal(parseUpiCheckout(bad), null, JSON.stringify(bad));
  }
});

test('parseUpiCheckout trims the vpa and tolerates missing optional fields', () => {
  const c = parseUpiCheckout({ paymentId: 'p', amount: 99.5, vpa: ' gym@upi ' });
  assert.deepEqual(c, { paymentId: 'p', amount: 99.5, vpa: 'gym@upi', payeeName: undefined, originalAmount: undefined, discountAmount: undefined });
});

test('buildUpiIntent produces a standard upi://pay link with 2-decimal amount', () => {
  const url = buildUpiIntent({ vpa: 'fitnesshub@upi', amount: 1800, payeeName: 'FitnessHub Premium' }, 'Membership ABC-123');
  const u = new URL(url);
  assert.equal(u.protocol, 'upi:');
  assert.equal(u.host, 'pay');
  assert.equal(u.searchParams.get('pa'), 'fitnesshub@upi');
  assert.equal(u.searchParams.get('pn'), 'FitnessHub Premium');
  assert.equal(u.searchParams.get('am'), '1800.00');
  assert.equal(u.searchParams.get('cu'), 'INR');
  assert.equal(u.searchParams.get('tn'), 'Membership ABC-123');
});

test('buildUpiIntent strips unsafe characters and caps the note at 50 chars', () => {
  const url = buildUpiIntent({ vpa: 'g@upi', amount: 1 }, 'Order #42 <script>'.padEnd(80, 'x'));
  const tn = new URL(url).searchParams.get('tn');
  assert.ok(tn.length <= 50);
  assert.ok(!/[#<>]/.test(tn));
  assert.equal(new URL(url).searchParams.get('pn'), 'ActiveBoost');
});

test('describeUpiCheckout shows server amount, payee, and discount breakdown', () => {
  const text = describeUpiCheckout(parseUpiCheckout(backendResponse));
  assert.match(text, /₹1,800/);
  assert.match(text, /FitnessHub Premium \(fitnesshub@upi\)/);
  assert.match(text, /₹2,000 − ₹200 discount/);
  assert.match(text, /I've paid/);
});
